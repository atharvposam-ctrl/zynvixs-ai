"""Email Agent UI acceptance with loopback-only SMTP/IMAP fixtures and temporary SQLite."""
import asyncio,subprocess,sys
from pathlib import Path
from threading import Thread
from email import policy
from email.parser import BytesParser
import httpx
from playwright.async_api import async_playwright
import check_studio_ui as harness
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from zynvixs.mail_test_server import LocalServer,SMTPTestHandler,IMAPTestHandler

async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        resume=(await api.post('/api/career/resumes',json={'title':'Controlled resume v1','content':'# Local Candidate\nPython portfolio evidence.'})).json()
        application=(await api.post('/api/career/applications',json={'title':'Controlled local opportunity','resume_id':resume['id'],'metadata':{'recruiter_email':'recruiter@example.invalid'}})).json()
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
            await nav('Email Agent')
            await page.get_by_role('button',name='Mail connection & secure setup',exact=True).click()
            await page.get_by_role('button',name='Test SMTP connection',exact=True).click()
            await page.get_by_role('status').filter(has_text='Connection and authentication checked').wait_for()
            assert not SERVERS[0].received
            await page.get_by_role('button',name='Introduce yourself professionally',exact=True).click()
            await page.get_by_role('button',name='Generate an email draft',exact=True).click()
            await page.get_by_role('alert').filter(has_text='Load a local model').wait_for()
            await page.get_by_role('button',name='Choose a resume attachment',exact=True).click()
            await page.get_by_label('Recipient email',exact=True).fill('recipient@example.invalid')
            await page.get_by_label('Subject',exact=True).fill('Controlled application email')
            await page.get_by_label('Message',exact=True).fill('Please review my actual resume.')
            await page.get_by_label('Linked email application',exact=True).select_option(application['id'])
            await page.get_by_label('Resume attachment',exact=True).select_option(resume['id'])
            await page.get_by_role('button',name='Save draft',exact=True).click()
            await page.get_by_role('status').filter(has_text='Draft saved locally').wait_for()
            await page.get_by_role('button',name='Review saved draft for sending',exact=True).click()
            await page.get_by_role('heading',name='Final send review',exact=True).wait_for()
            assert await page.get_by_role('button',name='Send approved email',exact=True).is_disabled()
            await page.get_by_label('Message',exact=True).fill('Reviewed final message with the selected resume.')
            assert await page.get_by_role('heading',name='Final send review',exact=True).count()==0
            await page.get_by_role('button',name='Review saved draft for sending',exact=True).click()
            await page.get_by_role('heading',name='Final send review',exact=True).wait_for()
            href=await page.get_by_role('link',name='Preview reviewed attachment',exact=False).get_attribute('href')
            snapshot=(await api.get(href)).content
            await page.get_by_label('I approve sending this exact message to this recipient.',exact=True).check()
            await page.get_by_role('button',name='Send approved email',exact=True).click()
            await page.get_by_role('status').filter(has_text='SMTP server accepted').wait_for()
            assert len(SERVERS[0].received)==1
            mail=BytesParser(policy=policy.default).parsebytes(SERVERS[0].received[0])
            assert list(mail.iter_attachments())[0].get_payload(decode=True)==snapshot
            assert len((await api.get('/api/career/mail_history')).json())==1
            assert (await api.get('/api/career/applications')).json()[0]['status']=='draft'
            await page.get_by_role('button',name='Review saved draft for sending',exact=True).click()
            await page.get_by_role('heading',name='Final send review',exact=True).wait_for()
            await page.get_by_label('I approve sending this exact message to this recipient.',exact=True).check()
            await page.get_by_role('button',name='Send approved email',exact=True).click()
            await page.get_by_role('alert').filter(has_text='already attempted').wait_for()
            assert len(SERVERS[0].received)==1
            await page.get_by_label('Email follow-up date',exact=True).fill('2027-01-09')
            for _ in range(2):
                async with page.expect_response(lambda r:r.url.endswith('/reminder') and r.request.method=='POST') as event:
                    await page.get_by_role('button',name='Save draft & create follow-up',exact=True).click()
                assert (await event.value).status==200
                await page.get_by_role('status').filter(has_text='Email follow-up saved').wait_for()
            assert len((await api.get('/api/career/tasks')).json())==1
            await page.get_by_role('button',name='View email follow-ups',exact=True).click()
            await page.get_by_role('checkbox',name='Email follow-up: Controlled application email',exact=True).check()
            await page.get_by_role('status').filter(has_text='Follow-up completion saved').wait_for()
            await page.get_by_role('button',name='Inbox',exact=True).click()
            await page.get_by_role('button',name='Retrieve real inbox messages',exact=True).click()
            await page.get_by_role('status').filter(has_text='Read-only inbox retrieval completed').wait_for()
            await page.get_by_role('complementary',name='Email message list',exact=True).get_by_role('button',name='Local fixture',exact=False).click()
            await page.get_by_label('Inbox application link',exact=True).select_option(application['id'])
            await page.get_by_role('status').filter(has_text='Message linked locally').wait_for()
            await page.get_by_role('button',name='Retrieve real inbox messages',exact=True).click()
            await page.get_by_role('status').filter(has_text='Read-only inbox retrieval completed').wait_for()
            assert (await api.get('/api/career/mail')).json()[0]['metadata']['application_id']==application['id']
            await page.get_by_role('button',name='Use as reply context',exact=True).click()
            assert 'selected email' in await page.get_by_label('AI drafting instructions',exact=True).input_value()
            await page.get_by_role('button',name='Sent',exact=True).click()
            await page.get_by_role('complementary',name='Email message list',exact=True).get_by_role('button',name='Controlled application email',exact=False).click()
            await page.get_by_text('Accepted by SMTP — delivery is not confirmed',exact=True).wait_for()
            assert 'Reviewed final message' in await page.locator('.email-plain-message').inner_text()
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.reload()
                await nav('Email Agent')
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await page.locator('.career-main').evaluate('(e)=>e.scrollTo({top:0,behavior:"instant"})')
                    await page.screenshot(path=str(harness.SHOTS/f'email-{theme}-{scale}.png'))
                    assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.get_by_role('button',name='Drafts',exact=True).click()
                await page.get_by_role('complementary',name='Email message list',exact=True).get_by_role('button',name='Controlled application email',exact=False).click()
                await page.set_viewport_size({'width':390,'height':844})
                await page.wait_for_timeout(300)
                await page.locator('.email-reader-composer').scroll_into_view_if_needed()
                await page.screenshot(path=str(harness.SHOTS/f'email-composer-{theme}-mobile.png'))
                assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                await page.set_viewport_size({'width':1772,'height':1100})
                await page.wait_for_timeout(300)
            assert len(SERVERS[0].received)==1 and not errors,errors
            await b.close()
    print('PASS: loopback-only connection/inbox, missing model, exact reviewed resume bytes, edit invalidation and explicit send, duplicate blocking, immutable sent history/application links, durable follow-ups, banners, White/Black 80/100% and mobile composer. Only one .invalid fixture message was accepted locally; no real recipients contacted.')

if __name__=='__main__':
    SERVERS=[]
    for handler in [SMTPTestHandler,IMAPTestHandler]:
        server=LocalServer(0,handler);Thread(target=server.serve_forever,daemon=True).start();SERVERS.append(server)
    original=subprocess.Popen
    def launch(args,*pos,**kwargs):
        if isinstance(args,list) and len(args)>3 and args[1:3]==['-m','uvicorn']:
            env=dict(kwargs['env']);env.update({'ZYNVIXS_MAIL_TEST':'1','ZYNVIXS_MAIL_FROM':'sender@example.invalid'})
            for protocol,server in zip(['SMTP','IMAP'],SERVERS):env.update({'ZYNVIXS_'+protocol+'_HOST':'127.0.0.1','ZYNVIXS_'+protocol+'_PORT':str(server.server_address[1]),'ZYNVIXS_'+protocol+'_SECURITY':'plain'})
            kwargs['env']=env
        return original(args,*pos,**kwargs)
    subprocess.Popen=launch;harness.main=check
    try:harness.run()
    finally:
        for server in SERVERS:server.shutdown();server.server_close()
