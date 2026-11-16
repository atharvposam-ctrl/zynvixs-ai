from concurrent.futures import ThreadPoolExecutor
import pytest
from fastapi import HTTPException
from zynvixs import career, db, career_workspace as workspace


def test_saved_stage_and_context_preserve_real_records():
    resume=career.create('resumes',career.Record(title='My resume v1',content='Real facts'))
    workspace.save_profile(workspace.ProfileUpdate(fields={'name':'Local Candidate','email':'local@example.invalid'}))
    app=career.create('applications',career.Record(title='Example role',status='saved',resume_id=resume['id'],metadata={'cover_letter':'My actual draft','company':'Example','custom_legacy':'Keep me'}))
    context=workspace.application_context(app['id'])
    assert context['resume']['id']==resume['id'] and context['profile']['name']=='Local Candidate'
    assert context['job'] is None and context['tasks']==[]
    assert career.records('applications')[0]['status']=='saved'
    edited=career.update('applications',app['id'],career.Record(**{k:v for k,v in app.items() if k!='id'}).model_copy(update={'status':'draft'}))
    assert edited['metadata']['custom_legacy']=='Keep me'
    assert edited['metadata']['created_at']==app['metadata']['created_at']
    assert len(edited['metadata']['history'])==2
    db.close()
    assert career.records('applications')[0]['metadata']['cover_letter']=='My actual draft'


def test_reminders_are_idempotent_under_parallel_requests_and_survive_restart():
    app=career.create('applications',career.Record(title='x'*300))
    body=workspace.ApplicationReminder(due='2027-01-08',kind='interview')
    with ThreadPoolExecutor(max_workers=8) as pool:
        tasks=list(pool.map(lambda _:workspace.application_reminder(app['id'],body),range(16)))
    assert len({t['id'] for t in tasks})==1
    task=tasks[0]
    assert len(task['title'])==300 and task['metadata']['application_id']==app['id']
    career.update('tasks',task['id'],career.Record(**{k:v for k,v in task.items() if k!='id'}).model_copy(update={'complete':True}))
    db.close()
    assert workspace.application_context(app['id'])['tasks'][0]['complete']
    assert workspace.application_context(app['id'])['tasks'][0]['metadata']['completion_history'][0]['complete'] is True
    assert workspace.application_reminder(app['id'],body)['id']==task['id']
    assert len(career.records('tasks'))==1


def test_reminder_dates_and_submission_confirmation_are_real_gates():
    app=career.create('applications',career.Record(title='Controlled application',status='draft'))
    for due in ['not-date','2027-02-30','20270101']:
        with pytest.raises(HTTPException) as exc:
            workspace.application_reminder(app['id'],workspace.ApplicationReminder(due=due))
        assert exc.value.status_code==422
    with pytest.raises(HTTPException) as exc:
        career.update('applications',app['id'],career.Record(title=app['title'],status='submitted'))
    assert exc.value.status_code==409
    assert career.records('applications')[0]['status']=='draft'
    applied=career.update('applications',app['id'],career.Record(title=app['title'],status='submitted',submission_verified=True))
    assert applied['status']=='submitted' and len(applied['metadata']['history'])==2
    with pytest.raises(HTTPException) as exc:
        workspace.application_context('missing')
    assert exc.value.status_code==404
