# Changelog

All notable changes to Zynvixs are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.1.0-beta.12] — 2026-11-17

- Build Applications into a career command center with five working banners, actual saved-record summary counts, searchable/filterable Kanban and list views, reminders and activity history.
- Preserve legacy application records/statuses and add a Saved stage. Preparing includes existing Draft/Reviewing records; Applied continues to require explicit confirmation.
- Add a responsive details drawer with company/role/location, application and interview dates, deadlines, next actions, recruiter contacts, exact resume version, editable cover letter and notes.
- Add validated, duplicate-safe local application reminders shared with Career Dashboard, with persisted completion events and no claimed background email/OS alerts.
- Connect saved application context to profile review, linked-resume tailoring, interview preparation and the existing reviewed browser assistant. No real applications are submitted by opening a tool.

## [1.1.0-beta.11] — 2026-11-17

- Add a prominent full-width career-profile banner directly beneath empty or short Job Search results, with working Profile Builder and LinkedIn destinations.
- Keep the illustrated resume/interview posters and training strip underneath; insert the banner group after the second listing in longer result lists.
- Verify the empty-state-to-banner gap, navigation, reduced motion and White/Black/mobile layouts without changing search or stored data.

## [1.1.0-beta.10] — 2026-11-17

- Add illustrated Resume Studio and Interview Prep banners plus a wide Skills & Training banner to the Job Search results column, including its empty state.
- Replace the plain featured sidebar list with five thumbnail-style career banners linking to existing tools.
- Bundle original SVG artwork locally with gentle reduced-motion-aware animation; preserve real job listings, empty states and application actions.

## [1.1.0-beta.9] — 2026-11-17

- Refine Job Search into a centered, listing-led directory matching the supplied reference: compact count/title, category chips, smaller resume/search controls, filter pills and a narrow featured-tools sidebar.
- Reduce listing-card clutter with expandable match explanations, a bookmark save icon and a three-dot menu for tailoring, draft applications and reviewed application auto-fill.
- Keep all existing retrieval, criteria auto-fill, provider setup/status, sorting, saved history, original links and full-description workflows.
- Check filter shortcuts, menu actions, light/dark appearance, 80%/100% scale and mobile navigation with local provider fixtures.

## [1.1.0-beta.8] — 2026-11-17

- Rebuild Job Search with a compact search console, category chips, collapsible filters, listing cards, sorting, saved-job views and a career/source sidebar.
- Add local profile-and-resume auto-fill with field provenance, preservation of existing edits, explicit replacement and honest blank values for unknown or ambiguous preferences.
- Preserve genuine provider retrieval, errors, saved searches/cache, match explanations, full-description dialogs, original links, resume tailoring and draft application tracking.
- Add a per-listing Application auto-fill handoff to the existing reviewed browser assistant; opening it never submits an application.

## [1.1.0-beta.7] — 2026-11-16

- Replace legacy decorative gold/yellow with theme-aware neutral text and borders; dashboard labels, actions and icons are black in White appearance and readable in Black appearance.
- Fix Automation's outer surface, setup commands and checklist text to follow the selected appearance.
- Add searchable role-based Interview Prep recommendations and learning templates ranked by saved profile/selected-resume keyword overlap, with visible explanations and general fallback options.
- Interview recommendations populate the existing reviewed setup. Learning recommendations save editable, reusable plans with official resources or self-directed tasks and persistent progress.
- Add grouped navigation footers to Interview Prep and Skills & Training, preserving all existing workflows and data.

## [1.1.0-beta.6] — 2026-11-16

- Redesign Profile Builder with seven career tool tiles and four illustrated featured posters, preserving all existing profile and PDF workflows below the discovery area.
- Add prominent White, Black and System appearance cards directly in Settings. Persist changes through the backend and keep the previous appearance when saving fails.
- Match the existing appearance dialog labels to White/Black, deepen the black palette and use a white main workspace in white appearance.
- Keep equal poster heights, responsive horizontal scrolling, scroll-boundary controls and reduced-motion support.

## [1.1.0-beta.5] — 2026-11-16

- Add a blue-and-white career discovery theme across the workspace, with rounded navigation, cards, forms and matching blue accents in dark appearance.
- Add three animated career-profile, resume and LinkedIn banners on Home and Profile Builder, with working destinations, category selectors and previous/next/pause controls.
- Respect reduced motion, hover and keyboard focus; use original local CSS artwork with no advertising service or tracking requests.
- New workspaces start in light appearance; existing saved appearance preferences are preserved.

## [1.1.0-beta.4] — 2026-11-16

- Place Resume Studio inputs and editable text on the left and the actual saved PDF output on the right, with responsive stacked panels on mobile.
- Add 1–2, 4–5 and 12-page targets that affect AI instructions, context-aware generation budgets and PDF typography. Show actual pages; never pad or silently truncate supplied facts.
- Refresh the PDF after edits and saved-resume selection; support cancelling generation without saving partial output.
- Align the active chat thread with its composer and hide the welcome career summary during conversations.

## [1.1.0-beta.3] — 2026-11-16

- Add Profile Builder → Save info & preview resume PDF → Download resume PDF.
- Format only entered facts without requiring a language model; save each generated resume and select it for shared career workflows.
- Render actual PDF bytes locally with PDF.js, with pagination, retry, download, edit protection and saved-version restore.
- Preserve typed fields after connection failure/retry and explain how to restart the updated backend.

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
