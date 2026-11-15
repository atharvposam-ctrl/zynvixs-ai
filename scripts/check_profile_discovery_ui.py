"""Profile discovery and persistent White/Black choices, using temporary user data."""
import asyncio
import httpx
from playwright.async_api import async_playwright
import check_studio_ui as harness

async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        async with async_playwright() as p:
            browser=await p.chromium.launch()
            page=await browser.new_page(viewport={'width':1772,'height':1100})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            async def nav(name):
                if not await page.locator('.career-nav').get_by_role('button',name=name,exact=True).first.is_visible():
                    await page.get_by_role('button',name='Toggle navigation',exact=True).click()
                await page.locator('.career-nav').get_by_role('button',name=name,exact=True).first.click()
            await page.goto(harness.BASE)
            await nav('Settings')
            appearance=page.get_by_role('region',name='Workspace appearance',exact=True)
            for label,theme in [('White','light'),('Black','dark')]:
                await appearance.get_by_role('button',name=label,exact=False).click()
                await page.get_by_role('status').filter(has_text='Appearance saved').wait_for()
                assert (await api.get('/api/settings')).json()['theme']==theme
                await page.reload()
                await page.wait_for_function(f'document.documentElement.dataset.theme === "{theme}"')
                await nav('Settings')
                assert await appearance.get_by_role('button',name=label,exact=False).get_attribute('aria-pressed')=='true'
                await page.screenshot(path=str(harness.SHOTS/f'settings-{theme}.png'))
                await nav('Profile Builder')
                region=page.get_by_role('region',name='Profile career toolkit',exact=True)
                await region.get_by_role('button',name='Fill in my details',exact=True).click()
                assert await page.get_by_label('Full name',exact=True).evaluate('(e)=>e===document.activeElement')
                await page.get_by_label('Full name',exact=True).fill('Local Test Candidate')
                await page.wait_for_timeout(650)
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await page.locator('.career-main').evaluate('(e)=>e.scrollTo({top:0,behavior:"instant"})')
                    await page.screenshot(path=str(harness.SHOTS/f'profile-discovery-{theme}-{scale}.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await region.get_by_role('button',name='Create my resume',exact=True).click()
                await page.get_by_role('complementary',name='Resume output',exact=True).wait_for()
                await nav('Settings')
            await page.route('**/api/settings',lambda r:r.fulfill(status=503,json={'detail':'Controlled settings failure'}) if r.request.method=='PATCH' else r.continue_())
            await appearance.get_by_role('button',name='White',exact=False).click()
            await page.get_by_role('alert').filter(has_text='Controlled settings failure').wait_for()
            assert await page.evaluate('document.documentElement.dataset.theme')=='dark'
            assert await appearance.get_by_role('button',name='Black',exact=False).get_attribute('aria-pressed')=='true'
            await page.unroute('**/api/settings')
            await appearance.get_by_role('button',name='System',exact=False).click()
            await page.get_by_role('status').filter(has_text='Appearance saved').wait_for()
            await page.emulate_media(color_scheme='light',reduced_motion='reduce')
            await page.wait_for_function('document.documentElement.dataset.theme === "light"')
            await nav('Profile Builder')
            assert await page.locator('.poster-sheet').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
            await page.set_viewport_size({'width':390,'height':844})
            await page.locator('.career-main').evaluate('(e)=>e.scrollTo({top:0,behavior:"instant"})')
            await page.screenshot(path=str(harness.SHOTS/'profile-discovery-mobile.png'))
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            await page.get_by_role('button',name='Next featured tools',exact=True).click()
            await page.wait_for_timeout(200)
            assert await page.locator('.profile-featured-track').evaluate('(e)=>e.scrollLeft>0')
            await nav('Settings')
            await page.screenshot(path=str(harness.SHOTS/'settings-appearance-mobile.png'))
            assert not errors,errors
            await browser.close()
    print('PASS: White/Black persisted across reload, System follows device, failed save preserves appearance, profile tiles/poster destinations, desktop 80/100%, mobile overflow/carousel and reduced motion; no JS errors.')

if __name__=='__main__':
    harness.main=check
    harness.run()
