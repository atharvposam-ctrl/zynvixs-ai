"""Explicit IMAP/SMTP connections using environment-held credentials."""

import asyncio
import hashlib
import imaplib
import json
import os
import smtplib
import ssl
from email import policy
from email.parser import BytesParser
from email.message import EmailMessage
from email.utils import parseaddr
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .career import current_profile
from . import db
from .career import create, records, update, connection, Record
from .career_ai import generate, item

router = APIRouter(prefix="/api/career-mail")


def config(protocol):
    host = os.environ.get("ZYNVIXS_" + protocol + "_HOST", "").strip()
    mode = os.environ.get("ZYNVIXS_" + protocol + "_SECURITY", "tls")
    test = os.environ.get("ZYNVIXS_MAIL_TEST") == "1"
    defaults = {
        "SMTP": 465 if mode == "tls" else 587,
        "IMAP": 993 if mode == "tls" else 143,
    }
    if not host:
        raise HTTPException(
            409,
            protocol
            + " is not configured. Set the documented environment variables, then restart Zynvixs.",
        )
    if test and host not in {"127.0.0.1", "localhost", "::1"}:
        raise HTTPException(409, "Mail test mode is restricted to a loopback server.")
    if mode not in {"tls", "starttls", "plain"}:
        raise HTTPException(409, "Use tls or starttls for mail security.")
    if mode == "plain" and not (test and host in {"127.0.0.1", "localhost", "::1"}):
        raise HTTPException(
            409,
            "Unencrypted mail is only supported for a loopback test server with ZYNVIXS_MAIL_TEST=1.",
        )
    try:
        port = int(
            os.environ.get("ZYNVIXS_" + protocol + "_PORT", str(defaults[protocol]))
        )
    except ValueError:
        raise HTTPException(409, "Invalid mail port.")
    user = os.environ.get("ZYNVIXS_MAIL_USER", "")
    password = os.environ.get("ZYNVIXS_MAIL_PASSWORD", "")
    if not test and (not user or not password):
        raise HTTPException(
            409,
            "Set ZYNVIXS_MAIL_USER and ZYNVIXS_MAIL_PASSWORD using an app password supported by your provider.",
        )
    return host, port, mode, user, password


def network():
    if db.get_settings().get("offline_mode"):
        raise HTTPException(409, "Offline mode blocks mailbox connections and sending.")


def smtp():
    host, port, mode, user, password = config("SMTP")
    client = (
        smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context())
        if mode == "tls"
        else smtplib.SMTP(host, port, timeout=20)
    )
    try:
        if mode == "starttls":
            client.starttls(context=ssl.create_default_context())
        if user:
            client.login(user, password)
        return client
    except Exception:
        client.close()
        raise


def imap():
    host, port, mode, user, password = config("IMAP")
    client = (
        imaplib.IMAP4_SSL(
            host, port, ssl_context=ssl.create_default_context(), timeout=20
        )
        if mode == "tls"
        else imaplib.IMAP4(host, port, timeout=20)
    )
    try:
        if mode == "starttls":
            client.starttls(ssl_context=ssl.create_default_context())
        if user:
            client.login(user, password)
        return client
    except Exception:
        client.shutdown()
        raise


def safe_error(exc):
    if isinstance(exc, HTTPException):
        return exc
    return HTTPException(
        502,
        "Mail connection or operation failed ("
        + type(exc).__name__
        + "). Check host, port, TLS, provider app-password support and credentials. No success is assumed.",
    )


@router.get("/status")
def status():
    return {
        "smtp_configured": bool(os.environ.get("ZYNVIXS_SMTP_HOST")),
        "imap_configured": bool(os.environ.get("ZYNVIXS_IMAP_HOST")),
        "username_configured": bool(os.environ.get("ZYNVIXS_MAIL_USER")),
        "password_configured": bool(os.environ.get("ZYNVIXS_MAIL_PASSWORD")),
        "support": "IMAP and SMTP with TLS/startTLS and provider-supported app passwords. OAuth-only accounts are not supported. Credentials are read only from the backend environment; never paste them into drafts.",
    }


