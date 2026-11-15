"""Optional, user-started browser sessions. No unattended submission or PC control."""

import asyncio
import ipaddress
import socket
import uuid
from urllib.parse import urlsplit, urljoin
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from . import db
from .career import records, create, update, Record
from .career_jobs import get_job

router = APIRouter(prefix="/api/career-browser")
SESSIONS = {}


class Start(BaseModel):
    job_id: str


class Fill(BaseModel):
    values: dict[str, str] = Field(default_factory=dict)


class Approval(BaseModel):
    approved: bool = False


async def public_url(url):
    p = urlsplit(url)
    if p.scheme != "https" or p.username or p.password or not p.hostname:
        raise ValueError("Only public HTTPS URLs are supported.")
    addresses = await asyncio.to_thread(
        socket.getaddrinfo, p.hostname, p.port or 443, type=socket.SOCK_STREAM
    )
    if not addresses or any(
        not ipaddress.ip_address(a[4][0]).is_global for a in addresses
    ):
        raise ValueError("Private network addresses are blocked.")


class BrowserSession:
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.page = None
        self.fields = []
        self.reviewed = None
        self.allowed = set()
        self.lock = asyncio.Lock()

    async def start(self, url, headless=False, test=False):
        from playwright.async_api import async_playwright

        if not test:
            await public_url(url)
        self.playwright = await async_playwright().start()
        try:
            self.browser = await self.playwright.chromium.launch(headless=headless)
            context = await self.browser.new_context(accept_downloads=False)
            if not test:

                async def guard(route):
                    try:
                        if db.get_settings().get("offline_mode"):
                            raise ValueError("Offline mode")
                        await public_url(route.request.url)
                        await route.continue_()
                    except Exception:
                        await route.abort()

                await context.route("**/*", guard)
            self.page = await context.new_page()
            await self.page.goto(url, wait_until="domcontentloaded", timeout=45000)
            self.allowed = {urlsplit(url).hostname}
            return await self.inspect()
        except Exception:
            await self.close()
            raise

    async def inspect(self):
        if not self.page:
            raise ValueError("Browser session closed.")
        url = self.page.url
        if urlsplit(url).hostname not in self.allowed:
            raise ValueError(
                "The page changed to another site. Use manual browser controls; automatic filling is blocked."
            )
        self.fields = await self.page.locator("input,textarea,select").evaluate_all(
            """els=>els.map((e,i)=>({index:i,name:e.name||e.id||'',label:e.labels?.[0]?.innerText||e.getAttribute('aria-label')||e.placeholder||e.name||'',type:e.type||e.tagName.toLowerCase(),value:e.type==='password'?'':e.value,required:e.required})).filter(e=>!['password','hidden','file','submit','button','checkbox','radio'].includes(e.type))"""
        )
        return {
            "url": url,
            "fields": self.fields,
            "description": (await self.page.locator("body").inner_text())[:20000],
            "controls": await self.page.locator(
                "input[type=checkbox],input[type=radio],input[type=file]"
            ).evaluate_all(
                "els=>els.map(e=>({name:e.name,type:e.type,checked:e.checked,files:e.files?Array.from(e.files).map(f=>f.name):[]}))"
            ),
        }

    async def fill(self, values):
        await self.inspect()
        self.reviewed = None
        permitted = {str(f["index"]): f for f in self.fields}
        for index, value in values.items():
            if index not in permitted:
                raise ValueError(
                    "Unsupported field selected. Passwords, file uploads and consent controls must be handled manually."
                )
            locator = self.page.locator("input,textarea,select").nth(int(index))
            if permitted[index]["type"] == "select-one":
                await locator.select_option(label=value)
            else:
                await locator.fill(value)
        return await self.inspect()

    async def review(self):
        snapshot = await self.inspect()
        self.reviewed = snapshot
        return snapshot

    async def submit(self, approved):
        current = await self.inspect()
        if (
            not approved
            or self.reviewed is None
            or current["fields"] != self.reviewed["fields"]
            or current["url"] != self.reviewed["url"]
            or current["controls"] != self.reviewed["controls"]
        ):
            raise ValueError(
                "Review the current form and explicitly approve before submitting."
            )
        buttons = self.page.locator('button[type="submit"],input[type="submit"]')
        if await buttons.count() != 1:
            raise ValueError(
                "This page needs manual submission: no unique submit control."
            )
        action = await buttons.first.evaluate("(e)=>e.form?.action||location.href")
        if (
            urlsplit(urljoin(current["url"], action)).netloc
            != urlsplit(current["url"]).netloc
        ):
            raise ValueError("Cross-site form submission requires manual handling.")
        await buttons.first.click(timeout=15000)
        self.reviewed = None
        return {
            "status": "submission_attempted",
            "message": "Submission control clicked. Verify the website confirmation yourself. Application tracking has not been marked submitted.",
        }

    async def close(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
        self.page = None


def session(ident):
    if ident not in SESSIONS:
        raise HTTPException(
            404, "Session ended or application restarted. Open a new browser session."
        )
    return SESSIONS[ident]


@router.get("/status")
def status():
    try:
        import playwright.async_api

        installed = True
    except ImportError:
        installed = False
    return {
        "package_installed": installed,
        "setup": "In your project folder run: .venv\\Scripts\\python -m pip install playwright ; then .venv\\Scripts\\python -m playwright install chromium",
        "requires": "Keep Zynvixs running. A visible local browser is required. Portal login, file uploads, MFA and CAPTCHA are manual. Generic forms may require manual handling; no full-PC control is provided.",
    }


@router.post("/start")
async def start(body: Start):
    if db.get_settings().get("offline_mode"):
        raise HTTPException(409, "Offline mode blocks browser automation.")
    if len(SESSIONS) >= 2:
        raise HTTPException(409, "Close an existing browser session first.")
    job = get_job(body.job_id)
    s = BrowserSession()
    try:
        details = await s.start(job["url"])
    except Exception as exc:
        raise HTTPException(
            409,
            "Browser could not start. "
            + str(exc)[:500]
            + ". See browser setup instructions.",
        )
    run = create(
        "automation",
        Record(
            title="Browser: " + job["title"],
            content="Opened " + job["url"],
            job_id=body.job_id,
            status="reviewing",
        ),
    )
    SESSIONS[run["id"]] = s
    return {"id": run["id"], **details}


@router.get("/{ident}")
async def inspect(ident: str):
    try:
        return await session(ident).inspect()
    except ValueError as exc:
        raise HTTPException(409, str(exc))


@router.post("/{ident}/fill")
async def fill(ident: str, body: Fill):
    s = session(ident)
    async with s.lock:
        if db.get_settings().get("offline_mode"):
            raise HTTPException(409, "Offline mode blocks browser actions.")
        try:
            return await s.fill(body.values)
        except Exception as exc:
            raise HTTPException(409, str(exc)[:500])


@router.post("/{ident}/review")
async def review(ident: str):
    s = session(ident)
    async with s.lock:
        try:
            return await s.review()
        except Exception as exc:
            raise HTTPException(409, str(exc)[:500])


@router.post("/{ident}/submit")
async def submit(ident: str, body: Approval):
    s = session(ident)
    async with s.lock:
        if db.get_settings().get("offline_mode"):
            raise HTTPException(409, "Offline mode blocks submission.")
        try:
            result = await s.submit(body.approved)
            update(
                "automation",
                ident,
                Record(
                    title="Browser submission attempted",
                    content=result["message"],
                    status="reviewing",
                ),
            )
            return result
        except Exception as exc:
            raise HTTPException(409, str(exc)[:500])


@router.delete("/{ident}")
async def cancel(ident: str):
    s = session(ident)
    await s.close()
    del SESSIONS[ident]
    update(
        "automation",
        ident,
        Record(
            title="Browser session closed",
            content="User closed the session. No submission is implied.",
            complete=True,
        ),
    )
    return {"closed": True}


async def shutdown():
    for s in list(SESSIONS.values()):
        await s.close()
    SESSIONS.clear()
