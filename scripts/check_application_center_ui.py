"""Application command center acceptance checks: isolated SQLite and local provider fixtures."""
import asyncio,json,subprocess
import httpx
from playwright.async_api import async_playwright
import check_studio_ui as harness
from check_job_search_ui import BOOTSTRAP

async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        resume=(await api.post('/api/career/resumes',json={'title':'Controlled resume v1','content':'Python React developer. 3 years of project work.'})).json()
        await api.put('/api/career-workspace/profile',json={'fields':{'name':'Local Candidate','email':'local@example.invalid'}})
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
            await nav('Applications')
            await page.get_by_role('button',name='Track an application manually',exact=True).click()
            drawer=page.get_by_role('dialog',name='Application details panel',exact=True)
            await drawer.get_by_label('Role and company',exact=True).fill('Developer — Controlled Employer')
            for name,value in [('Company','Controlled Employer'),('Role','Developer'),('Location','Pune'),('Next action','Review the application'),('Recruiter name','Test Recruiter'),('Recruiter email','recruiter@example.invalid'),('Notes','Local controlled notes'),('Cover letter used','I built a real Python project; controlled cover letter.')]:
                await drawer.get_by_label(name,exact=True).fill(value)
            await drawer.get_by_label('Original listing URL / details',exact=True).fill('https://example.invalid/jobs/controlled')
            await drawer.get_by_label('Resume version',exact=True).select_option(resume['id'])
            await drawer.get_by_label('Deadline / follow-up date',exact=True).fill('2027-01-08')
            await drawer.get_by_label('Interview date',exact=True).fill('2027-01-10')
            await drawer.get_by_label('Application deadline',exact=True).fill('2027-01-12')
            await drawer.get_by_role('button',name='Save application details',exact=True).click()
            await drawer.get_by_role('status').filter(has_text='Application details saved').wait_for()
            app=(await api.get('/api/career/applications')).json()[0]
            assert app['status']=='draft' and app['resume_id']==resume['id']
            assert app['metadata']['recruiter_email']=='recruiter@example.invalid'
            async with page.expect_download() as event:
                await drawer.get_by_role('button',name='Download cover letter text',exact=True).click()
            path=await (await event.value).path()
            assert 'real Python project' in path.read_text()
            for _ in range(2):
                async with page.expect_response(lambda r:r.url.endswith('/reminder') and r.request.method=='POST') as event:
                    await drawer.get_by_role('button',name='Create a dashboard reminder task',exact=True).click()
                assert (await event.value).status==200
                await drawer.get_by_role('status').filter(has_text='Reminder saved').wait_for()
            assert len((await api.get('/api/career/tasks')).json())==1
            await drawer.get_by_label('Reminder type',exact=True).select_option('interview')
            async with page.expect_response(lambda r:r.url.endswith('/reminder') and r.request.method=='POST') as event:
                await drawer.get_by_role('button',name='Create a dashboard reminder task',exact=True).click()
            assert (await event.value).status==200
            await drawer.get_by_role('status').filter(has_text='Reminder saved').wait_for()
            assert len((await api.get('/api/career/tasks')).json())==2
            await drawer.get_by_role('button',name='Open reviewed browser assistant',exact=True).wait_for()
            assert await drawer.get_by_role('button',name='Open reviewed browser assistant',exact=True).is_disabled()
            await drawer.get_by_role('button',name='Close details',exact=True).click()
            page.once('dialog',lambda d:d.dismiss())
            await page.get_by_label('Status',exact=True).select_option('submitted')
            assert (await api.get('/api/career/applications')).json()[0]['status']=='draft'
            page.once('dialog',lambda d:d.accept())
            await page.get_by_label('Status',exact=True).select_option('submitted')
            await page.get_by_role('status').filter(has_text='Application status saved').wait_for()
            app=(await api.get('/api/career/applications')).json()[0]
            assert app['submission_verified'] and len(app['metadata']['history'])==2
            await page.get_by_role('button',name='View application reminders',exact=True).click()
            await page.get_by_role('checkbox',name='Follow up: Developer — Controlled Employer',exact=True).check()
            await page.get_by_role('status').filter(has_text='Reminder completion saved').wait_for()
            assert sum(t['complete'] for t in (await api.get('/api/career/tasks')).json())==1
            await page.get_by_role('button',name='View application activity',exact=True).click()
            await page.get_by_text('Preparing → Applied',exact=True).wait_for()
            await page.get_by_text('Completed reminder: Follow up: Developer — Controlled Employer',exact=True).wait_for()
            await page.reload()
            await nav('Applications')
            await page.get_by_role('button',name='List view',exact=True).click()
            await page.get_by_label('Filter applications',exact=True).fill('not a matching company')
            await page.get_by_text('No applications match these filters.',exact=True).wait_for()
            await page.get_by_role('button',name='Clear filters',exact=True).click()
            await page.get_by_label('Application / created date from',exact=True).fill('2099-01-01')
            await page.get_by_text('No applications match these filters.',exact=True).wait_for()
            await page.get_by_role('button',name='Clear filters',exact=True).click()
            await page.get_by_role('button',name='Open application details',exact=True).click()
            assert await drawer.get_by_label('Notes',exact=True).input_value()=='Local controlled notes'
            await page.route('**/api/career/applications/'+app['id'],lambda r:r.fulfill(status=503,json={'detail':'Controlled application save failure'}) if r.request.method=='PUT' else r.continue_())
            await drawer.get_by_label('Notes',exact=True).fill('Preserved after controlled save failure')
            await drawer.get_by_role('button',name='Save application details',exact=True).click()
            await drawer.get_by_role('alert').filter(has_text='Controlled application save failure').wait_for()
            assert await drawer.get_by_label('Notes',exact=True).input_value()=='Preserved after controlled save failure'
            await page.unroute('**/api/career/applications/'+app['id'])
            await drawer.get_by_role('button',name='Save application details',exact=True).click()
            await drawer.get_by_role('status').filter(has_text='Application details saved').wait_for()
            await drawer.get_by_role('button',name='Prepare for this interview',exact=True).click()
            await page.get_by_role('region',name='Interview recommendations',exact=True).wait_for()
            assert await page.get_by_label('Target role',exact=True).input_value()=='Developer'
            # Controlled provider response exercises the real cache/application context path.
            result=(await api.post('/api/career-jobs/search',json={'resume_id':resume['id'],'role':'Frontend'})).json()
            job=result['jobs'][0]
            cached=(await api.post('/api/career-jobs/'+job['id']+'/application',json={})).json()
            await nav('Applications')
            await page.get_by_role('button',name='List view',exact=True).click()
            await page.get_by_label('Filter applications',exact=True).fill('Local Fixture')
            await page.get_by_role('button',name='Open application details',exact=True).click()
            await drawer.get_by_role('button',name='Open reviewed browser assistant',exact=True).click()
            await page.get_by_role('heading',name='Browser application assistant',exact=True).wait_for()
            assert await page.evaluate('sessionStorage.getItem("zynvixs.browser-job")')==job['id']
            assert (await api.get('/api/career/applications')).json()[0]['status']!='interview'
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.reload()
                await nav('Applications')
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await page.locator('.career-main').evaluate('(e)=>e.scrollTo({top:0,behavior:"instant"})')
                    await page.screenshot(path=str(harness.SHOTS/f'applications-{theme}-{scale}.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':390,'height':844})
                await page.wait_for_timeout(300)
                await page.screenshot(path=str(harness.SHOTS/f'applications-{theme}-mobile.png'))
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.get_by_role('button',name='List view',exact=True).click()
                await page.get_by_role('button',name='Open application details',exact=True).first.click()
                await page.screenshot(path=str(harness.SHOTS/f'application-drawer-{theme}-mobile.png'))
                assert await drawer.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
                await drawer.get_by_role('button',name='Close details',exact=True).click()
                await page.set_viewport_size({'width':1772,'height':1100})
                await page.wait_for_timeout(300)
            await page.get_by_role('button',name='Review unfinished applications',exact=True).click()
            assert await page.locator('.application-card').count()==1
            await page.get_by_role('button',name='Track an application manually',exact=True).click()
            await drawer.get_by_label('Company',exact=True).fill('Another Local Employer')
            await drawer.get_by_label('Role',exact=True).fill('Analyst')
            assert await drawer.get_by_label('Role and company',exact=True).input_value()=='Analyst — Another Local Employer'
            page.once('dialog',lambda d:d.accept())
            await drawer.get_by_role('button',name='Close details',exact=True).click()
            assert len((await api.get('/api/career/applications')).json())==2
            assert not errors,errors
            await b.close()
    print('PASS: application details/resume/cover persistence, explicit submission confirmation, idempotent reminders and completion, history/search, interview and reviewed browser handoff, banners, White/Black 80/100% and mobile drawer. No real messages or applications submitted.')

if __name__=='__main__':
    original=subprocess.Popen
    def launch(args,*pos,**kwargs):
        if isinstance(args,list) and len(args)>3 and args[1:3]==['-m','uvicorn']:
            args=[args[0],'-c',BOOTSTRAP,args[args.index('--port')+1]]
        return original(args,*pos,**kwargs)
    subprocess.Popen=launch
    harness.main=check
    harness.run()