@router.post("/test/{protocol}")
async def test_connection(protocol: str):
    network()
    if protocol not in {"smtp", "imap"}:
        raise HTTPException(404, "Choose smtp or imap.")

    def work():
        client = smtp() if protocol == "smtp" else imap()
        try:
            if protocol == "smtp":
                code, _ = client.noop()
                if code != 250:
                    raise RuntimeError("SMTP NOOP failed")
            else:
                result, _ = client.noop()
                if result != "OK":
                    raise RuntimeError("IMAP NOOP failed")
        finally:
            client.quit() if protocol == "smtp" else client.logout()
        return {
            "connected": True,
            "protocol": protocol,
            "message": "Connection and authentication checked; no message sent.",
        }

    try:
        return await asyncio.to_thread(work)
    except Exception as exc:
        raise safe_error(exc)


@router.post("/inbox")
async def inbox():
    network()

    def work():
        client = imap()
        try:
            result, _ = client.select("INBOX", readonly=True)
            if result != "OK":
                raise RuntimeError("Inbox unavailable")
            result, data = client.uid("search", None, "ALL")
            if result != "OK":
                raise RuntimeError("Search failed")
            _, validity_response = client.response("UIDVALIDITY")
            validity = (
                (validity_response[0] or b"unknown").decode(errors="replace")
                if validity_response
                else "unknown"
            )
            messages = []
            for uid in data[0].split()[-20:][::-1]:
                result, payload = client.uid("fetch", uid, "(BODY.PEEK[])")
                if result != "OK":
                    continue
                raw = next((p[1] for p in payload if isinstance(p, tuple)), None)
                if raw is None:
                    continue
                mail = BytesParser(policy=policy.default).parsebytes(raw)
                body = (
                    mail.get_body(preferencelist=("plain",))
                    if mail.is_multipart()
                    else mail
                )
                text = (
                    str(body.get_content())[:50000]
                    if body
                    else "[No plain-text body; open in your mail client]"
                )
                messages.append(
                    {
                        "uid": uid.decode(),
                        "subject": str(mail.get("Subject", "(No subject)")),
                        "from": str(mail.get("From", "")),
                        "date": str(mail.get("Date", "")),
                        "body": text,
                    }
                )
            return messages, validity
        finally:
            client.logout()

    try:
        messages, validity = await asyncio.to_thread(work)
    except Exception as exc:
        raise safe_error(exc)
    account = (
        os.environ.get("ZYNVIXS_MAIL_USER", "local-test")
        + "@"
        + os.environ.get("ZYNVIXS_IMAP_HOST", "")
    )
    existing = {r.get("metadata", {}).get("key"): r for r in records("mail")}
    fetched_at = datetime.now(timezone.utc).isoformat()
    for rank, m in enumerate(messages):
        key = account + ":" + validity + ":" + m["uid"]
        record = Record(
            title=m["subject"][:300] or "(No subject)",
            content=m["body"],
            metadata={
                **m,
                "key": key,
                "account": account,
                "fetched_at": fetched_at,
                "fetch_rank": rank,
            },
        )
        if key in existing:
            update("mail", existing[key]["id"], record)
        else:
            create("mail", record)
    return {"messages": messages, "read_only": True}


class Draft(BaseModel):
    to: str = Field(default="", max_length=300)
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=50000)


def fingerprint(record):
    return hashlib.sha256(
        json.dumps(
            {
                "to": record["metadata"].get("to", ""),
                "subject": record["title"],
                "body": record["content"],
            },
            sort_keys=True,
        ).encode()
    ).hexdigest()


@router.post("/drafts")
def draft(body: Draft):
    if (
        "\n" in body.to
        or "\r" in body.to
        or "\n" in body.subject
        or "\r" in body.subject
    ):
        raise HTTPException(422, "Invalid mail headers.")
    return create(
        "drafts",
        Record(
            title=body.subject,
            content=body.body,
            metadata={"to": body.to, "kind": "email"},
        ),
    )


class AIDraft(BaseModel):
    purpose: str = Field(min_length=5, max_length=5000)
    source_mail_id: str = ""


