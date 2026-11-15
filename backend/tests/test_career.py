import pytest
from fastapi import HTTPException
from zynvixs import career, db
from zynvixs.runtime.manager import manager
from zynvixs.runtime.base import Delta


def test_career_records_survive_connection_restart():
    created = career.create("tasks", career.Record(title="Follow up", due="2026-12-01"))
    db.close()
    assert career.records("tasks")[0]["id"] == created["id"]
    career.update(
        "tasks", created["id"], career.Record(title="Follow up", complete=True)
    )
    assert career.records("tasks")[0]["complete"]
    career.delete("tasks", created["id"])
    assert career.records("tasks") == []


def test_missing_record_does_not_report_success():
    with pytest.raises(HTTPException) as exc:
        career.update("tasks", "missing", career.Record(title="Test"))
    assert exc.value.status_code == 404


def test_resume_requires_connected_model(monkeypatch):
    import asyncio

    monkeypatch.setattr(manager, "status", lambda: {"loaded": False})
    with pytest.raises(HTTPException) as exc:
        asyncio.run(
            career.generate_resume(
                career.ResumeRequest(
                    role="Developer", facts="Python developer with two years of work."
                )
            )
        )
    assert exc.value.status_code == 409


def test_resume_saves_only_model_content(monkeypatch):
    import asyncio

    monkeypatch.setattr(manager, "status", lambda: {"loaded": True})

    async def stream(messages, params):
        assert "Never invent" in messages[0]["content"]
        yield Delta(kind="reasoning", text="private reasoning")
        yield Delta(kind="content", text="# Resume\nPython developer")

    monkeypatch.setattr(manager, "stream", stream)
    result = asyncio.run(
        career.generate_resume(
            career.ResumeRequest(
                role="Developer", facts="Python developer with two years of work."
            )
        )
    )
    assert result["content"] == "# Resume\nPython developer"
    db.close()
    assert career.records("resumes")[0]["id"] == result["id"]
