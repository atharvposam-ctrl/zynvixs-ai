"""Check local marketing banner controls, navigation, motion and responsive theme."""
import asyncio
import httpx
from playwright.async_api import async_playwright
import check_studio_ui as harness

async def check():
    harness.SHOTS.mkdir(parents=True, exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width":1672,"height":1050})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.goto(harness.BASE)
                await page.locator('.career-nav').get_by_role('button',name='Home',exact=True).click()
                banner=page.get_by_role('region',name='AI career inspiration')
                await banner.get_by_role('button',name='Pause career banners',exact=True).click()
                await banner.get_by_role('button',name='Next career banner',exact=True).click()
                await banner.get_by_role('heading',name='Make your experience stand out.',exact=True).wait_for()
                await banner.get_by_role('button',name='Open Resume Studio',exact=True).click()
                await page.get_by_role('complementary',name='Resume output',exact=True).wait_for()
                await page.locator('.career-nav').get_by_role('button',name='Home',exact=True).click()
                banner=page.get_by_role('region',name='AI career inspiration')
                await banner.get_by_role('button',name='Build my profile',exact=True).click()
                await page.get_by_label('Full name',exact=True).wait_for()
                await page.locator('.career-nav').get_by_role('button',name='Home',exact=True).click()
                await page.wait_for_timeout(600)
                await page.locator('.career-main').evaluate('(el)=>el.scrollTo({top:0,behavior:"instant"})')
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await page.screenshot(path=str(harness.SHOTS/f'banners-{theme}-{scale}.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            await page.emulate_media(reduced_motion='reduce')
            assert await page.locator('.promo-document').evaluate('(el)=>getComputedStyle(el).animationName') == 'none'
            await page.set_viewport_size({'width':390,'height':844})
            await page.screenshot(path=str(harness.SHOTS/'banners-mobile.png'))
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            assert not errors,errors
            await browser.close()
    print('PASS: banner next/pause, destination navigation, profile navigation, light/dark 80/100%, 390px mobile and reduced motion; no JS errors.')

if __name__=='__main__':
    harness.main=check
    harness.run()