@router.post("/draft-ai")
async def draft_ai(body: AIDraft):
    source = item("mail", body.source_mail_id) if body.source_mail_id else None
    result = await generate(
        'Write an email draft. Return {"subject":"...","body":"..."}. No fabricated accomplishments or claims that an action has occurred. Do not generate or infer the recipient address.',
        {
            "purpose": body.purpose,
            "source_email": source,
            "candidate_profile": [
                {"title": r["title"], "content": r["content"]}
                for r in current_profile()
            ],
        },
    )
    if not isinstance(result.get("subject"), str) or not isinstance(
        result.get("body"), str
    ):
        raise HTTPException(502, "Invalid email draft response. Retry.")
    return draft(Draft(subject=result["subject"][:300], body=result["body"][:50000]))


@router.post("/drafts/{ident}/review")
def review(ident: str):
    r = item("drafts", ident)
    if r.get("metadata", {}).get("kind") != "email":
        raise HTTPException(409, "Select an email draft.")
    return {
        "review_hash": fingerprint(r),
        "to": r["metadata"].get("to", ""),
        "subject": r["title"],
        "body": r["content"],
    }


class Send(BaseModel):
    approved: bool = False
    review_hash: str = ""


@router.post("/drafts/{ident}/send")
async def send(ident: str, body: Send):
    network()
    record = item("drafts", ident)
    digest = fingerprint(record)
    if not body.approved or body.review_hash != digest:
        raise HTTPException(
            409, "Review the current saved draft and explicitly approve before sending."
        )
    to = record.get("metadata", {}).get("to", "")
    sender = os.environ.get("ZYNVIXS_MAIL_FROM") or os.environ.get(
        "ZYNVIXS_MAIL_USER", ""
    )
    if (
        parseaddr(to)[1] != to
        or "@" not in to
        or any(c in to + sender + record["title"] for c in "\r\n")
    ):
        raise HTTPException(
            422,
            "Use one valid recipient address and sender without header line breaks.",
        )
    if not sender or "@" not in sender:
        raise HTTPException(409, "Set ZYNVIXS_MAIL_FROM to your sender address.")
    if os.environ.get("ZYNVIXS_MAIL_TEST") == "1" and not to.lower().endswith(
        (".invalid", "@localhost")
    ):
        raise HTTPException(
            409, "Test mode permits only .invalid or localhost recipients."
        )
    config("SMTP")
    connection().execute(
        "CREATE TABLE IF NOT EXISTS career_mail_sends (key TEXT PRIMARY KEY,state TEXT NOT NULL)"
    )
    key = ident + ":" + digest
    try:
        connection().execute(
            "INSERT INTO career_mail_sends VALUES (?,?)", (key, "sending")
        )
    except Exception:
        raise HTTPException(
            409,
            "This draft version was already attempted. Check send history before considering a new draft; automatic retries are blocked.",
        )

    def work():
        message = EmailMessage()
        message["From"] = sender
        message["To"] = to
        message["Subject"] = record["title"]
        message.set_content(record["content"])
        client = smtp()
        try:
            refused = client.send_message(message)
            if refused:
                raise RuntimeError("Recipient refused")
            return {
                "state": "accepted_by_smtp",
                "message": "SMTP server accepted the message. This is not proof of recipient delivery.",
            }
        finally:
            client.quit()

    try:
        result = await asyncio.to_thread(work)
    except Exception as exc:
        connection().execute(
            "UPDATE career_mail_sends SET state=? WHERE key=?",
            ("failed_or_unknown", key),
        )
        create(
            "mail_history",
            Record(
                title="Send failed or outcome unknown",
                content="Check your provider before retrying.",
                metadata={
                    "draft_id": ident,
                    "state": "failed_or_unknown",
                    "at": datetime.now(timezone.utc).isoformat(),
                },
            ),
        )
        raise safe_error(exc)
    connection().execute(
        "UPDATE career_mail_sends SET state=? WHERE key=?", (result["state"], key)
    )
    create(
        "mail_history",
        Record(
            title=record["title"],
            content=result["message"],
            metadata={
                "draft_id": ident,
                "state": result["state"],
                "to": to,
                "at": datetime.now(timezone.utc).isoformat(),
            },
        ),
    )
    return result
