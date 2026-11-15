import asyncio
import io
import json
import os
from threading import Thread
import pytest
from fastapi.testclient import TestClient
from zynvixs.main import app
from zynvixs import career, db
from zynvixs.runtime.manager import manager
from zynvixs.runtime.base import Delta
from zynvixs.retrieval import documents

client = TestClient(app, base_url="http://localhost")


@pytest.fixture
def model(monkeypatch):
    responses = []
    monkeypatch.setattr(manager, "status", lambda: {"loaded": True})

    async def stream(messages, params):
        assert "Never invent" in messages[0]["content"]
        if not responses:
            raise AssertionError("No controlled model response queued")
        value = responses.pop(0)
        yield Delta(
            kind="content", text=value if isinstance(value, str) else json.dumps(value)
        )

    monkeypatch.setattr(manager, "stream", stream)
    return responses


def test_structured_profile_review_and_persistence(model):
    old = career.create(
        "profile", career.Record(title="Custom legacy fact", content="Keep this")
    )
    resume = career.create(
        "resumes",
        career.Record(title="Resume", content="Alice Example, Python developer."),
    )
    model.append(
        {
            "fields": {
                "name": "Alice Example",
                "skills": "Python",
                "email": "alice@example.invalid",
            }
        }
    )
    proposed = client.post(
        "/api/career-workspace/profile/import", json={"resume_id": resume["id"]}
    )
    assert proposed.status_code == 200, proposed.text
    assert client.get("/api/career-workspace/profile").json()["fields"]["name"] == ""
    response = client.put("/api/career-workspace/profile", json=proposed.json())
    assert response.status_code == 200 and response.json()["completion"] == 50
    db.close()
    assert (
        client.get("/api/career-workspace/profile").json()["fields"]["name"]
        == "Alice Example"
    )
    assert any(r["id"] == old["id"] for r in career.records("profile"))
    assert (
        client.put(
            "/api/career-workspace/profile", json={"fields": {"unknown": "x"}}
        ).status_code
        == 422
    )


def test_linkedin_original_versions_and_invalid_model(model):
    original = {
        "role": "Developer",
        "headline": "Python learner",
        "about": "Built a personal project",
        "experience": "",
    }
    proposed = {
        "headline": "Python developer | Personal projects",
        "about": "Built a personal project with Python.",
        "experience": "[Add details]",
        "explanations": ["Lead with the target skill"],
        "keywords": ["Python"],
    }
    model.append(proposed)
    response = client.post("/api/career-ai/linkedin", json=original)
    assert response.status_code == 200, response.text
    row = response.json()
    data = json.loads(row["content"])
    assert data["original"] == original and data["proposed"] == proposed
    data["proposed"]["headline"] = "Reviewed headline"
    revision = client.post(
        "/api/career/linkedin",
        json={
            **row,
            "title": "Revised",
            "content": json.dumps(data),
            "metadata": {"parent_id": row["id"]},
        },
    )
    assert revision.status_code == 200 and len(career.records("linkedin")) == 2
    db.close()
    assert career.records("linkedin")[0]["metadata"]["parent_id"] == row["id"]
    model.append("not json")
    assert client.post("/api/career-ai/linkedin", json=original).status_code == 502


def test_ai_disconnected_states(monkeypatch):
    monkeypatch.setattr(manager, "status", lambda: {"loaded": False})
    response = client.post(
        "/api/career-ai/linkedin",
        json={"role": "Developer", "about": "Personal project"},
    )
    assert (
        response.status_code == 409
        and "Load a local model" in response.json()["detail"]
    )


