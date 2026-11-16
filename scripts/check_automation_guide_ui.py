"""Check Automation guide handoffs and layout without starting external browser sessions."""
import asyncio
import httpx
from playwright.async_api import async_playwright
import check_studio_ui as harness

async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        async with async_playwright() as p:
            b=await p.chromium.launch()
            page=await b.new_page(viewport={'width':1772,'height':1100})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            async def nav(name):
                button=page.locator('.career-nav').get_by_role('button',name=name,exact=True).first
                if not await button.is_visible():await page.get_by_role('button',name='Toggle navigation',exact=True).click()
                await button.click()
            await page.goto(harness.BASE)
            await nav('Automation')
            await page.get_by_role('button',name='Open browser workspace',exact=True).click()
            assert await page.locator('#automation-browser-workspace').evaluate('(e)=>e===document.activeElement')
            assert await page.get_by_role('button',name='Open selected job in dedicated browser',exact=True).is_disabled()
            for label,destination in [('Review my profile','Profile Builder'),('Prepare my resume','Resume Studio'),('Find jobs to prepare','Job Search'),('Open application tracker','Applications')]:
                await page.get_by_role('button',name=label,exact=True).click()
                await page.get_by_role('heading',name=destination,exact=True).first.wait_for()
                await nav('Automation')
            portals=page.locator('.automation-portal-grid')
            assert await portals.get_by_role('link').count()==4
            assert 'naukri.com' in await portals.get_by_role('link',name='Open Naukri',exact=True).get_attribute('href')
            assert await page.get_by_text('Dedicated browser session · Full-PC control is not available',exact=True).is_visible()
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.reload()
                await nav('Automation')
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await page.locator('.career-main').evaluate('(e)=>e.scrollTo({top:0,behavior:"instant"})')
                    await page.screenshot(path=str(harness.SHOTS/f'automation-guide-{theme}-{scale}.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':390,'height':844})
                await page.wait_for_timeout(300)
                await page.screenshot(path=str(harness.SHOTS/f'automation-guide-{theme}-mobile.png'))
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':1772,'height':1100})
                await page.wait_for_timeout(300)
            await page.emulate_media(reduced_motion='reduce')
            assert await page.locator('.automation-banner-art').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
            assert not errors,errors
            await b.close()
    print('PASS: browser-workspace focus, missing-job gate, banner destinations, outbound portal labels, full-PC limitation, White/Black 80/100%, mobile and reduced motion. No external portals visited and no applications submitted.')

if __name__=='__main__':
    harness.main=check
    harness.run()
