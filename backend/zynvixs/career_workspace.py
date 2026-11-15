"""Structured profile and existing-project association APIs."""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from . import db
from .career import connection, create, records, update, Record, KINDS
from .career_ai import generate
from .career_jobs import find_resume

router = APIRouter(prefix="/api/career-workspace")
PROFILE_FIELDS = {
    "name": "Name",
    "target_role": "Resume target role",
    "summary": "Professional summary",
    "email": "Email",
    "phone": "Phone",
    "location": "Location",
    "headline": "Headline",
    "education": "Education",
    "experience": "Experience",
    "skills": "Skills",
    "projects": "Portfolio projects",
    "certifications": "Certifications",
    "preferences": "Preferences",
    "linkedin": "LinkedIn URL",
    "portfolio": "Portfolio URL",
    "work_authorization": "Work authorization",
    "notice_period": "Notice period",
}


@router.get("/profile")
def profile():
    rows = records("profile")
    result = {
        key: next(
            (r["content"] for r in rows if r["title"].lower() == title.lower()), ""
        )
        for key, title in PROFILE_FIELDS.items()
    }
    required = ["name", "email", "location", "education", "skills", "preferences"]
    return {
        "fields": result,
        "completion": round(
            sum(bool(result[k].strip()) for k in required) / len(required) * 100
        ),
        "required_fields": required,
        "legacy_sections": [
            r
            for r in rows
            if r["title"].lower() not in {v.lower() for v in PROFILE_FIELDS.values()}
        ],
    }


class ProfileUpdate(BaseModel):
    fields: dict[str, str]


@router.put("/profile")
def save_profile(body: ProfileUpdate):
    if set(body.fields) - set(PROFILE_FIELDS):
        raise HTTPException(422, "Unknown profile field.")
    if any(len(v) > 16000 for v in body.fields.values()):
        raise HTTPException(422, "A profile section exceeds 16,000 characters.")
    rows = records("profile")
    for key, value in body.fields.items():
        title = PROFILE_FIELDS[key]
        old = next((r for r in rows if r["title"].lower() == title.lower()), None)
        record = Record(title=title, content=value.strip())
        if old:
            update("profile", old["id"], record)
        elif value.strip():
            create("profile", record)
    return profile()


class ImportProfile(BaseModel):
    resume_id: str


@router.post("/profile/import")
async def import_profile(body: ImportProfile):
    resume = find_resume(body.resume_id)
    result = await generate(
        "Extract these profile sections as strings: "
        + ", ".join(PROFILE_FIELDS)
        + '. Return {"fields":{...}}. Use empty strings where the source provides no information. Do not infer or guess personal details.',
        {"resume": resume["content"][:24000]},
    )
    fields = result.get("fields")
    if not isinstance(fields, dict) or not all(
        isinstance(v, str) for v in fields.values()
    ):
        raise HTTPException(
            502, "Invalid profile extraction. Retry with another model."
        )
    return {
        "fields": {k: v[:16000] for k, v in fields.items() if k in PROFILE_FIELDS},
        "review_required": True,
    }


def project_table():
    connection().execute(
        "CREATE TABLE IF NOT EXISTS career_project_meta (id TEXT PRIMARY KEY, archived INTEGER NOT NULL DEFAULT 0)"
    )
    connection().execute(
        "CREATE TABLE IF NOT EXISTS career_document_projects (id TEXT PRIMARY KEY, project_id TEXT NOT NULL)"
    )


def project_exists(ident):
    if not any(p["id"] == ident for p in db.list_projects()):
        raise HTTPException(404, "Project not found.")


@router.get("/projects")
def projects():
    project_table()
    meta = {
        r["id"]: bool(r["archived"])
        for r in connection().execute("SELECT * FROM career_project_meta")
    }
    return [{**p, "archived": meta.get(p["id"], False)} for p in db.list_projects()]


class Archive(BaseModel):
    archived: bool


@router.put("/projects/{ident}/archive")
def archive(ident: str, body: Archive):
    project_exists(ident)
    project_table()
    connection().execute(
        "INSERT OR REPLACE INTO career_project_meta VALUES (?,?)",
        (ident, int(body.archived)),
    )
    return {"archived": body.archived}


@router.get("/projects/{ident}")
def project_detail(ident: str):
    project_exists(ident)
    project_table()
    return {
        "conversations": [
            c for c in db.list_conversations() if c.get("project_id") == ident
        ],
        "work": [
            {**r, "kind": kind}
            for kind in KINDS
            for r in records(kind)
            if r.get("project_id") == ident
        ],
        "documents": db.query(
            "SELECT * FROM documents WHERE conversation_id IN (SELECT id FROM conversations WHERE project_id=?) OR id IN (SELECT id FROM career_document_projects WHERE project_id=?)",
            (ident, ident),
        ),
    }


class Associate(BaseModel):
    kind: str
    record_id: str
    project_id: str = ""


@router.put("/association")
def associate(body: Associate):
    if body.project_id:
        project_exists(body.project_id)
    if body.kind == "documents":
        if not db.one("SELECT id FROM documents WHERE id=?", (body.record_id,)):
            raise HTTPException(404, "Document not found.")
        project_table()
        if body.project_id:
            connection().execute(
                "INSERT OR REPLACE INTO career_document_projects VALUES (?,?)",
                (body.record_id, body.project_id),
            )
        else:
            connection().execute(
                "DELETE FROM career_document_projects WHERE id=?", (body.record_id,)
            )
        return {"associated": True}
    if body.kind == "conversations":
        if not db.get_conversation(body.record_id):
            raise HTTPException(404, "Conversation not found.")
        db.update_conversation(body.record_id, project_id=body.project_id or None)
        return {"associated": True}
    row = next((r for r in records(body.kind) if r["id"] == body.record_id), None)
    if not row:
        raise HTTPException(404, "Career record not found.")
    return update(
        body.kind,
        body.record_id,
        Record(**{k: v for k, v in row.items() if k != "id"}).model_copy(
            update={"project_id": body.project_id}
        ),
    )


from fastapi import UploadFile, File


@router.post("/extract-document")
async def extract_document(file: UploadFile = File(...)):
    from .retrieval.documents import read_pages, DocumentError

    if (
        not (file.filename or "")
        .lower()
        .endswith((".pdf", ".docx", ".txt", ".md", ".json"))
    ):
        raise HTTPException(422, "Use PDF, DOCX, TXT, Markdown or JSON exports.")
    try:
        text = "\n\n".join(
            t
            for _, t in read_pages(
                file.filename or "export.txt", await file.read(30 * 2**20 + 1)
            )
        )
    except Exception as exc:
        raise HTTPException(
            422, "Could not read this document. Use a valid text-based export."
        ) from exc
    return {"text": text[:50000]}
