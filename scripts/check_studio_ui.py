"""Acceptance checks against an isolated development database on :8877 only."""

import asyncio, json, re
from pathlib import Path
import httpx
from playwright.async_api import async_playwright

BASE = ""
SHOTS = Path(".")


async def main():
    async with httpx.AsyncClient(base_url=BASE) as api:
        await api.patch("/api/settings", json={"theme": "dark"})
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(
                viewport={"width": 1672, "height": 1050}, color_scheme="dark"
            )
            errors = []
            http_errors = []
            page.on(
                "response",
                lambda response: (
                    http_errors.append(str(response.status) + " " + response.url)
                    if response.status >= 500
                    else None
                ),
            )
            page.on(
                "pageerror",
                lambda e: (errors.append(str(e)), print("JS ERROR", str(e))),
            )

            async def nav(name):
                button = (
                    page.locator(".career-nav")
                    .get_by_role("button", name=name, exact=True)
                    .first
                )
                if not await button.is_visible():
                    await page.get_by_role(
                        "button", name="Toggle navigation", exact=True
                    ).click()
                await button.click()
                await page.wait_for_timeout(200)
                if name not in ["Home", "Career Dashboard"]:
                    await page.get_by_role(
                        "heading", name=name, exact=True
                    ).first.wait_for()

            await page.goto(BASE)
            await page.get_by_role("button", name="New chat", exact=True).wait_for()
            await nav("Profile Builder")
            for label, text in [
                ("Full name", "Test Applicant"),
                ("Email", "test@example.invalid"),
                ("City / location", "Pune"),
                ("Skills", "Python and SQL"),
                (
                    "Education — institution, qualification, dates",
                    "BSc, Example University, 2024",
                ),
                (
                    "Career preferences — roles, locations, remote work, salary",
                    "Python developer; remote",
                ),
            ]:
                await page.get_by_label(label, exact=True).fill(text)
            await page.get_by_role(
                "button", name="Save approved profile", exact=True
            ).click()
            await page.get_by_role("status").filter(
                has_text="Profile saved locally"
            ).wait_for()
            await page.reload()
            await nav("Profile Builder")
            assert (
                await page.get_by_label("Full name", exact=True).input_value()
                == "Test Applicant"
            )
            assert (await api.get("/api/career-workspace/profile")).json()[
                "completion"
            ] == 100
            await nav("Resume Studio")
            await page.get_by_label("Import resume", exact=True).set_input_files(
                {
                    "name": "studio-test.txt",
                    "mimeType": "text/plain",
                    "buffer": b"# Test Applicant\nPython and SQL developer. 3 years experience.",
                }
            )
            await page.get_by_role(
                "heading", name="studio-test.txt", exact=False
            ).first.wait_for()
            resumes = (await api.get("/api/career/resumes")).json()
            resume = resumes[0]
            await page.get_by_role("button", name="Edit version", exact=True).click()
            await page.locator("form").filter(has=page.get_by_role("button", name="Save new version", exact=True)).get_by_text("Edit resume sections & preview", exact=True).click()
            await page.locator("form").filter(has=page.get_by_role("button", name="Save new version", exact=True)).get_by_label("Resume section 1 content", exact=True).fill(
                "Python developer.\n\nSQL analysis project."
            )
            assert (
                "\n\n"
                in await page.locator("form").filter(has=page.get_by_role("button", name="Save new version", exact=True)).get_by_label(
                    "Resume section 1 content", exact=True
                ).input_value()
            )
            await page.get_by_role(
                "button", name="Save new version", exact=True
            ).click()
            await page.get_by_role(
                "heading", name="studio-test.txt — revised", exact=False
            ).first.wait_for()
            assert (await api.get("/api/career/resumes")).json()[0]["metadata"][
                "parent_id"
            ] == resume["id"]
            for format in ["pdf", "docx"]:
                assert (
                    await api.get(
                        "/api/career/resumes/" + resume["id"] + "/export",
                        params={"format": format},
                    )
                ).status_code == 200
            await nav("LinkedIn Optimizer")
            await page.get_by_label("Target role", exact=True).fill("Python Developer")
            await page.get_by_label("About", exact=True).fill(
                "I built a Python project."
            )
            await page.get_by_role(
                "button", name="Generate profile improvements", exact=True
            ).click()
            await page.get_by_role("alert").filter(
                has_text="Load a local model"
            ).wait_for()
            fixture = {
                "original": {
                    "headline": "Python learner",
                    "about": "Personal project",
                    "experience": "",
                },
                "proposed": {
                    "headline": "Python developer | Personal projects",
                    "about": "I built a personal Python project.",
                    "experience": "[Add details]",
                    "explanations": ["Clarifies the target skill."],
                    "keywords": ["Python"],
                },
            }
            await api.post(
                "/api/career/linkedin",
                json={
                    "title": "Controlled LinkedIn draft",
                    "content": json.dumps(fixture),
                },
            )
            await nav("Home")
            await nav("LinkedIn Optimizer")
            await page.get_by_role("button", name="Open version", exact=True).click()
            await page.get_by_label("Proposed headline", exact=True).fill(
                "Reviewed Python headline"
            )
            await page.get_by_role(
                "button", name="Save edited version", exact=True
            ).click()
            await page.get_by_role("status").filter(
                has_text="New version saved"
            ).wait_for()
            assert len((await api.get("/api/career/linkedin")).json()) == 2
            session = (
                await api.post(
                    "/api/career/interviews",
                    json={
                        "title": "Controlled interview",
                        "resume_id": resume["id"],
                        "content": json.dumps(
                            {
                                "questions": ["Explain your Python project."],
                                "answers": [],
                                "summary": None,
                            }
                        ),
                    },
                )
            ).json()
            await nav("Interview Prep")
            await page.get_by_role(
                "heading", name="Controlled interview", exact=True
            ).wait_for()
            await page.get_by_role(
                "button", name="Resume / review session", exact=True
            ).click()
            await page.get_by_label("Your answer", exact=True).fill(
                "I built a Python data analysis project."
            )
            await page.get_by_role(
                "button", name="Save answer and get feedback", exact=True
            ).click()
            await page.get_by_role("alert").filter(
                has_text="Load a local model"
            ).wait_for()
            assert (
                await page.get_by_label("Your answer", exact=True).input_value()
                == "I built a Python data analysis project."
            )
            await nav("Skills & Training")
            await page.get_by_label("Or add a manual learning goal", exact=True).fill(
                "SQL practice"
            )
            await page.get_by_role(
                "button", name="Create learning goal", exact=True
            ).click()
            await page.get_by_label("Practice evidence / notes", exact=True).fill(
                "Completed local SQL exercises."
            )
            await page.get_by_label(
                "I completed this lesson / practice task", exact=True
            ).check()
            await page.get_by_role(
                "button", name="Save learning progress", exact=True
            ).click()
            await page.wait_for_timeout(300)
            assert (await api.get("/api/career/learning")).json()[0]["complete"]
            await nav("Applications")
            await page.get_by_role(
                "button", name="Track an application manually", exact=True
            ).click()
            await page.get_by_label("Role and company", exact=True).fill(
                "Controlled application — no external submission"
            )
            await page.get_by_label("Original listing URL / details", exact=True).fill(
                "https://example.invalid/jobs/test"
            )
            await page.get_by_label("Resume version", exact=True).select_option(
                resume["id"]
            )
            await page.get_by_label("Deadline / follow-up date", exact=True).fill(
                "2026-12-01"
            )
            await page.get_by_role(
                "button", name="Save application details", exact=True
            ).click()
            await page.get_by_role("status").filter(
                has_text="Application details saved"
            ).wait_for()
            await page.get_by_role("button", name="Close details", exact=True).click()
            page.once("dialog", lambda d: d.accept())
            await page.get_by_label("Status", exact=True).select_option("submitted")
            await page.get_by_role("status").filter(
                has_text="Application status saved"
            ).wait_for()
            record = (await api.get("/api/career/applications")).json()[0]
            assert (
                record["status"] == "submitted"
                and len(record["metadata"]["history"]) == 2
            )
            await nav("Projects")
            await page.get_by_label("Project name", exact=True).fill(
                "Studio acceptance project"
            )
            await page.locator(".career-main").get_by_role(
                "button", name="Create project", exact=True
            ).click()
            await page.get_by_role(
                "heading", name="Studio acceptance project", exact=True
            ).first.wait_for()
            await page.get_by_role(
                "button", name="Open project", exact=True
            ).first.click()
            await page.get_by_label("Saved item", exact=True).select_option(
                resume["id"]
            )
            await page.get_by_role(
                "button", name="Associate with this project", exact=True
            ).click()
            await page.get_by_role(
                "heading", name="studio-test.txt · resumes", exact=True
            ).wait_for()
            await nav("Email Agent")
            await page.get_by_role(
                "button", name="Test SMTP connection", exact=True
            ).click()
            await page.get_by_role("alert").filter(
                has_text="SMTP is not configured"
            ).wait_for()
            await page.get_by_role(
                "button", name="Compose manually", exact=True
            ).click()
            await page.get_by_label("Recipient email", exact=True).fill(
                "recipient@example.invalid"
            )
            await page.get_by_label("Subject", exact=True).fill("Local test draft")
            await page.get_by_label("Message", exact=True).fill(
                "No email will be sent from this UI test."
            )
            await page.get_by_role("button", name="Save draft", exact=True).click()
            await page.get_by_role("status").filter(
                has_text="Draft saved locally"
            ).wait_for()
            await page.get_by_role(
                "button", name="Review saved draft for sending", exact=True
            ).click()
            await page.get_by_role(
                "heading", name="Final send review", exact=True
            ).wait_for()
            assert await page.get_by_role(
                "button", name="Send approved email", exact=True
            ).is_disabled()
            assert (await api.get("/api/career/mail_history")).json() == []
            await nav("Settings")
            await page.get_by_role(
                "button", name=re.compile("General appearance")
            ).click()
            await page.get_by_role("radio", name="White", exact=True).click()
            await page.wait_for_function(
                "document.documentElement.dataset.theme === 'light'"
            )
            await page.get_by_role("button", name="Close settings", exact=True).click()
            pages = [
                "Home",
                "Career Dashboard",
                "Profile Builder",
                "Resume Studio",
                "Job Search",
                "Applications",
                "LinkedIn Optimizer",
                "Interview Prep",
                "Skills & Training",
                "Email Agent",
                "Automation",
                "Projects",
                "Settings",
            ]
            shots = SHOTS
            shots.mkdir(parents=True, exist_ok=True)
            for theme in ["light", "dark"]:
                await api.patch("/api/settings", json={"theme": theme})
                await page.reload()
                for scale in ["80", "100"]:
                    await page.get_by_label("Workspace zoom", exact=True).select_option(
                        scale
                    )
                    for name in pages:
                        await nav(name)
                        await page.wait_for_timeout(120)
                        assert await page.evaluate(
                            "document.documentElement.scrollWidth <= innerWidth+1"
                        ), (theme, scale, name)
                        await page.screenshot(
                            path=str(
                                shots
                                / (
                                    theme
                                    + "-"
                                    + scale
                                    + "-"
                                    + name.replace("/", "-")
                                    + ".png"
                                )
                            )
                        )
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.wait_for_timeout(300)
            for name in pages:
                await nav(name)
                await page.wait_for_timeout(120)
                assert await page.evaluate(
                    "document.documentElement.scrollWidth <= innerWidth+1"
                ), name
                await page.screenshot(
                    path=str(shots / ("mobile-" + name.replace("/", "-") + ".png"))
                )
            assert not errors, errors
            assert not http_errors, http_errors
            await browser.close()
            print(
                "PASS: all 13 pages in light/dark at 80/100%, mobile 390px, profile persistence, resume import/export, LinkedIn version edits, interview missing-model recovery, learning progress, application confirmation/history, project association, email missing credentials and send-review gate. No JS errors; no real messages or applications sent."
            )


