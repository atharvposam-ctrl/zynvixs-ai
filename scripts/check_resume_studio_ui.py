"""Exercise the side-by-side resume editor with a temporary backend/database."""

import asyncio
from pathlib import Path
import httpx
from pypdf import PdfReader
from playwright.async_api import async_playwright
import check_studio_ui as harness


async def check():
    output = harness.SHOTS
    output.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        await api.patch("/api/settings", json={"theme": "dark"})
        async with async_playwright() as p:
            b = await p.chromium.launch(headless=True)
            page = await b.new_page(
                viewport={"width": 1920, "height": 1050}, color_scheme="dark"
            )
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            await page.goto(harness.BASE)
            await page.locator(".career-nav").get_by_role(
                "button", name="Resume Studio", exact=True
            ).click()
            left = page.locator(".resume-input-panel")
            right = page.get_by_role("complementary", name="Resume output", exact=True)
            await right.get_by_text(
                "Your resume preview appears here", exact=True
            ).wait_for()
            a = await left.bounding_box()
            z = await right.bounding_box()
            assert a["x"] + a["width"] <= z["x"] and abs(a["y"] - z["y"]) < 5
            source = "# Test Applicant\n\nSoftware Developer\n\n## Experience\nBuilt a Python data project and a React portfolio.\n\n## Skills\nPython, SQL, React"
            await page.get_by_label("Target role", exact=True).fill(
                "Software Developer"
            )
            await page.get_by_label("Resume source information", exact=True).fill(
                source
            )
            await page.get_by_role(
                "button", name="Generate and save AI draft", exact=True
            ).click()
            await page.get_by_role("alert").filter(
                has_text="Connect a local model"
            ).wait_for()
            assert (await api.get("/api/career/resumes")).json() == []
            for target in ["1-2", "4-5", "12"]:
                await page.get_by_label(
                    "Resume length target", exact=True
                ).select_option(target)
                async with page.expect_response(
                    lambda r: "/api/career/resumes" in r.url
                    and r.request.method == "POST"
                ) as event:
                    await page.get_by_role(
                        "button", name="Preview supplied text without AI", exact=True
                    ).click()
                row = await (await event.value).json()
                assert row["metadata"]["length_preference"] == target
                await right.locator('[data-pdf-ready="true"]').wait_for(timeout=45000)
                await right.get_by_text("Page 1 of 1", exact=True).wait_for()
                await page.screenshot(path=str(output / ("studio-" + target + ".png")))
            async with page.expect_download() as event:
                await page.get_by_role(
                    "button", name="Download resume PDF", exact=True
                ).click()
            download = await event.value
            filename = output / "studio-saved.pdf"
            await download.save_as(filename)
            assert "Test Applicant" in "".join(
                p.extract_text() for p in PdfReader(str(filename)).pages
            )
            await page.get_by_role(
                "button", name="Edit resume draft", exact=True
            ).click()
            await page.get_by_label("Editable resume text", exact=True).fill(
                source + "\n\nReviewed note based on my actual project."
            )
            assert await page.get_by_role(
                "button", name="Download resume PDF", exact=True
            ).is_disabled()
            await page.get_by_role(
                "button", name="Save edits & refresh PDF", exact=True
            ).click()
            await page.get_by_role("status").filter(
                has_text="New version saved and PDF refreshed"
            ).wait_for()
            await right.locator('[data-pdf-ready="true"]').wait_for(timeout=45000)
            assert await page.get_by_role(
                "button", name="Download resume PDF", exact=True
            ).is_enabled()
            rows = (await api.get("/api/career/resumes")).json()
            assert len(rows) == 4 and rows[0]["metadata"]["parent_id"] == rows[1]["id"]

            await page.get_by_role(
                "button", name="Select resume", exact=True
            ).last.click()
            await page.wait_for_function(
                "document.querySelector('[aria-label=\"Resume length target\"]').value === '1-2'"
            )
            await right.locator('[data-pdf-ready="true"]').wait_for(timeout=45000)

            # UI cancellation is tested with a controlled pending request; no model is impersonated in the product.
            async def slow(route):
                await asyncio.sleep(2)
                try:
                    await route.fulfill(
                        status=503, json={"detail": "Controlled pending request"}
                    )
                except Exception:
                    pass

            await page.route("**/api/career/actions/resume", slow)
            await page.get_by_role(
                "button", name="Generate and save AI draft", exact=True
            ).click()
            await page.get_by_role(
                "button", name="Cancel generation", exact=True
            ).click()
            await page.get_by_role("status").filter(
                has_text="Generation cancelled in this view"
            ).wait_for()
            await page.unroute("**/api/career/actions/resume")
            assert len((await api.get("/api/career/resumes")).json()) == 4
            for scale in ["80", "100"]:
                await page.get_by_label("Workspace zoom", exact=True).select_option(
                    scale
                )
                a = await left.bounding_box()
                z = await right.bounding_box()
                assert a["x"] + a["width"] <= z["x"]
                await page.screenshot(
                    path=str(output / ("studio-dark-" + scale + ".png"))
                )
            await api.patch("/api/settings", json={"theme": "light"})
            await page.reload()
            await page.locator(".career-nav").get_by_role(
                "button", name="Resume Studio", exact=True
            ).click()
            await right.locator('[data-pdf-ready="true"]').wait_for(timeout=45000)
            await page.screenshot(path=str(output / "studio-light.png"))
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.wait_for_timeout(200)
            a = await left.bounding_box()
            z = await right.bounding_box()
            assert z["y"] > a["y"]
            assert await page.evaluate(
                "document.documentElement.scrollWidth<=innerWidth+1"
            )
            await right.scroll_into_view_if_needed()
            await page.screenshot(path=str(output / "studio-mobile.png"))
            # Controlled saved-history fixture exercises chat geometry without claiming model output.
            conversation = {
                "id": "layout-fixture",
                "title": "Controlled chat layout",
                "kind": "chat",
                "project_id": None,
                "created_at": 1,
                "updated_at": 1,
            }
            messages = [
                {
                    "id": str(i),
                    "conversation_id": "layout-fixture",
                    "role": role,
                    "content": text,
                    "reasoning": "",
                    "mode": "fast",
                    "model_id": "",
                    "steps": [],
                    "sources": [],
                    "metrics": {},
                    "attachments": [],
                    "status": "complete",
                    "created_at": i + 1,
                }
                for i, (role, text) in enumerate(
                    [
                        ("user", "Controlled layout test"),
                        (
                            "assistant",
                            "Saved-history fixture used only to verify the interface layout.",
                        ),
                    ]
                )
            ]
            await page.route(
                "**/api/conversations",
                lambda route: route.fulfill(
                    json={"conversations": [conversation], "projects": []}
                ),
            )
            await page.route(
                "**/api/conversations/layout-fixture",
                lambda route: route.fulfill(
                    json={
                        "conversation": conversation,
                        "messages": messages,
                        "documents": [],
                    }
                ),
            )
            await page.set_viewport_size({"width": 1920, "height": 1050})
            await api.patch("/api/settings", json={"theme": "dark"})
            await page.reload()
            await page.locator(".career-nav").get_by_role(
                "button", name="Controlled chat layout", exact=True
            ).click()
            await page.get_by_text(
                "Saved-history fixture used only to verify the interface layout.",
                exact=True,
            ).wait_for()
            assert await page.locator(".career-summary").count() == 0
            for scale in ["80", "100"]:
                await page.get_by_label("Workspace zoom", exact=True).select_option(
                    scale
                )
                aligned = await page.evaluate(
                    """()=>{const a=document.querySelector('.thread-inner'),b=document.querySelector('.home-composer .composer-wrap'),s=Number(document.querySelector('[aria-label="Workspace zoom"]').value)/100;const x=a.getBoundingClientRect(),y=b.getBoundingClientRect(),pad=parseFloat(getComputedStyle(a).paddingLeft)*s;return Math.abs(x.x+pad-y.x)<3&&Math.abs(x.width-2*pad-y.width)<3}"""
                )
                assert aligned
                await page.screenshot(
                    path=str(output / ("chat-aligned-" + scale + ".png"))
                )
            assert not errors, errors
            await b.close()
            print(
                "PASS: editor left/PDF right, real PDF download, 1–2/4–5/12-page targets saved, short content not padded, draft edits refresh output, cancellation, 80/100% desktop and stacked mobile layouts."
            )


if __name__ == "__main__":
    harness.main = check
    harness.run()