def test_interview_resume_sequential_answers_and_summary(model):
    resume = career.create(
        "resumes",
        career.Record(
            title="CV", content="Python developer. Built a data analysis project."
        ),
    )
    model.append({"questions": ["Explain your project.", "How did you test it?"]})
    response = client.post(
        "/api/career-ai/interviews",
        json={"resume_id": resume["id"], "role": "Developer"},
    )
    assert response.status_code == 200, response.text
    session = response.json()
    ident = session["id"]
    feedback = {
        "strengths": ["Named the project"],
        "improvements": ["Explain the outcome"],
        "suggested_answer": "I built a data analysis project using Python. [Add details]",
    }
    model.append(feedback)
    first = client.post(
        f"/api/career-ai/interviews/{ident}/answer",
        json={"answer": "I built a Python project.", "question_index": 0},
    )
    assert first.status_code == 200 and not first.json()["complete"]
    assert (
        client.post(
            f"/api/career-ai/interviews/{ident}/answer",
            json={"answer": "Duplicate answer", "question_index": 0},
        ).status_code
        == 409
    )
    db.close()
    assert len(json.loads(career.records("interviews")[0]["content"])["answers"]) == 1
    model.append(feedback)
    last = client.post(
        f"/api/career-ai/interviews/{ident}/answer",
        json={"answer": "I tested it with fixtures.", "question_index": 1},
    )
    assert last.status_code == 200 and last.json()["complete"]
    assert "practice_areas" in json.loads(last.json()["content"])["summary"]


def seed_job(resume_id):
    career.connection().execute(
        "CREATE TABLE IF NOT EXISTS career_job_cache (id TEXT PRIMARY KEY,payload TEXT NOT NULL)"
    )
    job = {
        "id": "test-job",
        "title": "Python Engineer",
        "company": "Local test company",
        "description": "Python and Docker required",
        "url": "https://example.invalid/jobs/1",
        "resume_id": resume_id,
        "location": "Remote",
        "arrangement": "remote",
        "sources": [],
        "match": {"missing": ["docker"]},
    }
    career.connection().execute(
        "INSERT INTO career_job_cache VALUES (?,?)", ("test-job", json.dumps(job))
    )
    return job


def test_learning_gaps_and_saved_progress():
    resume = career.create(
        "resumes", career.Record(title="CV", content="Python developer")
    )
    seed_job(resume["id"])
    r = client.post(
        "/api/career-ai/learning",
        json={"resume_id": resume["id"], "job_id": "test-job"},
    )
    assert r.status_code == 200, r.text
    row = r.json()
    plan = json.loads(row["content"])
    assert (
        plan["gaps"] == ["docker"]
        and plan["lessons"][0]["url"] == "https://docs.docker.com/get-started/"
    )
    plan["lessons"][0]["complete"] = True
    plan["lessons"][0]["practice_notes"] = "Built and ran a local container."
    updated = client.put(
        "/api/career/learning/" + row["id"],
        json={**row, "content": json.dumps(plan), "complete": True},
    )
    assert updated.status_code == 200
    db.close()
    assert career.records("learning")[0]["complete"]


def test_applications_require_confirmation_and_keep_history():
    row = career.create(
        "applications",
        career.Record(title="Engineer", resume_id="saved-resume-version"),
    )
    assert (
        client.put(
            "/api/career/applications/" + row["id"], json={**row, "status": "submitted"}
        ).status_code
        == 409
    )
    assert (
        client.post(
            "/api/career/applications",
            json={"title": "Unverified", "status": "submitted"},
        ).status_code
        == 409
    )
    response = client.put(
        "/api/career/applications/" + row["id"],
        json={
            **row,
            "status": "submitted",
            "submission_verified": True,
            "due": "2026-12-01",
            "metadata": {"notes": "Employer confirmation checked"},
        },
    )
    assert response.status_code == 200, response.text
    saved = response.json()
    assert (
        saved["metadata"]["history"][-1]["to"] == "submitted"
        and saved["resume_id"] == "saved-resume-version"
    )
    client.put(
        "/api/career/applications/" + row["id"],
        json={**saved, "metadata": {**saved["metadata"], "notes": "Updated notes"}},
    )
    assert len(career.records("applications")[0]["metadata"]["history"]) == 2


