from uuid import uuid4
from unittest.mock import patch
from app.db import SessionLocal
from app.models import HomeworkSubmission,CourseworkAiJob,CourseworkCredit,CourseworkReview,HomeworkTask,Student
from app.coursework_worker import process_one
from app.learning import now
from datetime import timedelta
from test_learning import admin
from test_messages import students

def setup(client,course='grammar'):
    first,second,first_id,second_id=students();teacher=admin(client)
    group=client.get('/learning/groups',headers=teacher).json()[0]
    client.put('/learning/groups/'+str(group['id']),headers=teacher,json={'name':group['name'],'course_id':course})
    return teacher,first,second,group['id']

def task(client,teacher,gid,**changes):
    config={'semester':'2026-2027-1','period':1,'category':'imt','max_points':3,'xp':10,'ai_enabled':True}
    config.update(changes.pop('assessment',{}))
    body=dict(title='Synthetic grammar analysis',description='Analyse noun grammar in these examples.',group_ids=[gid],kind='imt',starts_at='2026-01-01T00:00:00Z',ends_at='2027-01-01T00:00:00Z',assessment=config)
    body.update(changes)
    response=client.post('/learning/tasks',headers=teacher,json=body);assert response.status_code==201,response.text
    return response.json()

def submit(client,student,task,**changes):
    body=dict(kind='text',content='A clear, original analysis of noun grammar.',request_id=str(uuid4()));body.update(changes)
    r=client.post('/learning/tasks/'+task['id']+'/submissions',headers=student,json=body);assert r.status_code==201,r.text;return r.json()

def review(client,teacher,work,score=3,**changes):
    body=dict(request_id=str(uuid4()),expected_version=work['review_version'],decision='graded',scores={'overall':score},comment='Well explained.');body.update(changes)
    return client.put('/learning/coursework/submissions/'+work['id']+'/review',headers=teacher,json=body)

def test_ai_is_provisional_idempotent_and_private(client):
    teacher,first,second,gid=setup(client);assignment=task(client,teacher,gid)
    request_id=str(uuid4());work=submit(client,first,assignment,request_id=request_id)
    assert work['state']=='ai_queued' and 'ai' not in work
    assert submit(client,first,assignment,request_id=request_id)['id']==work['id']
    assert client.get('/learning/coursework/queue',headers=first).status_code==403
    assert client.get('/learning/tasks/'+assignment['id']+'/submissions',headers=second).json()==[]
    with patch('app.coursework_worker.completion',return_value={'feedback':'Useful grammar analysis.','criteria':[{'key':'overall','suggested':2,'feedback':'Check this example.'}]}) as call:
        assert process_one();assert not process_one();call.assert_called_once()
        assert 'First Student' not in str(call.call_args)
    queue=client.get('/learning/coursework/queue',headers=teacher).json();assert queue[0]['ai']['result']['criteria'][0]['suggested']==2
    own=client.get('/learning/tasks/'+assignment['id']+'/submissions',headers=first).json()[0];assert 'ai' not in own and own['review'] is None
    journal=client.get('/learning/coursework/journal',headers=first).json();assert journal['students'][0]['total']==0 and journal['students'][0]['cells'][0]['points'] is None
    assert review(client,first,work).status_code==403

def test_approval_corrections_caps_and_no_duplicate_xp(client):
    teacher,first,second,gid=setup(client);assignment=task(client,teacher,gid);work=submit(client,first,assignment)
    request_id=str(uuid4());approved=review(client,teacher,work,request_id=request_id);assert approved.status_code==200,approved.text
    assert review(client,teacher,work,request_id=request_id).status_code==200
    assert review(client,teacher,work,score=2).status_code==409
    new=review(client,teacher,{**work,'review_version':1},score=2);assert new.status_code==200
    history='/learning/coursework/submissions/'+work['id']+'/history'
    assert [r['points'] for r in client.get(history,headers=first).json()]==[3,2]
    assert client.get(history,headers=second).status_code==404
    assert review(client,teacher,{**work,'review_version':2},score=4).status_code==422
    for _ in range(2):
        other=task(client,teacher,gid);another=submit(client,first,other);assert review(client,teacher,another).status_code==200
    journal=client.get('/learning/coursework/journal',headers=first).json();row=journal['students'][0]
    assert row['total']==5 and row['categories'][0]['raw']==8 and row['xp']==30
    assert len(client.get('/learning/coursework/journal?group_id='+str(gid),headers=second).json()['students'])==1
    with SessionLocal() as s:
        assert s.query(CourseworkCredit).count()==3 and s.query(CourseworkReview).count()==4

