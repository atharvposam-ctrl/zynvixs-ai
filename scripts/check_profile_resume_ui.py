"""Profile → real PDF preview → download, using the isolated UI harness."""

import asyncio
import io
import re
import httpx
from pypdf import PdfReader
from playwright.async_api import async_playwright
import check_studio_ui as harness


async def check():
    base = harness.BASE
    output = harness.SHOTS
    output.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(base_url=base) as api:
        await api.patch("/api/settings", json={"theme": "dark"})
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(
                viewport={"width": 1500, "height": 1050}, color_scheme="dark"
            )
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            await page.route(
                "**/api/career-workspace/profile",
                lambda route: (
                    route.abort("failed")
                    if route.request.method == "GET"
                    else route.continue_()
                ),
            )
            await page.goto(base)
            await page.locator(".career-nav").get_by_role(
                "button", name="Profile Builder", exact=True
            ).click()
            await page.get_by_role("alert").filter(
                has_text="Cannot reach the Zynvixs backend"
            ).wait_for()
            entries = {
                "Full name": "Zoë Candidate",
                "Resume target role": "Frontend Developer",
                "Email": "zoe@example.invalid",
                "Phone": "+1 555 010 0200",
                "City / location": "Pune",
                "Professional summary for your resume": "I build accessible interfaces using React.",
                "Education — institution, qualification, dates": "BSc Computer Science, Example College, 2024",
                "Experience — employer, role, dates, achievements": "\n".join(
                    "Practice project activity " + str(i) for i in range(75)
                ),
                "Skills": "React, TypeScript, HTML, CSS",
                "Portfolio projects — title, contribution, links": "Personal portfolio — designed and built the interface.",
            }
            for label, value in entries.items():
                await page.get_by_label(label, exact=True).fill(value)
            await page.unroute("**/api/career-workspace/profile")
            await page.get_by_role(
                "button", name="Retry loading profile", exact=True
            ).click()
            await page.get_by_role(
                "button", name="Save approved profile", exact=True
            ).wait_for(state="visible")
            assert (
                await page.get_by_label("Full name", exact=True).input_value()
                == "Zoë Candidate"
            )
            await page.route(
                "**/api/career/resumes/*/export?format=pdf&inline=true",
                lambda route: route.fulfill(
                    status=503, json={"detail": "Controlled PDF service failure"}
                ),
            )
            await page.get_by_role(
                "button", name="Save info & preview resume PDF", exact=True
            ).click()
            await page.get_by_role("alert").filter(
                has_text="Controlled PDF service failure"
            ).wait_for()
            await page.unroute("**/api/career/resumes/*/export?format=pdf&inline=true")
            await page.get_by_role(
                "button", name="Retry PDF preview", exact=True
            ).click()
            await page.locator('[data-pdf-ready="true"]').wait_for(timeout=45000)
            await page.wait_for_function(
                "document.getElementById('profile-resume-pdf').getBoundingClientRect().top < 180"
            )
            canvas = page.locator('canvas[aria-label="Resume PDF page 1"]')
            assert await canvas.evaluate(
                'c=>{const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=52)if(d[i+3]>0&&d[i]+d[i+1]+d[i+2]<200)return true;return false}'
            )
            assert await page.get_by_role(
                "button", name="Previous page", exact=True
            ).is_disabled()
            await page.get_by_role("button", name="Next page", exact=True).click()
            await page.locator('[data-pdf-ready="true"]').wait_for()
            await page.locator('canvas[aria-label="Resume PDF page 2"]').wait_for()
            await page.get_by_role("button", name="Previous page", exact=True).click()
            await page.locator('[data-pdf-ready="true"]').wait_for()
            async with page.expect_download() as event:
                await page.get_by_role(
                    "button", name="Download resume PDF", exact=True
                ).click()
            downloaded = await event.value
            path = output / "downloaded-resume.pdf"
            await downloaded.save_as(path)
            text = "\n".join(p.extract_text() for p in PdfReader(str(path)).pages)
            assert (
                "Zoë Candidate" in text
                and "zoe@example.invalid" in text
                and "React, TypeScript" in text
            )
            rows = (await api.get("/api/career/resumes")).json()
            assert len(rows) == 1
            assert (await api.get("/api/career/actions/active-resume")).json()[
                "id"
            ] == rows[0]["id"]
            await page.get_by_role(
                "button", name="Edit your information", exact=True
            ).click()
            await page.get_by_label("Full name", exact=True).fill("Revised Candidate")
            assert (
                await page.get_by_role(
                    "button", name="Download resume PDF", exact=True
                ).get_attribute("aria-disabled")
                == "true"
            )
            await page.get_by_role(
                "button", name="Save info & preview resume PDF", exact=True
            ).click()
            await page.get_by_role(
                "heading", name="Revised Candidate — Frontend Developer", exact=True
            ).wait_for()
            await page.locator('[data-pdf-ready="true"]').wait_for(timeout=45000)
            assert len((await api.get("/api/career/resumes")).json()) == 2
            await page.screenshot(path=str(output / "profile-pdf-dark-80.png"))
            await page.reload()
            await page.locator(".career-nav").get_by_role(
                "button", name="Profile Builder", exact=True
            ).click()
            await page.get_by_role(
                "button", name="View last saved PDF", exact=True
            ).wait_for()
            await page.get_by_role(
                "button", name="View last saved PDF", exact=True
            ).click()
            await page.locator('[data-pdf-ready="true"]').wait_for(timeout=45000)
            assert (
                await page.get_by_role(
                    "button", name="Download resume PDF", exact=True
                ).get_attribute("aria-disabled")
                == "false"
            )
            for theme in ["dark", "light"]:
                await api.patch("/api/settings", json={"theme": theme})
                await page.reload()
                await page.locator(".career-nav").get_by_role(
                    "button", name="Profile Builder", exact=True
                ).click()
                for scale in ["80", "100"]:
                    await page.get_by_label("Workspace zoom", exact=True).select_option(
                        scale
                    )
                    await page.get_by_role(
                        "button", name="View last saved PDF", exact=True
                    ).click()
                    await page.locator('[data-pdf-ready="true"]').wait_for(
                        timeout=45000
                    )
                    await page.wait_for_function(
                        "document.getElementById('profile-resume-pdf').getBoundingClientRect().top < 180"
                    )
                    await page.screenshot(
                        path=str(output / f"profile-pdf-{theme}-{scale}.png")
                    )
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.wait_for_timeout(250)
            await page.screenshot(path=str(output / "profile-pdf-mobile.png"))
            assert await page.evaluate(
                "document.documentElement.scrollWidth<=innerWidth+1"
            )
            assert not errors, errors
            await browser.close()
            print(
                "PASS: Profile Builder entries survive backend failure/retry; information creates real multi-page PDF without a model; local PDF.js canvas renders; pagination, exact PDF download, stale-edit protection, saved-version restore, dark/light 80/100% and mobile checks pass."
            )


if __name__ == "__main__":
    harness.main = check
    harness.run()
