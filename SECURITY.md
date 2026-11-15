# Security

Zynvixs runs on your own computer. This page explains what it can reach and how to report a problem.

## What Zynvixs exposes

- The app server listens on **127.0.0.1:8765** only. It is not reachable from other devices on your network. Requests with a `Host` header other than `127.0.0.1`/`localhost` are rejected (protection against DNS rebinding).
- The model engine (`llama-server`) listens on **127.0.0.1:8766** with its built-in web UI disabled. It runs as a child of Zynvixs inside a Windows job object, so it exits if Zynvixs exits or crashes.
- There is no authentication between the browser and the local server. Any program already running as your Windows user could call the local API. This is the same trust level as the files in your user folder.

## What Zynvixs sends over the network

Only when you ask for it:

1. **Deep Research:** search queries go to the selected search provider (DuckDuckGo by default), and the pages it chooses to read are downloaded. Your conversation is not sent; only the queries the research planner writes.
2. **Model downloads:** from huggingface.co when you press Download.

Offline mode blocks both. There is no telemetry, analytics or crash reporting.

## Defences in place

- Web pages are treated as untrusted data. The model has no tools while reading them, and the final report may only cite pages that were actually fetched; other links and citation numbers are removed.
- The fetcher refuses non-http(s) URLs, non-standard ports, URLs with credentials, and any host that resolves to a private, loopback, link-local, carrier-grade-NAT, multicast or reserved address (including after redirects). This prevents a web page or a model from reaching your router, local services or cloud metadata endpoints.
- Robots.txt is respected; requests to each site are spaced out.
- The calculator evaluates a restricted expression grammar, never Python code.
- The **Python tool is off by default**. When enabled it runs model-written code as your user with a 15-second limit in a temporary folder. It is **not a sandbox**; enable it only if you accept that.
- Uploaded files are parsed (text, PDF, DOCX), never executed.
- The Brave API key, if you set one, is stored in the local database and excluded from data exports.

## Reporting a vulnerability

Please do not open a public issue for security problems. Contact the maintainers privately through the repository's security advisory feature, with steps to reproduce. We aim to respond within 7 days.

## Career workspace network actions
Career job searches are explicitly initiated by the user and retrieve public listings from Remotive plus configured Greenhouse and Lever company boards. Resume/profile contents remain local: only role/keyword search text and public company board slugs are sent; ranking runs on this PC. Original listing links open externally. Offline mode blocks these API calls.

The optional Playwright browser worker opens a separate, nonpersistent Chromium context on the user's PC. This is browser control, not full desktop control. Browser requests are restricted to public HTTPS addresses, with offline-mode checks. Web pages and portal sign-ins contact those websites directly. Text answers are only filled after user input. Passwords, file uploads, consent controls, MFA and CAPTCHA are manual. Submission requires a fresh form review and explicit approval; cross-domain actions or ambiguous submit controls require manual handling. A clicked submit control does not automatically mark an application submitted. Browser state is lost when the app closes; workflow notes remain in SQLite. Do not store passwords or secrets in workflow notes.

## Studio mail and generated drafts
IMAP and SMTP connections are user-initiated and require TLS/startTLS for real accounts. Host/port/user/app-password values are read from the backend process environment, never embedded in the frontend or written by this integration to source files. OAuth-only accounts are unsupported. Inbox messages are parsed as data; HTML and remote tracking images are not rendered. Local mail caches and send history are personal workspace data and are included in an explicitly requested workspace export; credential environment values are excluded.

Draft generation uses only the loaded local model. Review every AI suggestion for factual accuracy. Mail sending requires explicit approval of a fresh hash covering the saved recipient, subject and body. Duplicate attempts for the same draft version are blocked. SMTP acceptance is not a delivery receipt; failure/time-out outcomes may be uncertain and require checking the provider before retrying. Offline mode blocks new network actions and closes browser-worker sessions; in-flight external requests cannot always be retracted.

The optional mail fixture is deliberately separate: `python -m zynvixs.mail_test_server` binds only to loopback, never relays mail, and is used only with `ZYNVIXS_MAIL_TEST=1`. That mode rejects non-loopback mail hosts and normal recipient domains. Never expose the fixture or the local application API to the Internet.
