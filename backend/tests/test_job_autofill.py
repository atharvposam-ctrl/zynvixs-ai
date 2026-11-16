from fastapi import HTTPException
import pytest
from zynvixs import career, career_jobs as jobs, career_workspace as workspace


def test_auto_fill_uses_saved_facts_without_network_or_mutation():
    resume = career.create('resumes', career.Record(title='Resume', content='React and Python developer, 3 years experience. SQL.'))
    workspace.save_profile(workspace.ProfileUpdate(fields={'target_role':'Full Stack Developer','location':'Pune','skills':'TypeScript','preferences':'Remote full-time roles'}))
    result = jobs.criteria({'resume_id':resume['id']})
    assert result['autofill'] == {'role':'Full Stack Developer','keywords':'python typescript react','location':'Pune','experience':'3 years','arrangement':'remote','job_type':'full-time'}
    assert result['autofill_sources']['role'] == 'Saved target role'
    assert 'No provider is contacted' in result['note']
    assert 'greenhouse' not in result['autofill'] and 'lever' not in result['autofill']
    assert career.records('searches') == []
    assert career.records('resumes')[0]['content'] == resume['content']


def test_ambiguous_preferences_and_unknown_experience_stay_blank():
    resume = career.create('resumes',career.Record(title='My resume',content='A portfolio of design work.'))
    workspace.save_profile(workspace.ProfileUpdate(fields={'preferences':'remote or hybrid, part-time or contract'}))
    result = jobs.criteria({'resume_id':resume['id']})
    assert all(not value for value in result['autofill'].values())
    assert result['skills'] == []


def test_autofill_changes_with_selected_resume_and_requires_existing_resume():
    first=career.create('resumes',career.Record(title='Frontend',content='React CSS'))
    second=career.create('resumes',career.Record(title='Data',content='SQL excel 2 years'))
    assert jobs.criteria({'resume_id':first['id']})['autofill']['role']=='Frontend developer'
    assert jobs.criteria({'resume_id':second['id']})['autofill']['role']=='Data analyst'
    with pytest.raises(HTTPException) as exc:
        jobs.criteria({'resume_id':'missing'})
    assert exc.value.status_code==404