def test_revisions_keep_previous_work_and_confirmed_marks(client):
    teacher,first,_,gid=setup(client);assignment=task(client,teacher,gid);work=submit(client,first,assignment)
    assert review(client,teacher,work,decision='revision_requested',scores={},comment='Please add examples.').status_code==200
    updated=submit(client,first,assignment,content='Revised answer with clear examples.')
    assert review(client,teacher,{**work,'review_version':1}).status_code==409
    assert review(client,teacher,updated).status_code==200
    newest=submit(client,first,assignment,content='An improved version.')
    journal=client.get('/learning/coursework/journal',headers=first).json()['students'][0]
    assert journal['total']==3 and journal['cells'][0]['previous_confirmed']
    assert review(client,teacher,newest,score=2).status_code==200
    assert client.get('/learning/coursework/journal',headers=first).json()['students'][0]['total']==2
    with SessionLocal() as s:assert s.query(HomeworkSubmission).count()==3

def test_private_files_failed_ai_and_teacher_manual_approval(client):
    teacher,first,second,gid=setup(client);assignment=task(client,teacher,gid)
    uploaded=client.post('/learning/coursework/tasks/'+assignment['id']+'/attachments',headers=first,files={'file':('analysis.txt',b'The plural of child is children.','text/plain')});assert uploaded.status_code==201
    identifier=uploaded.json()['id'];url='/learning/coursework/attachments/'+identifier
    assert client.get(url,headers=second).status_code==404
    assert client.get('/learning/coursework/tasks/'+assignment['id']+'/attachments',headers=first).json()[0]['id']==identifier
    assert client.get('/learning/coursework/tasks/'+assignment['id']+'/attachments',headers=second).json()==[]
    work=submit(client,first,assignment,content='',attachment_ids=[identifier])
    assert client.get(url,headers=teacher).content==b'The plural of child is children.'
    assert client.delete(url,headers=first).status_code==404
    with patch('app.coursework_worker.completion',side_effect=ValueError('sensitive provider error')):assert process_one()
    queue=client.get('/learning/coursework/queue',headers=teacher).json()[0];assert queue['state']=='ai_failed' and 'sensitive' not in str(queue)
    assert review(client,teacher,work,score=2).status_code==200
    assert client.post('/learning/coursework/submissions/'+work['id']+'/retry-ai',headers=first).status_code==403
    assert client.post('/learning/coursework/submissions/'+work['id']+'/retry-ai',headers=teacher).json()['status']=='queued'

def test_optional_unselected_and_no_attendance_awards(client):
    teacher,first,_,gid=setup(client);assignment=task(client,teacher,gid)
    row=client.get('/learning/coursework/journal',headers=first).json()['students'][0];assert row['cells'][0]['state']=='not_selected'
    lesson=client.post('/learning/attendance',headers=teacher,json={'group_id':gid,'title':'Synthetic lesson','starts_at':'2026-10-01T10:00:00Z'}).json()
    for mark in lesson['marks']:mark['status']='present'
    client.put('/learning/attendance/'+lesson['id'],headers=teacher,json={'marks':[{'student_id':m['student_id'],'status':m['status']} for m in lesson['marks']]})
    assert client.get('/learning/attendance',headers=first).json()==[]
    row=client.get('/learning/coursework/journal',headers=first).json()['students'][0];assert row['total']==0 and row['xp']==0

