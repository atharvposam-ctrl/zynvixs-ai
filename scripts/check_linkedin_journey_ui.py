"""LinkedIn career journey acceptance: isolated storage, local PDF and provider fixtures."""
import asyncio,json,subprocess
import httpx
from pypdf import PdfReader
from playwright.async_api import async_playwright, expect
import check_studio_ui as harness
from check_job_search_ui import BOOTSTRAP

async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        old=(await api.post('/api/career/resumes',json={'title':'Earlier controlled resume','content':'React Python TypeScript developer. 3 years experience.'})).json()
        await api.put('/api/career/actions/active-resume',json={'id':old['id']})
        result=(await api.post('/api/career-jobs/search',json={'resume_id':old['id'],'role':'Frontend'})).json()
        job=result['jobs'][0]
        saved=(await api.post('/api/career-jobs/'+job['id']+'/save',json={})).json()
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
            await nav('LinkedIn Optimizer')
            await page.get_by_role('button',name='Build your professional story',exact=True).click()
            for label,value in [('Full name','Local Journey Candidate'),('Career target role','Frontend Developer'),('Email','journey@example.invalid'),('Professional summary','I build accessible React projects.'),('Education','BSc, Local Test College, 2025'),('Career experience','Portfolio project contributor.'),('Skills','React, Python, TypeScript')]:
                await page.get_by_label(label,exact=True).fill(value)
            await page.get_by_label('About',exact=True).fill('Keep my current About section.')
            await page.route('**/api/career-workspace/profile',lambda r:r.fulfill(status=503,json={'detail':'Controlled profile save failure'}) if r.request.method=='PUT' else r.continue_())
            await page.get_by_role('button',name='Save details & use in LinkedIn draft',exact=True).click()
            await page.get_by_role('alert').filter(has_text='Controlled profile save failure').wait_for()
            assert await page.get_by_label('Full name',exact=True).input_value()=='Local Journey Candidate'
            await page.unroute('**/api/career-workspace/profile')
            await page.get_by_role('button',name='Save details & use in LinkedIn draft',exact=True).click()
            await page.get_by_role('status').filter(has_text='Profile information saved').wait_for()
            assert await page.get_by_label('About',exact=True).input_value()=='Keep my current About section.'
            await page.get_by_label('Replace filled LinkedIn source sections when importing details or resume text',exact=True).check()
            await page.get_by_role('button',name='Use saved profile in LinkedIn draft',exact=True).click()
            await page.get_by_role('status').filter(has_text='Saved profile used as LinkedIn source').wait_for()
            about=await page.get_by_label('About',exact=True).input_value()
            assert 'accessible React' in about and 'journey@example.invalid' not in about
            await page.get_by_role('button',name='Generate profile improvements',exact=True).click()
            await page.get_by_role('alert').filter(has_text='Load a local model').wait_for()
            assert (await api.get('/api/career/linkedin')).json()==[]
            await page.get_by_role('button',name='Save source as editable draft',exact=True).click()
            await page.get_by_role('status').filter(has_text='Manual draft saved').wait_for()
            await page.get_by_label('Proposed headline',exact=True).fill('Reviewed project-based headline')
            await page.get_by_label('Proposed keywords',exact=True).fill('React, Python')
            await page.get_by_label('Proposed keywords',exact=True).press('End')
            await page.get_by_label('Proposed keywords',exact=True).press_sequentially(', Git')
            assert await page.get_by_label('Proposed keywords',exact=True).input_value()=='React, Python, Git'
            await page.context.grant_permissions(['clipboard-read','clipboard-write'])
            await page.get_by_role('button',name='Copy headline',exact=True).click()
            assert await page.evaluate('navigator.clipboard.readText()')=='Reviewed project-based headline'
            await page.get_by_role('button',name='Save edited version',exact=True).click()
            await page.get_by_role('status').filter(has_text='New version saved').wait_for()
            versions=(await api.get('/api/career/linkedin')).json()
            assert len(versions)==2 and any(v['metadata'].get('parent_id') for v in versions)
            await page.get_by_role('button',name='Save details & preview resume PDF',exact=True).click()
            await page.locator('#linkedin-resume-pdf[data-pdf-ready="true"]').wait_for(timeout=45000)
            # data-pdf-ready lives on the preview section in current renderer.
            async with page.expect_download() as event:
                await page.get_by_role('button',name='Download resume PDF',exact=True).click()
            path=await (await event.value).path()
            assert 'Local Journey Candidate' in ''.join(p.extract_text() for p in PdfReader(path).pages)
            current=(await api.get('/api/career/actions/active-resume')).json()['id']
            assert current!=old['id']
            await page.get_by_label('Skills',exact=True).fill('React, Python, TypeScript, Git')
            assert await page.get_by_role('button',name='Download resume PDF',exact=True).get_attribute('aria-disabled')=='true'
            await page.get_by_role('button',name='Save details & preview resume PDF',exact=True).click()
            await page.locator('#linkedin-resume-pdf[data-pdf-ready="true"]').wait_for(timeout=45000)
            await page.get_by_label('Saved opportunity',exact=True).select_option(saved['id'])
            await page.get_by_role('button',name='Prepare selected application',exact=True).click()
            await page.get_by_role('heading',name='Applications',exact=True).wait_for()
            apps=(await api.get('/api/career/applications')).json()
            assert len(apps)==1 and apps[0]['status']=='draft' and apps[0]['resume_id']!=old['id']
            await nav('LinkedIn Optimizer')
            await expect(page.get_by_label('Full name',exact=True)).to_have_value('Local Journey Candidate')
            await page.get_by_label('Saved opportunity',exact=True).select_option(saved['id'])
            await page.get_by_role('button',name='Review browser auto-fill',exact=True).click()
            await page.get_by_role('heading',name='Browser application assistant',exact=True).wait_for()
            assert await page.evaluate('sessionStorage.getItem("zynvixs.browser-job")')==job['id']
            assert len((await api.get('/api/career/applications')).json())==1
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.reload()
                await nav('LinkedIn Optimizer')
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await page.locator('.career-main').evaluate('(e)=>e.scrollTo({top:0,behavior:"instant"})')
                    await page.screenshot(path=str(harness.SHOTS/f'linkedin-{theme}-{scale}.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':390,'height':844})
                await page.wait_for_timeout(300)
                await page.screenshot(path=str(harness.SHOTS/f'linkedin-{theme}-mobile.png'))
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':1772,'height':1100})
                await page.wait_for_timeout(300)
            await page.emulate_media(reduced_motion='reduce')
            assert await page.locator('.linkedin-banner-art').evaluate('(e)=>getComputedStyle(e).animationName')=='none'
            assert not errors,errors
            await b.close()
    print('PASS: shared details/failure retention, source preservation and replacement, missing model, manual/version drafts, actual PDF/download/stale checks, draft application with selected resume, reviewed browser handoff without duplicates, banners, White/Black 80/100% and mobile. No LinkedIn publishing or real applications performed.')

if __name__=='__main__':
    original=subprocess.Popen
    def launch(args,*pos,**kwargs):
        if isinstance(args,list) and len(args)>3 and args[1:3]==['-m','uvicorn']:
            args=[args[0],'-c',BOOTSTRAP,args[args.index('--port')+1]]
        return original(args,*pos,**kwargs)
    subprocess.Popen=launch
    harness.main=check
    harness.run()