def run():
    import argparse, os, socket, subprocess, sys, tempfile, time

    parser = argparse.ArgumentParser(
        description="Run career UI checks with a temporary database and no mail credentials."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "work" / "studio-check-artifacts",
    )
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if not (root / "frontend" / "dist" / "index.html").exists():
        raise SystemExit("Build frontend first: cd frontend; npm ci; npm run build")
    with tempfile.TemporaryDirectory(prefix="zynvixs_ui_check_") as temp:
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        env = {
            k: v
            for k, v in os.environ.items()
            if not k.startswith(("ZYNVIXS_MAIL_", "ZYNVIXS_SMTP_", "ZYNVIXS_IMAP_"))
        }
        env.update(
            {
                "ZYNVIXS_DATA": str(Path(temp) / "data"),
                "ZYNVIXS_MODELS": str(Path(temp) / "models"),
                "ZYNVIXS_ROOT": str(root),
                "PYTHONPATH": str(root / "backend"),
            }
        )
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "zynvixs.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
                "--no-access-log",
            ],
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.STDOUT,
        )
        global BASE, SHOTS
        BASE = f"http://127.0.0.1:{port}"
        SHOTS = args.output
        try:
            for attempt in range(100):
                if process.poll() is not None:
                    raise RuntimeError(
                        "Isolated backend did not start. Check installed backend dependencies."
                    )
                try:
                    if (
                        httpx.get(BASE + "/api/career/profile", timeout=1).status_code
                        == 200
                    ):
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Isolated backend startup timed out.")
            asyncio.run(main())
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    run()