def test_snapshots_and_live_evidence_are_not_invented(client):
    teacher,first,_,gid=setup(client,'speech');assignment=task(client,teacher,gid,assessment={'template_id':'speech-idioms'})
    work=submit(client,first,assignment)
    with SessionLocal() as s:
        t=s.get(HomeworkTask,assignment['id']);t.description='Changed instructions';s.commit()
    with patch('app.coursework_worker.completion',return_value={'feedback':'Written list checked.','criteria':[{'key':'0','suggested':1,'feedback':'Relevant.'},{'key':'1','suggested':2,'feedback':'Invented oral recall.'}]}):process_one()
    result=client.get('/learning/coursework/queue',headers=teacher).json()[0]['ai']['result']
    assert result['criteria'][1]['suggested'] is None
    with SessionLocal() as s:assert s.get(HomeworkSubmission,work['id']).snapshot['description']!='Changed instructions'

def test_interrupted_worker_recovers_and_zero_is_not_pending(client):
    teacher,first,_,gid=setup(client);assignment=task(client,teacher,gid);work=submit(client,first,assignment)
    with SessionLocal() as session:
        job=session.get(CourseworkAiJob,work['id']);job.status='running';job.lease='interrupted';job.attempts=1;job.updated_at=now()-timedelta(minutes=6);session.commit()
    with patch('app.coursework_worker.completion',return_value={'feedback':'Needs a substantive answer.','criteria':[{'key':'overall','suggested':0,'feedback':'No analysis provided.'}]}):assert process_one()
    with SessionLocal() as session:
        job=session.get(CourseworkAiJob,work['id']);assert job.status=='done' and job.attempts==2 and job.lease!='interrupted'
    assert review(client,teacher,work,score=0).status_code==200
    cell=client.get('/learning/coursework/journal',headers=first).json()['students'][0]['cells'][0]
    assert cell['points']==0 and cell['state']=='graded'

def test_speaking_selection_and_semester_extra_caps(client):
    teacher,first,_,gid=setup(client,'speech')
    works=[]
    for i in range(4):
        assignment=task(client,teacher,gid);works.append(submit(client,first,assignment))
    for work in works[:3]:assert review(client,teacher,work).status_code==200
    assert review(client,teacher,works[3]).status_code==409
    row=client.get('/learning/coursework/journal',headers=first).json()['students'][0]
    assert row['total']==8 and row['categories'][0]['raw']==9
    # Correcting a previously awarded grade never creates a second XP award.
    assert review(client,teacher,{**works[0],'review_version':1},score=0).status_code==200
    assert review(client,teacher,works[3]).status_code==200
    for period in (1,2,2):
        assignment=task(client,teacher,gid,kind='extra',assessment={'category':'extra','period':period,'max_points':10})
        work=submit(client,first,assignment);assert review(client,teacher,work,score=10).status_code==200
    row=client.get('/learning/coursework/journal',headers=first).json()['students'][0]
    extra=next(c for c in row['categories'] if c['category']=='extra');assert extra['credited']==15 and extra['raw']==30

def test_recordings_and_links_do_not_trigger_external_audio_processing(client):
    teacher,first,_,gid=setup(client,'speech');assignment=task(client,teacher,gid)
    submit(client,first,assignment,kind='link',content='https://example.test/private-recording')
    with patch('app.coursework_worker.completion') as provider:assert process_one();provider.assert_not_called()
    result=client.get('/learning/coursework/queue',headers=teacher).json()[0]['ai']['result']
    assert all(c['suggested'] is None for c in result['criteria'])

def test_transfer_preserves_confirmed_work_in_destination_journal(client):
    from app.learning import issue_session
    teacher,first,_,gid=setup(client);assignment=task(client,teacher,gid);work=submit(client,first,assignment)
    assert review(client,teacher,work).status_code==200
    destination=client.post('/learning/groups',headers=teacher,json={'name':'New synthetic group','course_id':'grammar'}).json()['id']
    with SessionLocal() as session:identifier=session.get(HomeworkSubmission,work['id']).student_id;public_id=session.get(Student,identifier).public_id
    assert client.put(f'/learning/groups/{gid}/students/{public_id}',headers=teacher,json={'group_id':destination,'is_active':True}).status_code==200
    with SessionLocal() as session:token=issue_session('student',identifier,session)['access_token']
    headers={'Authorization':'Bearer '+token}
    row=client.get('/learning/coursework/journal',headers=headers).json()['students'][0]
    assert row['total']==3 and row['cells'][0]['submission_id']==work['id']
    assert client.get('/learning/coursework/submissions/'+work['id'],headers=headers).json()['content']==work['content']