def test_projects_archive_associations_and_export(monkeypatch):
    p = db.create_project("Career move")
    chat = db.create_conversation("Existing chat")
    db.add_message(chat["id"], "user", "Preserve this")
    doc = documents.ingest("project.txt", b"Project notes", chat["id"])
    cv = career.create("resumes", career.Record(title="CV", content="Resume text"))
    for kind, ident in [
        ("conversations", chat["id"]),
        ("resumes", cv["id"]),
        ("documents", doc["id"]),
    ]:
        r = client.put(
            "/api/career-workspace/association",
            json={"kind": kind, "record_id": ident, "project_id": p["id"]},
        )
        assert r.status_code == 200, r.text
    assert (
        client.put(
            f'/api/career-workspace/projects/{p["id"]}/archive', json={"archived": True}
        ).status_code
        == 200
    )
    db.close()
    detail = client.get("/api/career-workspace/projects/" + p["id"]).json()
    assert (
        detail["conversations"][0]["id"] == chat["id"]
        and detail["work"][0]["id"] == cv["id"]
        and detail["documents"][0]["id"] == doc["id"]
    )
    assert client.get("/api/career-workspace/projects").json()[0]["archived"]
    monkeypatch.setenv("ZYNVIXS_MAIL_PASSWORD", "do-not-export-this-secret")
    exported = client.get("/api/export")
    assert (
        exported.status_code == 200 and "do-not-export-this-secret" not in exported.text
    )
    assert exported.json()["career"]["resumes"][0]["id"] == cv["id"]
    assert db.list_messages(chat["id"])[0]["content"] == "Preserve this"


@pytest.fixture
def local_mail(monkeypatch):
    from zynvixs.mail_test_server import LocalServer, SMTPTestHandler, IMAPTestHandler

    servers = []
    monkeypatch.setenv("ZYNVIXS_MAIL_TEST", "1")
    monkeypatch.setenv("ZYNVIXS_MAIL_FROM", "sender@example.invalid")
    monkeypatch.delenv("ZYNVIXS_MAIL_USER", raising=False)
    monkeypatch.delenv("ZYNVIXS_MAIL_PASSWORD", raising=False)
    for protocol, handler in [("SMTP", SMTPTestHandler), ("IMAP", IMAPTestHandler)]:
        server = LocalServer(0, handler)
        server.daemon_threads = True
        Thread(target=server.serve_forever, daemon=True).start()
        servers.append(server)
        monkeypatch.setenv("ZYNVIXS_" + protocol + "_HOST", "127.0.0.1")
        monkeypatch.setenv(
            "ZYNVIXS_" + protocol + "_PORT", str(server.server_address[1])
        )
        monkeypatch.setenv("ZYNVIXS_" + protocol + "_SECURITY", "plain")
    yield servers[0].received
    for server in servers:
        server.shutdown()
        server.server_close()


def test_local_smtp_review_and_duplicate_prevention(local_mail):
    assert client.post("/api/career-mail/test/smtp").status_code == 200
    draft = client.post(
        "/api/career-mail/drafts",
        json={
            "to": "recipient@example.invalid",
            "subject": "Test only",
            "body": "Controlled local message.",
        },
    ).json()
    path = "/api/career-mail/drafts/" + draft["id"]
    review = client.post(path + "/review").json()
    assert (
        client.post(
            path + "/send",
            json={"approved": False, "review_hash": review["review_hash"]},
        ).status_code
        == 409
    )
    edited = {**draft, "content": "Changed after review."}
    assert (
        client.put("/api/career/drafts/" + draft["id"], json=edited).status_code == 200
    )
    assert (
        client.post(
            path + "/send",
            json={"approved": True, "review_hash": review["review_hash"]},
        ).status_code
        == 409
    )
    review = client.post(path + "/review").json()
    sent = client.post(
        path + "/send", json={"approved": True, "review_hash": review["review_hash"]}
    )
    assert sent.status_code == 200, sent.text
    assert sent.json()["state"] == "accepted_by_smtp" and len(local_mail) == 1
    assert b"Changed after review." in local_mail[0]
    assert (
        client.post(
            path + "/send",
            json={"approved": True, "review_hash": review["review_hash"]},
        ).status_code
        == 409
    )
    assert len(local_mail) == 1
    db.close()
    assert career.records("mail_history")[0]["metadata"]["state"] == "accepted_by_smtp"


