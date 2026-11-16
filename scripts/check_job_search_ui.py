"""Run real Job Search APIs against temporary data and labeled provider fixtures.

Only the subprocess created by this script substitutes external HTTP responses.
Production code has no fixture mode. No real applications are submitted.
"""
import asyncio, json, subprocess
import httpx
from playwright.async_api import async_playwright
import check_studio_ui as harness

BOOTSTRAP = r'''
import sys,httpx,uvicorn
from zynvixs import career_jobs as jobs
real=httpx.AsyncClient
def transport(request):
    if 'remotive.com' in str(request.url):
        return httpx.Response(200,json={'jobs':[{'title':'Frontend developer — controlled test','company_name':'Local Fixture Employer','candidate_required_location':'Pune','description':'React TypeScript Python SQL. At least 3 years experience. Controlled local test listing, not a vacancy.','url':'https://example.invalid/jobs/local-test','salary':'Test range only','publication_date':'2026-11-17','job_type':'full-time'}]})
    if 'greenhouse.io' in str(request.url):return httpx.Response(503,json={'detail':'Controlled provider failure'})
    return httpx.Response(200,json=[])
def factory(**kwargs):return real(transport=httpx.MockTransport(transport),**kwargs)
jobs.httpx.AsyncClient=factory
uvicorn.run('zynvixs.main:app',host='127.0.0.1',port=int(sys.argv[1]),access_log=False)
'''
async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        await api.put('/api/career-workspace/profile',json={'fields':{'name':'Local Test Candidate','target_role':'Frontend developer','location':'Pune','skills':'TypeScript React','preferences':'Remote full-time roles'}})
        r1=(await api.post('/api/career/resumes',json={'title':'Controlled frontend resume','content':'React TypeScript Python developer. 3 years experience.'})).json()
        r2=(await api.post('/api/career/resumes',json={'title':'Controlled data resume','content':'SQL analyst with Excel.'})).json()
        await api.put('/api/career/actions/active-resume',json={'id':r1['id']})
        async with async_playwright() as p:
            b=await p.chromium.launch()
            page=await b.new_page(viewport={'width':1772,'height':1100})
            errors=[];searches=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('request',lambda r:searches.append(r.url) if r.url.endswith('/career-jobs/search') else None)
            async def nav(name):
                button=page.locator('.career-nav').get_by_role('button',name=name,exact=True).first
                if not await button.is_visible():await page.get_by_role('button',name='Toggle navigation',exact=True).click()
                await button.click()
            await page.goto(harness.BASE)
            await nav('Job Search')
            workspace=page.get_by_role('region',name='Job search workspace',exact=True)
            await page.get_by_label('Active resume',exact=True).select_option(r1['id'])
            await page.get_by_label('Role',exact=True).fill('My edited role')
            await page.get_by_role('button',name='Auto-fill from profile & resume',exact=True).click()
            await page.get_by_role('status').filter(has_text='Criteria auto-filled locally').wait_for()
            assert await page.get_by_label('Role',exact=True).input_value()=='My edited role'
            assert await page.get_by_label('Location',exact=True).input_value()=='Pune'
            assert searches==[]
            await page.get_by_label('Replace filled fields on the next auto-fill',exact=True).check()
            await page.get_by_role('button',name='Auto-fill from profile & resume',exact=True).click()
            await page.get_by_role('status').filter(has_text='replaced with available suggestions').wait_for()
            assert await page.get_by_label('Role',exact=True).input_value()=='Frontend developer'
            await page.locator('.job-extra-filters>summary').click()
            assert await page.get_by_label('Keywords (all terms must match)',exact=True).input_value()=='python typescript react'
            await page.get_by_label('Work arrangement',exact=True).select_option('')
            await page.locator('.job-search-aside').get_by_text('Configure company boards',exact=True).click()
            await page.get_by_label('Greenhouse board slug',exact=True).fill('controlled')
            await page.get_by_role('button',name='Search jobs',exact=True).click()
            await page.locator('.vacancy-title').filter(has_text='Frontend developer').wait_for()
            assert len(searches)==1
            await page.locator('.job-provider-state').filter(has_text='Greenhouse').get_by_text('Failed',exact=True).wait_for()
            await page.get_by_role('button',name='View Details',exact=True).click()
            dialog=page.get_by_role('dialog',name='Vacancy details',exact=True)
            await dialog.get_by_text('React TypeScript Python SQL.',exact=False).wait_for()
            await dialog.get_by_role('button',name='Close details',exact=True).click()
            await page.get_by_role('button',name='Save Job',exact=True).click()
            await page.get_by_role('status').filter(has_text='Job saved.').wait_for()
            assert len((await api.get('/api/career/jobs')).json())==1
            await page.get_by_role('button',name='Start Application',exact=True).click()
            await page.get_by_role('status').filter(has_text='Draft application created').wait_for()
            assert (await api.get('/api/career/applications')).json()[0]['status']=='draft'
            await page.get_by_role('button',name='Saved (1)',exact=True).click()
            await page.get_by_role('button',name='View Details',exact=True).wait_for()
            await page.get_by_role('button',name='Results (1)',exact=True).click()
            await page.get_by_role('button',name='Tailor Resume',exact=True).click()
            await page.get_by_role('complementary',name='Resume output',exact=True).wait_for()
            assert 'Controlled local test' in await page.get_by_label('Target job description',exact=True).input_value()
            await nav('Job Search')
            await page.get_by_role('button',name='Saved (1)',exact=True).click()
            await page.get_by_role('button',name='Application auto-fill',exact=True).click()
            await page.get_by_role('heading',name='Browser application assistant',exact=True).wait_for()
            assert await page.evaluate('sessionStorage.getItem("zynvixs.browser-job")')
            await nav('Job Search')
            await page.locator('.job-search-aside').get_by_text('Saved searches (1)',exact=True).click()
            await page.get_by_role('button',name='Restore cached search',exact=True).click()
            await page.get_by_role('status').filter(has_text='Cached listings restored').wait_for()
            await page.get_by_label('Active resume',exact=True).select_option(r2['id'])
            await page.get_by_role('status').filter(has_text='Resume changed').wait_for()
            assert await page.get_by_role('button',name='Results (0)',exact=True).count()==1
            await page.get_by_role('button',name='Auto-fill from profile & resume',exact=True).click()
            await page.get_by_role('status').filter(has_text='Criteria auto-filled locally').wait_for()
            assert 'sql' in await page.locator('.job-autofill-review').inner_text()
            assert 'excel' in await page.locator('.job-autofill-review').inner_text()
            await page.route('**/api/career-jobs/criteria',lambda r:r.fulfill(status=503,json={'detail':'Controlled auto-fill error'}))
            await page.get_by_role('button',name='Auto-fill from profile & resume',exact=True).click()
            await page.get_by_role('alert').filter(has_text='Controlled auto-fill error').wait_for()
            await page.unroute('**/api/career-jobs/criteria')
            await page.get_by_role('button',name='Retry auto-fill',exact=True).click()
            await page.get_by_role('status').filter(has_text='Criteria auto-filled locally').wait_for()
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.reload()
                await nav('Job Search')
                await page.get_by_role('button',name='Saved (1)',exact=True).click()
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await page.locator('.career-main').evaluate('(e)=>e.scrollTo({top:0,behavior:"instant"})')
                    await page.screenshot(path=str(harness.SHOTS/f'jobs-{theme}-{scale}.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':390,'height':844})
                await page.wait_for_timeout(300)
                await page.screenshot(path=str(harness.SHOTS/f'jobs-{theme}-mobile.png'))
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':1772,'height':1100})
                await page.wait_for_timeout(300)
            assert not errors,errors
            await b.close()
    print('PASS: local auto-fill/provenance, preserves edits and explicit replace, no implicit search, real search/cache/save/draft API flows against labeled provider fixtures, failed provider and auto-fill retry, details, tailoring, browser handoff, resume invalidation, White/Black 80/100% and mobile. No real applications submitted.')

if __name__=='__main__':
    original=subprocess.Popen
    def launch(args,*pos,**kwargs):
        if isinstance(args,list) and len(args)>3 and args[1:3]==['-m','uvicorn']:
            args=[args[0],'-c',BOOTSTRAP,args[args.index('--port')+1]]
        return original(args,*pos,**kwargs)
    subprocess.Popen=launch
    harness.main=check
    harness.run()
