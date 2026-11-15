# Career workspace update

## Start on Windows

1. Keep a backup of your existing `data` folder and leave your `models` folder intact. The career schema is additive; it does not replace conversation, document, settings or project tables.
2. Install Python 3.12 with **Add Python to PATH** selected.
3. Extract the updated application ZIP into a separate folder. If moving an existing workspace, copy your `data` and `models` folders into it without deleting the originals. Alternatively set `ZYNVIXS_DATA` and `ZYNVIXS_MODELS` to their existing locations.
4. Run `Setup.bat`, then `Zynvixs.bat`. The application opens at http://127.0.0.1:8765 . The application ZIP includes a built frontend. A source checkout requires Node.js 22+ to build it.
5. Use Settings → Models to install/load a model. The existing inference integration is llama.cpp, not Ollama. AI resume generation requires a loaded model.
6. Workspace scale defaults to 80%; use the top-bar selector for 100%. This changes only the app and persists in this browser.

## Resume workflow

Resume Studio imports selectable-text PDF, DOCX, TXT and Markdown using the existing parser. Scanned or encrypted PDFs show an error; OCR is not bundled. Select a resume to share it with Job Search. Use the selected resume or saved profile as AI input, enter a target role and optional job description, and generate a draft. The model is instructed to use supplied facts only; review the result for factual accuracy. Editing saves a new version. Export saved versions as PDF or DOCX; unsaved edits must be saved before export. PDF uses an installed system font when available; check rendering for scripts not supported by that font.

## Genuine job retrieval

Job Search lets you review extracted skills/experience mentions and suggested roles, then edit criteria before searching. The extraction and compatibility estimate are rule-based, not a hiring prediction. Salary, dates and restrictions remain unknown when the provider does not supply them.

- Remotive public API: enabled on search; listings are attributed with original URLs.
- Greenhouse: enter a real employer board slug, for example `stripe`.
- Lever: enter a real employer slug, for example `palantir`.
- LinkedIn, Indeed and Naukri: outbound portal links only, not result integrations.

Role, keywords, company, location, arrangement, experience phrase, job type, source and date filters run against retrieved information. Unspecified arrangement is not assumed to be on-site. Deduplication combines title/company/location equivalents and retains source links. Provider failures are shown individually; other providers can still return results. Results are capped at 150. A saved job retains its source description. Changing the selected resume clears current search results. Applications start in Draft; opening a listing or clicking a website submit control never marks them Submitted. Only update that status after verifying the website's confirmation.

## Optional browser assistant

In PowerShell at the project root:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements-browser.txt
.\.venv\Scripts\python.exe -m playwright install chromium
```

Choose a retrieved job → Open browser assistant → Open selected job in dedicated browser. Zynvixs must stay running on a PC with a visible desktop. This opens a separate nonpersistent Chromium session, not full desktop control. Navigate to the form in the browser and read its fields. Supply truthful answers, fill only the values you entered, review the website including attachments and consent, then explicitly approve submission. Passwords, uploads, checkbox/radio controls, login, MFA and CAPTCHA are manual. The worker only attempts a single unambiguous same-site submit control. Multi-domain redirects, complex or dynamic forms may require fully manual completion. Browser actions are not a universal job-portal integration.

A changed reviewed form requires fresh review. Cancel closes the session. Browser sessions do not survive app restarts. Workflow notes persist. Scheduled or unattended runs are not implemented. Never store passwords, OTPs or API keys in ordinary notes.

## Verification completed in Linux development environment

- 91 backend tests passed, including existing chat/document/model tests and new career tests.
- New tests cover DOCX import, PDF/DOCX read-back, malformed files, active resume persistence, profile and learning persistence, multi-provider deduplication and failure handling, matching explanations, saved jobs, application status, missing models/browser package and offline search.
- The browser worker was tested against a local HTTP form with test-only loopback access. It filled test answers, blocked unapproved submission, rejected a changed review, and submitted only after explicit approval. No real job application or email was sent.
- Live read-only checks: Remotive returned 16 listings; Stripe Greenhouse returned 785; Palantir Lever returned 302. A nonexistent Lever board produced a reported 404. Counts are observations from verification, not UI fixtures.
- TypeScript/production build passed. Headless Chromium checks covered desktop 80%/100%, 390px/900px widths, profile save/reload, resume import, missing-model error, extracted criteria and page navigation without JavaScript errors. Desktop screenshots were inspected against the supplied visual reference; it is an adaptation, not a pixel-identical copy.

## Limits and external setup

No local inference model was available in development, so AI draft generation was tested using a controlled model stream plus the disconnected-model path, not a real model response. Install/load your model to use generation. Portal availability and terms remain provider-dependent; review each site's requirements. No email sending integration or full-PC agent is included. Interview and LinkedIn pages remain local notes workflows, not automated scoring or optimization engines. No claim is made that these features are complete career-agent automation.

The earlier antivirus detection is unresolved: the threat name and affected file have not been provided. Builds and functional tests do not prove malware safety. Do not bypass antivirus warnings.