def test_local_imap_readonly_retrieval(local_mail):
    assert client.post("/api/career-mail/test/imap").status_code == 200
    response = client.post("/api/career-mail/inbox")
    assert response.status_code == 200, response.text
    assert response.json()["messages"][0]["subject"] == "Local fixture"
    assert response.json()["read_only"]
    client.post("/api/career-mail/inbox")
    db.close()
    assert len(career.records("mail")) == 1


def test_email_missing_credentials_offline_and_test_recipients(monkeypatch, local_mail):
    draft = client.post(
        "/api/career-mail/drafts",
        json={
            "to": "real@example.com",
            "subject": "Blocked",
            "body": "This must not be sent.",
        },
    ).json()
    path = "/api/career-mail/drafts/" + draft["id"]
    review = client.post(path + "/review").json()
    assert (
        client.post(
            path + "/send",
            json={"approved": True, "review_hash": review["review_hash"]},
        ).status_code
        == 409
    )
    assert not local_mail
    db.update_settings({"offline_mode": True})
    assert client.post("/api/career-mail/inbox").status_code == 409
    db.update_settings({"offline_mode": False})
    monkeypatch.delenv("ZYNVIXS_SMTP_HOST")
    assert client.post("/api/career-mail/test/smtp").status_code == 409


def test_ai_email_draft_is_not_sent(model):
    model.append({"subject": "Following up", "body": "Thank you for your time."})
    response = client.post(
        "/api/career-mail/draft-ai",
        json={"purpose": "Write a concise follow up using my actual background."},
    )
    assert response.status_code == 200 and response.json()["metadata"]["to"] == ""
    assert career.records("mail_history") == []


def test_failed_smtp_provider_is_not_success(monkeypatch, local_mail):
    import socket

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    monkeypatch.setenv("ZYNVIXS_SMTP_PORT", str(port))
    row = client.post(
        "/api/career-mail/drafts",
        json={
            "to": "recipient@example.invalid",
            "subject": "Failure check",
            "body": "No external recipient.",
        },
    ).json()
    path = "/api/career-mail/drafts/" + row["id"]
    review = client.post(path + "/review").json()
    response = client.post(
        path + "/send", json={"approved": True, "review_hash": review["review_hash"]}
    )
    assert response.status_code == 502 and not local_mail
    assert career.records("mail_history")[0]["metadata"]["state"] == "failed_or_unknown"
    assert (
        client.post(
            path + "/send",
            json={"approved": True, "review_hash": review["review_hash"]},
        ).status_code
        == 409
    )


def test_latest_profile_values_replace_matching_context():
    career.create("profile", career.Record(title="Skills", content="Docker"))
    career.create("profile", career.Record(title="Skills", content="Python"))
    assert (
        len(career.current_profile()) == 1
        and career.current_profile()[0]["content"] == "Python"
    )
    resume = career.create("resumes", career.Record(title="CV", content="Python"))
    seed_job(resume["id"])
    from zynvixs.career_ai import learning, LearningStart

    result = learning(LearningStart(resume_id=resume["id"], job_id="test-job"))
    assert json.loads(result["content"])["gaps"] == ["docker"]


def test_offline_setting_closes_browser_sessions(monkeypatch):
    import zynvixs.main as main

    closed = []

    async def shutdown():
        closed.append(True)

    monkeypatch.setattr(main, "browser_shutdown", shutdown)
    response = client.patch("/api/settings", json={"offline_mode": True})
    assert response.status_code == 200 and closed == [True]


def test_parallel_career_reads_do_not_mix_or_corrupt_rows():
    from concurrent.futures import ThreadPoolExecutor

    kinds = ["profile", "tasks", "resumes"]
    for kind in kinds:
        career.create(kind, career.Record(title=kind, content=kind))
    db.update_settings({"theme": "dark"})

    def read(index):
        kind = kinds[index % len(kinds)]
        rows = career.records(kind)
        assert (
            len(rows) == 1 and rows[0]["title"] == kind and rows[0]["content"] == kind
        )
        assert db.get_settings()["theme"] == "dark"
        return True

    with ThreadPoolExecutor(max_workers=16) as pool:
        assert all(pool.map(read, range(3000)))
