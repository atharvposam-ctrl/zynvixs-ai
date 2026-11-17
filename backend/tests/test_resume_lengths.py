import asyncio
import io
from types import SimpleNamespace
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pypdf import PdfReader
from zynvixs.main import app
from zynvixs import career
from zynvixs.runtime.manager import manager
from zynvixs.runtime.base import Delta

client = TestClient(app, base_url="http://localhost")


def test_length_targets_change_real_generation_and_preserve_honest_page_count(
    monkeypatch,
):
    seen = []
    monkeypatch.setattr(manager, "status", lambda: {"loaded": True})
    monkeypatch.setattr(manager, "loaded", SimpleNamespace(context_length=32768))

    async def stream(messages, params):
        seen.append((messages[1]["content"], params.max_tokens))
        yield Delta(kind="content", text="# Candidate\n\n## Skills\nPython and SQL")

    monkeypatch.setattr(manager, "stream", stream)
    for preference in ["1-2", "4-5", "12"]:
        response = client.post(
            "/api/career/actions/resume",
            json={
                "role": "Developer",
                "facts": "Candidate has Python and SQL skills.",
                "length_preference": preference,
            },
        )
        assert response.status_code == 200, response.text
        row = response.json()
        assert row["metadata"]["length_preference"] == preference
        pdf = client.get(f'/api/career/resumes/{row["id"]}/export?format=pdf')
        reader = PdfReader(io.BytesIO(pdf.content))
        assert len(reader.pages) == 1 and "Python" in reader.pages[0].extract_text()
    assert [tokens for _, tokens in seen] == [2400, 4800, 9000]
    assert all("Do not repeat content or invent facts" in prompt for prompt, _ in seen)
    assert (
        client.post(
            "/api/career/actions/resume",
            json={
                "role": "Developer",
                "facts": "Python developer with a personal project.",
                "length_preference": "100",
            },
        ).status_code
        == 422
    )


def test_long_content_is_never_deleted_to_fake_a_short_pdf():
    text = "# Candidate\n\n" + "\n".join(
        "Established project fact number " + str(i) for i in range(250)
    )
    row = career.create(
        "resumes",
        career.Record(
            title="Detailed source", content=text, metadata={"length_preference": "1-2"}
        ),
    )
    response = client.get(f'/api/career/resumes/{row["id"]}/export?format=pdf')
    reader = PdfReader(io.BytesIO(response.content))
    alltext = "\n".join(p.extract_text() for p in reader.pages)
    assert len(reader.pages) > 2
    assert "Established project fact number 249" in alltext


def test_small_model_context_has_actionable_error(monkeypatch):
    monkeypatch.setattr(manager, "status", lambda: {"loaded": True})
    monkeypatch.setattr(manager, "loaded", SimpleNamespace(context_length=1024))
    response = client.post(
        "/api/career/actions/resume",
        json={
            "role": "Developer",
            "facts": "Python and SQL experience. " * 150,
            "length_preference": "12",
        },
    )
    assert response.status_code == 409 and "context" in response.json()["detail"]


def test_cancelled_generation_does_not_save_partial_content(monkeypatch):
    monkeypatch.setattr(manager, "status", lambda: {"loaded": True})

    async def stream(messages, params):
        yield Delta(kind="content", text="Partial draft")

    monkeypatch.setattr(manager, "stream", stream)

    class Disconnected:
        async def is_disconnected(self):
            return True

    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            career.generate_resume(
                career.ResumeRequest(
                    role="Developer",
                    facts="Python developer with real personal projects.",
                ),
                Disconnected(),
            )
        )
    assert exc.value.status_code == 499 and career.records("resumes") == []


def test_custom_layout_and_output_limit_are_recorded(monkeypatch):
    monkeypatch.setattr(manager, 'status', lambda: {'loaded': True})
    monkeypatch.setattr(manager, 'loaded', SimpleNamespace(context_length=4096))
    async def stream(messages, params):
        yield Delta(kind='content', text='# Reviewed candidate\n\n## Skills\nPython')
        yield Delta(kind='done', finish_reason='length')
    monkeypatch.setattr(manager, 'stream', stream)
    response=client.post('/api/career/actions/resume',json={'role':'Developer','facts':'Python portfolio with documented source facts.','length_preference':'custom','custom_pages':12,'paper_size':'letter'})
    assert response.status_code==200,response.text
    row=response.json()
    assert row['metadata']['context_limited'] is True
    assert row['metadata']['finish_reason']=='length'
    assert row['metadata']['custom_pages']==12
    pdf=PdfReader(io.BytesIO(client.get(f'/api/career/resumes/{row["id"]}/export?format=pdf').content))
    assert len(pdf.pages)==1
    assert float(pdf.pages[0].mediabox.width)==612
    invalid=client.post('/api/career/actions/resume',json={'role':'Developer','facts':'Python portfolio with documented source facts.','length_preference':'custom','custom_pages':0})
    assert invalid.status_code==422
