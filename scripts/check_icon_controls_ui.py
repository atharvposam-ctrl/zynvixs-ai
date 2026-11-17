"""Check icon centering and real upload/settings actions against temporary user data."""
import asyncio
import httpx
from playwright.async_api import async_playwright
import check_studio_ui as harness

async def centered(locator):
    await locator.wait_for()
    value=await locator.evaluate('''e=>{const b=e.getBoundingClientRect(),s=e.querySelector('svg').getBoundingClientRect(),c=getComputedStyle(e);return {dx:Math.abs((b.left+b.right-s.left-s.right)/2),dy:Math.abs((b.top+b.bottom-s.top-s.bottom)/2),inside:s.left>=b.left&&s.right<=b.right&&s.top>=b.top&&s.bottom<=b.bottom,padding:c.padding};}''')
    assert value['dx']<1 and value['dy']<1 and value['inside'] and value['padding']=='0px',value

async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        async with async_playwright() as p:
            b=await p.chromium.launch()
            page=await b.new_page(viewport={'width':1915,'height':1000})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.goto(harness.BASE)
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await centered(page.get_by_role('button',name='Attach files',exact=True))
                    await centered(page.get_by_role('button',name='Send message',exact=True))
                    await page.locator('.composer').screenshot(path=str(harness.SHOTS/f'composer-{theme}-{scale}.png'))
                    await page.locator('.career-nav button[aria-label="Settings"]').click()
                    dialog=page.get_by_role('dialog',name='Settings',exact=True)
                    await centered(dialog.get_by_role('button',name='Close settings',exact=True))
                    switch=dialog.get_by_role('switch',name='Show model reasoning',exact=True)
                    before=await switch.get_attribute('aria-checked')
                    async with page.expect_response(lambda r:r.url.endswith('/api/settings') and r.request.method=='PATCH') as saved:
                        await switch.click()
                    assert (await saved.value).status==200
                    assert (await api.get('/api/settings')).json()['show_reasoning']==(before!='true')
                    assert await switch.evaluate('(e)=>getComputedStyle(e).padding')=='0px'
                    await dialog.screenshot(path=str(harness.SHOTS/f'settings-{theme}-{scale}.png'))
                    await dialog.get_by_role('button',name='Close settings',exact=True).click()
                    await dialog.wait_for(state='detached')
            async with page.expect_file_chooser() as event:
                await page.get_by_role('button',name='Attach files',exact=True).click()
            await (await event.value).set_files({'name':'alignment-test.txt','mimeType':'text/plain','buffer':b'Controlled attachment UI test.'})
            remove=page.get_by_role('button',name='Remove alignment-test.txt',exact=True)
            await centered(remove)
            await remove.click()
            await remove.wait_for(state='detached')
            await page.set_viewport_size({'width':390,'height':844})
            await page.wait_for_timeout(300)
            await centered(page.get_by_role('button',name='Attach files',exact=True))
            await centered(page.get_by_role('button',name='Send message',exact=True))
            await page.locator('.composer').screenshot(path=str(harness.SHOTS/'composer-mobile.png'))
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            # Only model availability is a local UI fixture. Chat requests are captured,
            # rejected deliberately, and never execute inference or contact a recipient.
            await page.route('**/api/models',lambda r:r.fulfill(json={'models':[{'id':'alignment-fixture','name':'UI fixture','installed':True,'loaded':False,'compatibility':{'level':'ok','message':'Controlled UI fixture'}}]}))
            calls=[]
            async def capture(route):
                calls.append(route.request.post_data_json)
                await route.fulfill(status=409,json={'detail':'Controlled send capture; no model executed.'})
            await page.route('**/api/chat',capture)
            await page.reload()
            area=page.get_by_role('textbox',name='Message',exact=True)
            await area.fill('Click submission fixture')
            await page.get_by_role('button',name='Send message',exact=True).click()
            await page.wait_for_timeout(200)
            assert len(calls)==1
            await area.fill('Enter submission fixture')
            await area.press('Enter')
            await page.wait_for_timeout(200)
            assert len(calls)==2
            await area.fill('Keep typing')
            await area.press('Shift+Enter')
            assert '\n' in await area.input_value() and len(calls)==2
            assert not errors,errors
            await b.close()
    print('PASS: attachment/send/Settings-close icon geometry in White/Black 80/100% and mobile, real file chooser/upload/remove, saved Settings switch, close action, click/Enter dispatch and Shift+Enter newline. Send handlers used controlled request capture; no model inference performed.')

if __name__=='__main__':
    harness.main=check
    harness.run()
