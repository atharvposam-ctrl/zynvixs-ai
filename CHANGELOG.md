# Changelog

All notable changes to Zynvixs are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0-beta.2] — 2026-11-15

- Replace generic career note forms with structured profile, LinkedIn, interview, learning, application, email, project and settings workflows.
- Add section-based resume editing, preview and version lineage, while preserving PDF/DOCX export and the shared active resume.
- Add reviewed IMAP/SMTP workflows with backend environment credentials, controlled local mail fixtures, outcome history and duplicate-attempt blocking.
- Add application status history, verified-submission gating, Kanban/list views, project archiving/associations and career-inclusive workspace export.
- Persist saved search criteria/cache, use current profile values for matching, and close browser sessions in offline mode.
- Preserve existing chat, document, model, memory and keyboard behavior; check light/dark, 80%/100% and mobile layouts.
- Serialize career queries using the existing SQLite lock and buffer query results before releasing it; verify parallel collection reads with a regression test.
- AI inference needs a configured local model. Real-provider email, OAuth-only accounts, scheduled/full-PC automation and complex portals have the limits documented in STUDIO_WORKFLOWS.md. No antivirus certification is claimed.

## [1.0.0] — 2026-11-13

First public release.

### App
- Local chat with streaming, stop and regenerate, running open-weight models through llama.cpp (CUDA or CPU).
- **Fast**, **Think** (plan → solve with a real calculator → independent check → fix) and **Deep Research** (web search, page reading, cited report with only real, fetched sources).
- Documents (text, code, CSV, JSON, PDF, DOCX) indexed locally and quoted with file and page.
- Long-term memory you can view, edit, disable, delete and export.
- Projects, search, research history, Markdown/JSON export, light and dark themes, keyboard shortcuts, phone-width layout.
- Hardware detection with Lite / Balanced / High profiles, load fallback, idle unload, in-app model downloads with pause/resume.
- Per-reply measured metrics: speed, latency, tokens, peak VRAM and RAM.
- Privacy: everything binds to 127.0.0.1; offline mode; no telemetry; SSRF-safe web fetching.

### Models
- Catalog: Qwen3.5 9B (default), Qwen3.5 4B, Qwen3.5 2B, gpt-oss 20B (optional, needs 24 GB+ RAM).
- **Zynvixs Adapter 0.2** — the project's own LoRA fine-tune on Qwen3.5 4B (experimental): reliable calculator use and better Hinglish, general maths and code within noise of the base. Adapter 0.1 was withdrawn before release after it was found to reduce maths accuracy.

### Quality
- 80 unit tests, 17 end-to-end checks against a real model, benchmark and evaluation harnesses with published results (`docs/MODEL_RESEARCH.md`).
