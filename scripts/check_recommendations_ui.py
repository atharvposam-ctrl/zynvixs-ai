"""Read-only styling checks and local practice plan workflows on an isolated database."""
import asyncio,json
import httpx
from playwright.async_api import async_playwright
import check_studio_ui as harness

async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        await api.put('/api/career-workspace/profile',json={'fields':{'name':'Local Candidate','target_role':'Logistics Manager','skills':'inventory, planning'}})
        resume=(await api.post('/api/career/resumes',json={'title':'Controlled resume','content':'Local Candidate\nReact frontend developer with TypeScript and SQL project experience.'})).json()
        await api.put('/api/career/actions/active-resume',json={'id':resume['id']})
        async with async_playwright() as p:
            b=await p.chromium.launch()
            page=await b.new_page(viewport={'width':1672,'height':1050})
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            async def nav(name):
                button=page.locator('.career-nav').get_by_role('button',name=name,exact=True).first
                if not await button.is_visible():await page.get_by_role('button',name='Toggle navigation',exact=True).click()
                await button.click()
            await page.goto(harness.BASE)
            await nav('Interview Prep')
            rec=page.get_by_role('region',name='Interview recommendations',exact=True)
            await rec.get_by_text('Your saved target role',exact=True).wait_for()
            assert await rec.locator('.recommendation-card').first.get_by_role('heading').inner_text()=='Logistics Manager'
            await rec.get_by_role('button',name='Tech',exact=True).click()
            await rec.get_by_label('Search interview roles',exact=True).fill('Frontend')
            await rec.get_by_role('button',name='Prepare practice',exact=True).click()
            assert await page.get_by_label('Target role',exact=True).input_value()=='Frontend Developer'
            await page.get_by_role('button',name='Start interview session',exact=True).click()
            await page.get_by_role('alert').filter(has_text='Load a local model').wait_for()
            assert (await api.get('/api/career/interviews')).json()==[]
            await nav('Skills & Training')
            rec=page.get_by_role('region',name='Learning recommendations',exact=True)
            await rec.get_by_label('Search learning paths',exact=True).fill('React')
            await rec.get_by_role('button',name='Add learning plan',exact=True).click()
            await page.get_by_role('button',name='Save learning progress',exact=True).wait_for()
            rows=(await api.get('/api/career/learning')).json()
            assert len(rows)==1 and json.loads(rows[0]['content'])['recommendation_id']=='react'
            await page.get_by_label('I completed this lesson / practice task',exact=True).check()
            await page.get_by_role('button',name='Save learning progress',exact=True).click()
            await page.get_by_text('1/1 marked complete · 100%',exact=True).wait_for()
            await rec.get_by_role('button',name='View plan',exact=True).click()
            assert len((await api.get('/api/career/learning')).json())==1
            await page.reload()
            await nav('Skills & Training')
            await page.get_by_text('1/1 marked complete · 100%',exact=True).wait_for()
            await page.get_by_role('contentinfo',name='Career workspace links',exact=True).get_by_role('button',name='Settings',exact=True).click()
            await page.get_by_role('region',name='Workspace appearance',exact=True).wait_for()
            await page.route('**/api/career-workspace/profile',lambda r:r.fulfill(status=503,json={'detail':'Controlled recommendation failure'}))
            await nav('Interview Prep')
            await page.get_by_role('alert').filter(has_text='Profile recommendations unavailable').wait_for()
            await page.unroute('**/api/career-workspace/profile')
            await page.get_by_role('button',name='Retry recommendations',exact=True).click()
            await page.get_by_text('Your saved target role',exact=True).wait_for()
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.reload()
                for name in ['Career Dashboard','Interview Prep','Skills & Training','Automation']:
                    await nav(name)
                    for scale in ['80','100']:
                        await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                        await page.locator('.career-main').evaluate('(e)=>e.scrollTo({top:0,behavior:"instant"})')
                        await page.screenshot(path=str(harness.SHOTS/f'{name}-{theme}-{scale}.png'))
                        assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                    if name=='Career Dashboard' and theme=='light':
                        for selector in ['.career-dashboard small','.dashboard-stats svg','.dashboard-tools span']:
                            assert await page.locator(selector).first.evaluate('(e)=>getComputedStyle(e).color')=='rgb(23, 25, 29)'
                    if name=='Automation':
                        expected='rgb(255, 255, 255)' if theme=='light' else 'rgb(18, 21, 28)'
                        assert await page.locator('.automation-setup').evaluate('(e)=>getComputedStyle(e).backgroundColor')==expected
                await page.set_viewport_size({'width':390,'height':844})
                await page.wait_for_timeout(300)
                for name in ['Interview Prep','Skills & Training','Automation']:
                    await nav(name)
                    await page.screenshot(path=str(harness.SHOTS/f'{name}-{theme}-mobile.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':1672,'height':1050})
                await page.wait_for_timeout(300)
            assert not errors,errors
            await b.close()
    print('PASS: personalized roles and keyword explanations, category/search, interview setup and missing-model state, saved learning plan/progress/reload without duplication, provider retry, footer navigation, neutral dashboard colors, Automation surfaces, light/dark 80/100% and mobile; no JS errors.')

if __name__=='__main__':
    harness.main=check
    harness.run()
