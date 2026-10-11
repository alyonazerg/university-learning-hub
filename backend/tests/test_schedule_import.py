from datetime import datetime
from sqlalchemy import select
from test_learning import admin, student
from app.db import SessionLocal
from app.models import Group, LessonPlan


def payload():
    return {'groups': [{'name':'150','course_id':'grammar','lessons':[
        {'topic':'Grammar lesson','starts_at':'2026-10-19T14:20:00+03:00','duration_minutes':100}]},
        {'name':'213','course_id':'speech','lessons':[
        {'topic':'Speaking practice','starts_at':'2026-10-12T12:40:00+03:00','duration_minutes':90},
        {'topic':'Speaking practice','starts_at':'2026-10-12T14:20:00+03:00','duration_minutes':100}]}]}


def test_import_preview_atomic_apply_and_repeat_preserves_edits(client,authentication):
    teacher=admin(client);learner,_,_=student(client,authentication)
    body=payload()
    assert client.post('/learning/schedule-import/preview',json=body).status_code==401
    assert client.post('/learning/schedule-import/apply',headers=learner,json=body).status_code==403
    result=client.post('/learning/schedule-import/preview',headers=teacher,json=body)
    assert result.status_code==200 and result.json()['add']==3
    assert result.headers['cache-control']=='no-store'
    with SessionLocal() as session:
        assert session.scalar(select(Group).where(Group.name=='150')) is None
        assert list(session.scalars(select(LessonPlan)))==[]
    saved=client.post('/learning/schedule-import/apply',headers=teacher,json=body)
    assert saved.status_code==200 and saved.json()['add']==3
    with SessionLocal() as session:
        row=session.scalar(select(LessonPlan));row.topic='A teacher-edited topic';row.completed=True;session.commit()
    repeat=client.post('/learning/schedule-import/apply',headers=teacher,json=body)
    assert repeat.status_code==200 and repeat.json()['add']==0 and repeat.json()['keep']==3
    assert 'A teacher-edited topic' in [row['topic'] for row in client.get('/learning/plans',headers=teacher).json()]
    conflict=payload();conflict['groups'][0]['name']='151'
    conflict['groups'][1]['lessons'][0]['starts_at']='2026-10-12T13:00:00+03:00'
    assert client.post('/learning/schedule-import/apply',headers=teacher,json=conflict).status_code==409
    with SessionLocal() as session:
        assert session.scalar(select(Group).where(Group.name=='151')) is None
        assert len(list(session.scalars(select(LessonPlan))))==3
    bad=payload();bad['groups'][0]['course_id']='speech'
    assert client.post('/learning/schedule-import/apply',headers=teacher,json=bad).status_code==409
    duplicate=payload();duplicate['groups'][0]['lessons']*=2
    assert client.post('/learning/schedule-import/preview',headers=teacher,json=duplicate).status_code==409


def test_import_upgrades_only_unedited_placeholders_and_preserves_numbering(client):
    teacher=admin(client)
    body=payload()
    assert client.post('/learning/schedule-import/apply',headers=teacher,json=body).status_code==200
    with SessionLocal() as session:
        edited=session.scalar(select(LessonPlan).where(LessonPlan.topic=='Speaking practice'))
        edited.objectives='Teacher-written objectives';session.commit()
    replacement=payload()
    lesson=replacement['groups'][0]['lessons'][0]
    lesson.update(topic='Lesson 8 · Test 1',kind='test',objectives='Noun; Articles.',position=8)
    preview=client.post('/learning/schedule-import/preview',headers=teacher,json=replacement)
    assert preview.status_code==200 and preview.json()['update']==1
    with SessionLocal() as session:
        assert session.scalar(select(LessonPlan).where(LessonPlan.topic=='Grammar lesson')).kind=='lesson'
    assert client.post('/learning/schedule-import/apply',headers=teacher,json=replacement).json()['update']==1
    with SessionLocal() as session:
        row=session.scalar(select(LessonPlan).where(LessonPlan.kind=='test'))
        assert row.position==8 and row.objectives=='Noun; Articles.'
    repeat=client.post('/learning/schedule-import/apply',headers=teacher,json=replacement).json()
    assert repeat['add']==0 and repeat['update']==0 and repeat['keep']==3
    with SessionLocal() as session:
        assert session.scalar(select(LessonPlan).where(LessonPlan.objectives=='Teacher-written objectives')) is not None
