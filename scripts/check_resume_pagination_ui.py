"""Paginated resume acceptance using temporary data and supplied-text fixtures; no live model."""
import io
import httpx
from pathlib import Path
from pypdf import PdfReader
from playwright.async_api import async_playwright
import check_studio_ui as harness

async def check():
    harness.SHOTS.mkdir(parents=True,exist_ok=True)
    async with httpx.AsyncClient(base_url=harness.BASE) as api:
        # Long, uniquely numbered test evidence: never presented as generated qualifications.
        text='# Pagination test candidate\n\n'+ '\n'.join(f'Project evidence {i}: documented a distinct controlled fixture outcome for PDF verification.' for i in range(650))
        row=(await api.post('/api/career/resumes',json={'title':'Long pagination fixture','content':text,'metadata':{'length_preference':'12','paper_size':'a4'}})).json()
        await api.put('/api/career/actions/active-resume',json={'id':row['id']})
        response=await api.get(f'/api/career/resumes/{row["id"]}/export?format=pdf')
        reader=PdfReader(io.BytesIO(response.content));count=len(reader.pages)
        assert count>=12,count
        assert abs(float(reader.pages[0].mediabox.width)-595.28)<1
        assert 'Project evidence 649' in reader.pages[-1].extract_text()
        async with async_playwright() as p:
            browser=await p.chromium.launch()
            page=await browser.new_page(viewport={'width':1920,'height':1100})
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            async def ready():await page.locator('#studio-resume-pdf[data-pdf-ready="true"]').wait_for(timeout=45000)
            async def nav():await page.locator('.career-nav').get_by_role('button',name='Resume Studio',exact=True).click()
            for theme in ['light','dark']:
                await api.patch('/api/settings',json={'theme':theme})
                await page.goto(harness.BASE);await nav();await ready()
                for scale in ['80','100']:
                    await page.get_by_label('Workspace zoom',exact=True).select_option(scale)
                    await page.get_by_label('Go to PDF page',exact=True).select_option('12');await ready()
                    assert await page.get_by_text(f'Page 12 of {count}',exact=True).is_visible()
                    assert await page.get_by_role('button',name='Preview page 12',exact=True).get_attribute('aria-current')=='page'
                    await page.get_by_label('PDF preview zoom',exact=True).select_option('150')
                    await page.wait_for_function('Math.abs(parseFloat(getComputedStyle(document.querySelector(".pdf-canvas-wrap canvas")).width)-892.9134)<2')
                    assert await page.locator('.pdf-canvas-wrap').evaluate('(e)=>e.clientWidth>=890 || e.scrollWidth>e.clientWidth')
                    await page.get_by_label('PDF preview zoom',exact=True).select_option('fit')
                    await page.locator('#studio-resume-pdf').scroll_into_view_if_needed()
                    await page.screenshot(path=str(harness.SHOTS/f'pagination-{theme}-{scale}.png'))
                await page.get_by_role('button',name=f'Preview page {count}',exact=True).click();await ready()
                assert await page.get_by_role('button',name='Next page',exact=True).is_disabled()
                await page.get_by_role('button',name='Previous page',exact=True).click();await ready()
            blob_url=await page.get_by_role('link',name='Open PDF full size ↗').get_attribute('href')
            preview_bytes=bytes(await page.evaluate('async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer()))',blob_url))
            async with page.expect_download() as event:await page.get_by_role('button',name='Download resume PDF',exact=True).click()
            file=harness.SHOTS/'long-preview.pdf';await (await event.value).save_as(file)
            assert file.read_bytes()==preview_bytes, 'Preview download must match exported bytes'
            # Layout changes create a new version and invalidate old preview downloads until saved.
            await page.get_by_label('Resume length target',exact=True).select_option('custom')
            await page.get_by_label('Custom page target',exact=True).fill('9')
            await page.get_by_label('Resume paper size',exact=True).select_option('letter')
            assert await page.get_by_role('button',name='Download resume PDF',exact=True).is_disabled()
            await page.get_by_role('button',name='Edit resume draft',exact=True).click()
            await page.get_by_role('button',name='Save edits & refresh PDF',exact=True).click();await ready()
            rows=(await api.get('/api/career/resumes')).json();new=rows[0]
            assert new['metadata']['custom_pages']==9 and new['metadata']['parent_id']==row['id']
            doc=PdfReader(io.BytesIO((await api.get(f'/api/career/resumes/{new["id"]}/export?format=pdf')).content))
            assert float(doc.pages[0].mediabox.width)==612
            assert len(rows)==2 and rows[1]['content']==text
            assert (await api.get(f'/api/career/resumes/{new["id"]}/export?format=docx')).content[:2]==b'PK'
            await page.reload();await nav();await ready()
            assert await page.get_by_label('Custom page target',exact=True).input_value()=='9'
            await page.set_viewport_size({'width':390,'height':844})
            await page.get_by_role('button',name='Preview',exact=True).click();await ready()
            assert await page.locator('.career-top').evaluate('(e)=>e.getBoundingClientRect().bottom<=document.querySelector(".resume-studio-heading").getBoundingClientRect().top')
            assert not await page.locator('.resume-input-panel').is_visible()
            assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            await page.get_by_label('Go to PDF page',exact=True).select_option('12');await ready()
            await page.screenshot(path=str(harness.SHOTS/'pagination-mobile.png'))
            await page.get_by_role('button',name='Edit resume draft',exact=True).click()
            assert await page.get_by_label('Editable resume text',exact=True).is_visible()
            await page.get_by_label('Target role',exact=True).fill('Test developer')
            await page.get_by_role('button',name='Generate and save AI draft',exact=True).click()
            await page.get_by_role('alert').filter(has_text='Connect a local model').wait_for()
            assert not errors,errors
            await browser.close()
    print('PASS: real long PDF (12+ pages), thumbnails/jump/last/previous, zoom/fit, byte-matching PDF download, A4/Letter, custom target/version persistence, DOCX export, mobile Editor/Preview, themes/scales and disconnected model. No live inference or real candidate data used.')

if __name__=='__main__':
    harness.main=check
    harness.run()
