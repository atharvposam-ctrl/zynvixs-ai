"""User-initiated supported public job APIs; never synthesize vacancies."""

import asyncio
from datetime import datetime, timezone
import hashlib
import html
import json
import re
from html.parser import HTMLParser
from urllib.parse import quote, urlsplit
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .career import current_profile
from . import db
from .career import create, records, Record, connection

router = APIRouter(prefix="/api/career-jobs")
SKILLS = [
    "python",
    "javascript",
    "typescript",
    "react",
    "node.js",
    "sql",
    "java",
    "c++",
    "aws",
    "azure",
    "docker",
    "kubernetes",
    "excel",
    "sales",
    "marketing",
    "figma",
    "git",
    "html",
    "css",
    "communication",
    "project management",
    "machine learning",
    "data analysis",
]


class Plain(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def plain(value):
    p = Plain()
    p.feed(value or "")
    return html.unescape(" ".join(p.parts))


def skills(text):
    return [
        s
        for s in SKILLS
        if re.search(r"(?<!\w)" + re.escape(s) + r"(?!\w)", text, re.I)
    ]


class Search(BaseModel):
    resume_id: str
    role: str = Field(default="", max_length=200)
    keywords: str = Field(default="", max_length=300)
    location: str = Field(default="", max_length=200)
    company: str = Field(default="", max_length=200)
    arrangement: str = ""
    experience: str = ""
    job_type: str = ""
    source: str = ""
    posted_after: str = ""
    greenhouse: str = Field(default="", pattern=r"^[a-zA-Z0-9_-]*$")
    lever: str = Field(default="", pattern=r"^[a-zA-Z0-9_-]*$")


def find_resume(ident):
    resume = next((r for r in records("resumes") if r["id"] == ident), None)
    if resume is None:
        raise HTTPException(404, "Select a saved resume first.")
    return resume


def rank(job, resume, profile):
    candidate = set(skills(resume + " " + profile))
    required = set(skills(job["description"]))
    found = sorted(candidate & required)
    missing = sorted(required - candidate)
    score = round(len(found) / len(required) * 100) if required else None
    text = resume + " " + profile
    years = re.findall(r"(\d+)\+?\s*years?", text, re.I)
    required_years = re.findall(r"(\d+)\+?\s*years?", job["description"], re.I)
    experience = "Not specified in listing or profile"
    if years and required_years:
        experience = (
            "Potentially compatible"
            if max(map(int, years)) >= min(map(int, required_years))
            else "May require more experience"
        )
    return {
        "score": score,
        "matched": found,
        "missing": missing,
        "experience": experience,
        "explanation": "Keyword overlap only; not a hiring probability. Requirements without recognized skills need manual review.",
    }


async def retrieve(body, client):
    sources = [
        (
            "Remotive",
            "https://remotive.com/api/remote-jobs",
            {"search": body.role or body.keywords},
        )
    ]
    if body.greenhouse:
        sources.append(
            (
                "Greenhouse",
                "https://boards-api.greenhouse.io/v1/boards/"
                + quote(body.greenhouse)
                + "/jobs",
                {"content": "true"},
            )
        )
    if body.lever:
        sources.append(
            (
                "Lever",
                "https://api.lever.co/v0/postings/" + quote(body.lever),
                {"mode": "json"},
            )
        )

    async def one(name, url, params):
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            payload = response.json()
            raw = payload if isinstance(payload, list) else payload.get("jobs", [])
            jobs = []
            for j in raw[:1000]:
                if name == "Remotive":
                    job = {
                        "title": j.get("title", ""),
                        "company": j.get("company_name", ""),
                        "location": j.get("candidate_required_location", ""),
                        "arrangement": "remote",
                        "description": plain(j.get("description", "")),
                        "url": j.get("url", ""),
                        "salary": j.get("salary", ""),
                        "posted": j.get("publication_date", ""),
                        "job_type": j.get("job_type", ""),
                    }
                elif name == "Greenhouse":
                    job = {
                        "title": j.get("title", ""),
                        "company": body.greenhouse,
                        "location": j.get("location", {}).get("name", ""),
                        "description": plain(j.get("content", "")),
                        "url": j.get("absolute_url", ""),
                        "posted": j.get("updated_at", ""),
                        "date_label": "Updated date",
                        "salary": "",
                        "job_type": "",
                    }
                else:
                    cat = j.get("categories", {})
                    description = (
                        j.get("descriptionPlain", "")
                        + "\n"
                        + "\n".join(
                            plain(x.get("content", "")) for x in j.get("lists", [])
                        )
                    )
                    job = {
                        "title": j.get("text", ""),
                        "company": body.lever,
                        "location": cat.get("location", ""),
                        "description": description,
                        "url": j.get("hostedUrl", ""),
                        "posted": "",
                        "salary": "",
                        "job_type": cat.get("commitment", ""),
                    }
                if name == "Lever":
                    salary = j.get("salaryRange") or {}
                    if salary:
                        job["salary"] = " ".join(
                            str(salary.get(k, ""))
                            for k in ["currency", "min", "max", "interval"]
                        ).strip()
                    if j.get("createdAt"):
                        try:
                            job["posted"] = datetime.fromtimestamp(
                                j["createdAt"] / 1000, timezone.utc
                            ).isoformat()
                        except (ValueError, TypeError, OverflowError):
                            pass
                    arrangement = j.get("workplaceType", "")
                    if arrangement in {"remote", "hybrid", "on-site"}:
                        job["arrangement"] = arrangement
                if name == "Greenhouse" and j.get("pay_input_ranges"):
                    job["salary"] = "; ".join(
                        str(r.get("title", ""))
                        + ": "
                        + str(r.get("min_cents", ""))
                        + "–"
                        + str(r.get("max_cents", ""))
                        + " cents "
                        + str(r.get("currency_type", ""))
                        for r in j["pay_input_ranges"]
                    )
                if urlsplit(job["url"]).scheme != "https":
                    continue
                job.setdefault(
                    "arrangement",
                    (
                        "remote"
                        if "remote" in job["location"].lower()
                        else (
                            "hybrid"
                            if "hybrid" in job["location"].lower()
                            else "unspecified"
                        )
                    ),
                )
                job["source"] = name
                job["sources"] = [{"source": name, "url": job["url"]}]
                job["id"] = hashlib.sha256(job["url"].encode()).hexdigest()[:24]
                jobs.append(job)
            return jobs, {"provider": name, "status": "Retrieved", "count": len(jobs)}
        except (httpx.HTTPError, ValueError, TypeError, KeyError) as exc:
            return [], {"provider": name, "status": "Failed", "error": str(exc)[:300]}

    results = await asyncio.gather(*(one(*s) for s in sources))
    return [j for result, _ in results for j in result], [
        status for _, status in results
    ]


@router.post("/criteria")
def criteria(body: dict):
    resume = find_resume(str(body.get("resume_id", "")))
    extracted = skills(resume["content"])
    roles = [
        r
        for r, terms in [
            ("Frontend developer", ["react", "javascript", "css"]),
            ("Data analyst", ["sql", "excel", "data analysis"]),
            ("Python developer", ["python"]),
            ("Cloud engineer", ["aws", "azure", "kubernetes"]),
        ]
        if any(t in extracted for t in terms)
    ]
    return {
        "skills": extracted,
        "suggested_roles": roles,
        "experience_mentions": re.findall(r"\d+\+?\s*years?", resume["content"], re.I),
        "note": "Rule-based suggestions. Review and edit search criteria before retrieving jobs.",
    }


@router.post("/search")
async def search(body: Search):
    if db.get_settings().get("offline_mode"):
        raise HTTPException(
            409,
            "Offline mode blocks job retrieval. Change Settings → Privacy to search.",
        )
    resume = find_resume(body.resume_id)
    async with httpx.AsyncClient(timeout=25, follow_redirects=False) as client:
        jobs, status = await retrieve(body, client)
    profile = " ".join(r["content"] for r in current_profile())
    combined = {}
    for j in jobs:
        key = (
            re.sub(r"\W", "", j["title"].lower()),
            re.sub(r"\W", "", j["company"].lower()),
            j["location"].lower(),
        )
        if key in combined:
            combined[key]["sources"] += j["sources"]
            continue
        combined[key] = j
    filtered = []
    for j in combined.values():
        if any(
            value and value.lower() not in str(j.get(field, "")).lower()
            for value, field in [
                (body.role, "title"),
                (body.location, "location"),
                (body.company, "company"),
                (body.job_type, "job_type"),
                (body.source, "source"),
            ]
        ):
            continue
        if body.keywords and not all(
            w.lower() in (j["title"] + " " + j["description"]).lower()
            for w in body.keywords.split()
        ):
            continue
        if body.arrangement and body.arrangement != j["arrangement"]:
            continue
        if body.experience and body.experience.lower() not in j["description"].lower():
            continue
        if body.posted_after and (
            not j["posted"] or j["posted"][:10] < body.posted_after
        ):
            continue
        j["match"] = rank(j, resume["content"], profile)
        j["match"]["location"] = "Review listing restrictions: " + (
            j["location"] or "Not provided"
        )
        j["resume_id"] = body.resume_id
        filtered.append(j)
    filtered.sort(
        key=lambda j: j["match"]["score"] if j["match"]["score"] is not None else -1,
        reverse=True,
    )
    connection().execute(
        "CREATE TABLE IF NOT EXISTS career_job_cache (id TEXT PRIMARY KEY,payload TEXT NOT NULL)"
    )
    for j in filtered[:150]:
        connection().execute(
            "INSERT OR REPLACE INTO career_job_cache VALUES (?,?)",
            (j["id"], json.dumps(j)),
        )
    create(
        "searches",
        Record(
            title=("Search: " + (body.role or body.keywords or "All configured jobs"))[
                :300
            ],
            resume_id=body.resume_id,
            content=json.dumps(
                {
                    "criteria": body.model_dump(),
                    "result_ids": [j["id"] for j in filtered[:150]],
                    "providers": status,
                }
            ),
            metadata={"cached": True},
        ),
    )
    return {
        "jobs": filtered[:150],
        "providers": status,
        "outbound": ["LinkedIn", "Indeed", "Naukri"],
        "note": "Remotive requires attribution and original listing links. Unknown location/experience information is never treated as verified compatibility.",
    }


def get_job(ident):
    connection().execute(
        "CREATE TABLE IF NOT EXISTS career_job_cache (id TEXT PRIMARY KEY,payload TEXT NOT NULL)"
    )
    r = (
        connection()
        .execute("SELECT payload FROM career_job_cache WHERE id=?", (ident,))
        .fetchone()
    )
    if not r:
        raise HTTPException(404, "Job not found. Search again.")
    return json.loads(r["payload"])


@router.post("/{ident}/save")
def save_job(ident: str):
    job = get_job(ident)
    existing = next(
        (r for r in records("jobs") if json.loads(r["content"]).get("id") == ident),
        None,
    )
    return existing or create(
        "jobs",
        Record(title=job["title"] + " — " + job["company"], content=json.dumps(job)),
    )


@router.post("/{ident}/application")
def start_application(ident: str):
    job = get_job(ident)
    existing = next(
        (r for r in records("applications") if r.get("job_id") == ident), None
    )
    if existing:
        return existing
    return create(
        "applications",
        Record(
            title=job["title"] + " — " + job["company"],
            content=job["url"],
            job_id=ident,
            resume_id=job.get("resume_id", ""),
            status="draft",
        ),
    )


@router.get("/history/{ident}")
def history(ident: str):
    row = next((r for r in records("searches") if r["id"] == ident), None)
    if not row:
        raise HTTPException(404, "Search not found.")
    data = json.loads(row["content"])
    jobs = []
    for job_id in data.get("result_ids", []):
        try:
            jobs.append(get_job(job_id))
        except HTTPException:
            pass
    return {
        "jobs": jobs,
        "criteria": data.get("criteria", {}),
        "providers": data.get("providers", []),
        "cached": True,
    }
