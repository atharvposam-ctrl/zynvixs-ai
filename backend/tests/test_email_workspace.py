import hashlib
import io
import json
from email import policy
from email.parser import BytesParser
from threading import Thread
import pytest
from fastapi.testclient import TestClient
from zynvixs.main import app
from zynvixs import career, career_mail as mail, db
from zynvixs.mail_test_server import LocalServer, SMTPTestHandler, IMAPTestHandler

client=TestClient(app,base_url='http://localhost')

@pytest.fixture
def local_mail(monkeypatch):
    servers=[]
    monkeypatch.setenv('ZYNVIXS_MAIL_TEST','1')
    monkeypatch.setenv('ZYNVIXS_MAIL_FROM','sender@example.invalid')
    monkeypatch.delenv('ZYNVIXS_MAIL_USER',raising=False)
    monkeypatch.delenv('ZYNVIXS_MAIL_PASSWORD',raising=False)
    for protocol,handler in [('SMTP',SMTPTestHandler),('IMAP',IMAPTestHandler)]:
        server=LocalServer(0,handler)
        Thread(target=server.serve_forever,daemon=True).start()
        servers.append(server)
        monkeypatch.setenv('ZYNVIXS_'+protocol+'_HOST','127.0.0.1')
        monkeypatch.setenv('ZYNVIXS_'+protocol+'_PORT',str(server.server_address[1]))
        monkeypatch.setenv('ZYNVIXS_'+protocol+'_SECURITY','plain')
    yield servers[0].received
    for server in servers:
        server.shutdown();server.server_close()


def test_legacy_fingerprint_is_unchanged():
    record=mail.draft(mail.Draft(to='test@example.invalid',subject='Existing subject',body='Existing body'))
    old=hashlib.sha256(json.dumps({'to':'test@example.invalid','subject':'Existing subject','body':'Existing body'},sort_keys=True).encode()).hexdigest()
    assert mail.fingerprint(record)==old


@pytest.mark.parametrize('format',['pdf','docx'])
def test_review_binds_exact_resume_bytes_and_history(local_mail,format):
    resume=career.create('resumes',career.Record(title='Candidate v1',content='# Local Candidate\n\nPython project evidence.'))
    application=career.create('applications',career.Record(title='Controlled role'))
    record=mail.draft(mail.Draft(to='recipient@example.invalid',subject='Controlled attachment',body='Please review my supplied resume.',resume_id=resume['id'],resume_format=format,application_id=application['id']))
    path='/api/career-mail/drafts/'+record['id']
    reviewed=client.post(path+'/review').json()
    snapshot=client.get(path+'/attachment',params={'review_hash':reviewed['review_hash']})
    assert snapshot.status_code==200 and reviewed['attachments'][0]['sha256']==hashlib.sha256(snapshot.content).hexdigest()
    assert client.post(path+'/send',json={'approved':False,'review_hash':reviewed['review_hash']}).status_code==409
    career.connection().execute('UPDATE career_mail_attachments SET payload=? WHERE key=?',(b'corrupt-cache',record['id']+':'+reviewed['review_hash']))
    assert client.get(path+'/attachment',params={'review_hash':reviewed['review_hash']}).status_code==409
    assert client.post(path+'/review').status_code==200
    assert client.get(path+'/attachment',params={'review_hash':reviewed['review_hash']}).status_code==200
    career.update('resumes',resume['id'],career.Record(title=resume['title'],content=resume['content']+'\nSQL project evidence.'))
    assert client.post(path+'/send',json={'approved':True,'review_hash':reviewed['review_hash']}).status_code==409
    assert not local_mail
    fresh=client.post(path+'/review').json()
    assert fresh['review_hash']!=reviewed['review_hash']
    expected=client.get(path+'/attachment',params={'review_hash':fresh['review_hash']}).content
    if format=='pdf':
        from pypdf import PdfReader
        assert 'SQL project evidence' in ''.join(p.extract_text() for p in PdfReader(io.BytesIO(expected)).pages)
    else:
        from docx import Document
        assert 'SQL project evidence' in '\n'.join(p.text for p in Document(io.BytesIO(expected)).paragraphs)
    sent=client.post(path+'/send',json={'approved':True,'review_hash':fresh['review_hash']})
    assert sent.status_code==200 and sent.json()['state']=='accepted_by_smtp' and len(local_mail)==1
    parsed=BytesParser(policy=policy.default).parsebytes(local_mail[0])
    parts=list(parsed.iter_attachments())
    assert len(parts)==1 and parts[0].get_payload(decode=True)==expected
    assert client.post(path+'/send',json={'approved':True,'review_hash':fresh['review_hash']}).status_code==409
    attempt=career.records('mail_history')[0]
    assert attempt['metadata']['application_id']==application['id']
    assert attempt['metadata']['sent_body']==record['content']
    career.update('drafts',record['id'],career.Record(title='Later edit',content='Different draft',metadata=record['metadata']))
    db.close()
    assert client.get('/api/career-mail/history/'+attempt['id']+'/attachment').content==expected


def test_readonly_inbox_keeps_local_links_and_followups(local_mail):
    application=career.create('applications',career.Record(title='Controlled tracked role'))
    assert client.post('/api/career-mail/inbox').status_code==200
    message=career.records('mail')[0]
    career.update('mail',message['id'],career.Record(title=message['title'],content=message['content'],metadata={**message['metadata'],'application_id':application['id']}))
    client.post('/api/career-mail/inbox')
    assert career.records('mail')[0]['metadata']['application_id']==application['id']
    path='/api/career-mail/messages/'+message['id']+'/reminder'
    assert client.post(path,json={'due':'2027-02-30'}).status_code==422
    first=client.post(path,json={'due':'2027-01-10'}).json()
    again=client.post(path,json={'due':'2027-01-10'}).json()
    assert first['id']==again['id'] and len(career.records('tasks'))==1
    assert first['metadata']['application_id']==application['id']
    assert not local_mail
