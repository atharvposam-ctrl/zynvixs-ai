import asyncio
import io
import json
from unittest.mock import patch
import httpx
import pytest
from fastapi.testclient import TestClient
from zynvixs import career, career_jobs as jobs, db
from zynvixs.main import app

client = TestClient(app, base_url="http://localhost")


def test_import_export_roundtrip():
    from docx import Document

    doc = Document()
    doc.add_paragraph("Alice — Python developer with 3 years experience.")
    buf = io.BytesIO()
    doc.save(buf)
    r = client.post(
        "/api/career/actions/import-resume",
        files={"file": ("resume.docx", buf.getvalue())},
    )
    assert r.status_code == 200, r.text
    ident = r.json()["id"]
    assert (
        client.put("/api/career/actions/active-resume", json={"id": ident}).status_code
        == 200
    )
    pdf = client.get(f"/api/career/resumes/{ident}/export?format=pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    from pypdf import PdfReader

    assert "Alice" in "".join(
        p.extract_text() for p in PdfReader(io.BytesIO(pdf.content)).pages
    )
    docx = client.get(f"/api/career/resumes/{ident}/export?format=docx")
    assert "Alice" in "\n".join(
        p.text for p in Document(io.BytesIO(docx.content)).paragraphs
    )
    db.close()
    assert client.get("/api/career/actions/active-resume").json()["id"] == ident
    assert client.get("/api/career/resumes").json()[0]["id"] == ident
    bad = client.post(
        "/api/career/actions/import-resume", files={"file": ("file.exe", b"no")}
    )
    assert bad.status_code == 422


def test_job_providers_partial_failure_and_tracking(monkeypatch):
    resume = career.create(
        "resumes",
        career.Record(
            title="Resume", content="Python SQL developer with 3 years experience."
        ),
    )
    career.create("profile", career.Record(title="Skills", content="Python and SQL"))

    def transport(req):
        if req.url.host == "remotive.com":
            return httpx.Response(
                200,
                json={
                    "jobs": [
                        {
                            "title": "Python Developer",
                            "company_name": "Acme",
                            "candidate_required_location": "Worldwide",
                            "description": "Python SQL Docker. 2 years experience",
                            "url": "https://remotive.com/remote-jobs/software-dev/123",
                            "job_type": "full_time",
                        }
                    ]
                },
            )
        if req.url.host == "boards-api.greenhouse.io":
            return httpx.Response(
                200,
                json={
                    "jobs": [
                        {
                            "title": "Python Developer",
                            "location": {"name": "Worldwide"},
                            "content": "Python SQL Docker. 2 years experience",
                            "absolute_url": "https://boards.greenhouse.io/acme/jobs/123",
                        }
                    ]
                },
            )
        return httpx.Response(503)

    real_client = httpx.AsyncClient

    def factory(**kwargs):
        return real_client(transport=httpx.MockTransport(transport), **kwargs)

    with patch.object(jobs.httpx, "AsyncClient", factory):
        response = asyncio.run(
            jobs.search(
                jobs.Search(
                    resume_id=resume["id"],
                    role="Python",
                    greenhouse="Acme",
                    lever="acme",
                )
            )
        )
    assert len(response["jobs"]) == 1
    job = response["jobs"][0]
    assert len(job["sources"]) == 2 and job["match"]["matched"] == ["python", "sql"]
    assert (
        job["match"]["missing"] == ["docker"]
        and job["match"]["experience"] == "Potentially compatible"
    )
    assert response["providers"][2]["status"] == "Failed"
    jobs.save_job(job["id"])
    jobs.save_job(job["id"])
    assert len(career.records("jobs")) == 1
    application = jobs.start_application(job["id"])
    assert application["status"] == "draft"
    assert jobs.start_application(job["id"])["id"] == application["id"]
    db.close()
    assert career.records("applications")[0]["status"] == "draft"
    career.update(
        "applications",
        application["id"],
        career.Record(title=application["title"], status="submitted", job_id=job["id"], submission_verified=True),
    )
    assert career.records("applications")[0]["status"] == "submitted"


def test_offline_search_blocked():
    with patch.object(db, "get_settings", lambda: {"offline_mode": True}):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            asyncio.run(jobs.search(jobs.Search(resume_id="none")))
        assert exc.value.status_code == 409


def test_browser_submission_requires_approval_local_only():
    pytest.importorskip("playwright.async_api")
    from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
    from threading import Thread
    from zynvixs.career_browser import BrowserSession

    submitted = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(
                b'<form method="post"><label>Full name<input name="name" required></label><label>Email<input name="email" type="email"></label><input type="password" name="password"><button type="submit">Submit</button></form>'
            )

        def do_POST(self):
            submitted.append(
                self.rfile.read(int(self.headers.get("Content-Length", 0)))
            )
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Application received")

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()

    async def scenario():
        s = BrowserSession()
        try:
            page = await s.start(
                f"http://127.0.0.1:{server.server_port}", headless=True, test=True
            )
            assert not any(f["type"] == "password" for f in page["fields"])
            await s.fill({"0": "Test Applicant", "1": "test@example.invalid"})
            with pytest.raises(ValueError):
                await s.submit(True)
            await s.review()
            with pytest.raises(ValueError):
                await s.submit(False)
            assert not submitted
            await s.page.locator("input[name=name]").fill("Changed")
            with pytest.raises(ValueError):
                await s.submit(True)
            await s.review()
            r = await s.submit(True)
            await s.page.wait_for_load_state()
            assert r["status"] == "submission_attempted"
            assert len(submitted) == 1 and b"Changed" in submitted[0]
        finally:
            await s.close()

    try:
        asyncio.run(scenario())
    finally:
        server.shutdown()
        server.server_close()


def test_learning_profile_and_history_preserved():
    chat = db.create_conversation(title="Existing chat")
    db.add_message(chat["id"], "user", "Keep my messages")
    career.create("profile", career.Record(title="Name", content="Test Applicant"))
    lesson = career.create("learning", career.Record(title="SQL course"))
    career.update(
        "learning", lesson["id"], career.Record(title="SQL course", complete=True)
    )
    before = db.conn().execute("SELECT count(*) FROM conversations").fetchone()[0]
    db.close()
    assert career.records("profile")[0]["content"] == "Test Applicant"
    assert career.records("learning")[0]["complete"]
    assert db.list_messages(chat["id"])[0]["content"] == "Keep my messages"
    assert (
        db.conn().execute("SELECT count(*) FROM conversations").fetchone()[0] == before
    )


def test_missing_browser_package_has_setup(monkeypatch):
    import sys
    from zynvixs.career_browser import status

    monkeypatch.setitem(sys.modules, "playwright.async_api", None)
    result = status()
    assert not result["package_installed"] and "install chromium" in result["setup"]


def test_malformed_resume_is_actionable_error():
    response = client.post(
        "/api/career/actions/import-resume",
        files={"file": ("broken.docx", b"not a valid zip")},
    )
    assert response.status_code == 422 and "valid" in response.json()["detail"]
