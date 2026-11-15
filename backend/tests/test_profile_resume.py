import io
from fastapi.testclient import TestClient
from pypdf import PdfReader
from zynvixs import career, db
from zynvixs.main import app
from zynvixs.runtime.manager import manager

client = TestClient(app, base_url="http://localhost")


def test_profile_info_becomes_real_pdf_without_model(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Form formatting must not call a language model")

    monkeypatch.setattr(manager, "stream", forbidden)
    fields = {
        "name": "Zoë Candidate",
        "target_role": "Frontend Developer",
        "email": "zoe@example.invalid",
        "education": "BSc Computer Science, Example College, 2024",
        "skills": "React, TypeScript",
        "summary": "Built accessible interfaces for personal projects.",
    }
    assert (
        client.put("/api/career-workspace/profile", json={"fields": fields}).status_code
        == 200
    )
    r = client.post(
        "/api/career/actions/resume-from-info",
        json={
            "name": fields["name"],
            "role": fields["target_role"],
            "email": fields["email"],
            "summary": fields["summary"],
            "education": fields["education"],
            "skills": fields["skills"],
        },
    )
    assert r.status_code == 200, r.text
    row = r.json()
    assert row["metadata"]["kind"] == "form_resume"
    assert row["metadata"]["source_fields"]["name"] == "Zoë Candidate"
    assert "Experience" not in row["content"] and "[Add details]" not in row["content"]
    preview = client.get(
        f'/api/career/resumes/{row["id"]}/export?format=pdf&inline=true'
    )
    assert preview.status_code == 200 and preview.headers[
        "content-disposition"
    ].startswith("inline;")
    text = "\n".join(
        p.extract_text() for p in PdfReader(io.BytesIO(preview.content)).pages
    )
    for value in [
        "Zoë Candidate",
        "Frontend Developer",
        "zoe@example.invalid",
        "React, TypeScript",
        "Example College",
    ]:
        assert value in text
    download = client.get(f'/api/career/resumes/{row["id"]}/export?format=pdf')
    assert download.status_code == 200 and download.headers[
        "content-disposition"
    ].startswith("attachment;")
    db.close()
    assert career.active_resume()["id"] == row["id"]
    assert (
        client.get("/api/career-workspace/profile").json()["fields"]["target_role"]
        == "Frontend Developer"
    )


def test_empty_required_info_does_not_create_resume():
    for body in [
        {"name": "", "role": "Developer"},
        {"name": "   ", "role": "Developer"},
        {"name": "Candidate", "role": ""},
        {"role": "Developer"},
    ]:
        response = client.post("/api/career/actions/resume-from-info", json=body)
        assert response.status_code == 422, response.text
    assert career.records("resumes") == []


def test_creating_another_form_resume_preserves_prior_version():
    body = {"name": "Candidate", "role": "Engineer", "skills": "Python"}
    first = client.post("/api/career/actions/resume-from-info", json=body).json()
    second = client.post(
        "/api/career/actions/resume-from-info", json={**body, "skills": "Python, SQL"}
    ).json()
    assert first["id"] != second["id"]
    db.close()
    rows = career.records("resumes")
    assert len(rows) == 2 and rows[1]["content"] == first["content"]
    assert career.active_resume()["id"] == second["id"]


def test_multi_page_resume_and_non_resume_fields_excluded():
    body = {
        "name": "Candidate",
        "role": "Engineer",
        "experience": "\n".join(
            "Practice project activity " + str(i) for i in range(160)
        ),
        "preferences": "Private career preferences not for resume",
        "work_authorization": "Private authorization detail",
    }
    row = client.post("/api/career/actions/resume-from-info", json=body).json()
    assert "Private" not in row["content"]
    pdf = client.get(f'/api/career/resumes/{row["id"]}/export?format=pdf&inline=true')
    assert len(PdfReader(io.BytesIO(pdf.content)).pages) > 1
