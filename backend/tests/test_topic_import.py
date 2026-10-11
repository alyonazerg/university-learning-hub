import base64
import io
from datetime import datetime
from openpyxl import Workbook
from sqlalchemy import select
from test_learning import admin
from app.db import SessionLocal
from app.models import Group,LessonPlan


def setup_groups(client):
    headers=admin(client)
    ids=[]
    for name in ['150','151','154']:
        response=client.post('/learning/groups',headers=headers,json={'name':name,'course_id':'grammar'})
        assert response.status_code in (200,201),response.text
        ids.append(response.json()['id'])
    return headers,ids


def payload(ids,text):
    return {'group_ids':ids,'filename':'topics.csv','content':base64.b64encode(text.encode('utf-8')).decode()}


def test_csv_preview_replaces_numbered_topics_atomically_and_preserves_dates(client):
    headers,ids=setup_groups(client)
    for gid in ids:
        assert client.post('/learning/plans',headers=headers,json={'lessons':[{'group_id':gid,'position':1,'topic':'Old topic','starts_at':'2026-10-19T12:40:00+03:00','duration_minutes':100}]}).status_code==201
    body=payload(ids,'position,topic,kind,duration_minutes\n1,Assessment Test 1,test,100\n2,Pronoun,lesson,90\n')
    assert client.post('/learning/topic-import/preview',json=body).status_code==401
    result=client.post('/learning/topic-import/preview',headers=headers,json=body)
    assert result.status_code==200,result.text
    assert all(g['add']==1 and g['update']==1 for g in result.json()['groups'])
    with SessionLocal() as session: assert all(row.topic=='Old topic' for row in session.scalars(select(LessonPlan)))
    assert client.post('/learning/topic-import/apply',headers=headers,json=body).status_code==200
    with SessionLocal() as session:
        rows=list(session.scalars(select(LessonPlan)))
        assert len(rows)==6
        assert all(row.duration_minutes==90 and row.starts_at==datetime(2026,10,19,9,40) for row in rows if row.position==1)
    assert client.post('/learning/topic-import/apply',headers=headers,json=body).status_code==200
    with SessionLocal() as session: assert len(list(session.scalars(select(LessonPlan))))==6
    conflict=payload(ids,'position,topic,date,time\n1,Changed,2026-10-19,12:40\n2,Overlap,2026-10-19,13:00\n')
    assert client.post('/learning/topic-import/apply',headers=headers,json=conflict).status_code==409
    with SessionLocal() as session: assert not list(session.scalars(select(LessonPlan).where(LessonPlan.topic=='Changed')))
    duplicate=payload(ids,'position,topic\n1,One\n1,Two\n')
    assert client.post('/learning/topic-import/preview',headers=headers,json=duplicate).status_code==422


def test_xlsx_uses_first_visible_sheet_and_moscow_dates(client):
    headers,ids=setup_groups(client)
    book=Workbook();book.active.sheet_state='hidden';book.active.append(['invalid'])
    sheet=book.create_sheet('Topics');sheet.append(['position','topic','kind','date','time','duration_minutes']);sheet.append([1,'Assessment Test 2','test',datetime(2026,11,27),'10:40',100])
    data=io.BytesIO();book.save(data)
    body={'group_ids':ids[:1],'filename':'topics.xlsx','content':base64.b64encode(data.getvalue()).decode()}
    response=client.post('/learning/topic-import/apply',headers=headers,json=body)
    assert response.status_code==200,response.text
    with SessionLocal() as session:
        row=session.scalar(select(LessonPlan));assert row.starts_at==datetime(2026,11,27,7,40) and row.duration_minutes==90
    malformed=payload(ids,'lesson,title\n1,Test\n')
    assert client.post('/learning/topic-import/preview',headers=headers,json=malformed).status_code==422


def test_legacy_xls_import(client):
    from pathlib import Path
    headers,ids=setup_groups(client)
    raw=(Path(__file__).parent/'fixtures/topics.xls').read_bytes()
    body={'group_ids':ids[:1],'filename':'topics.xls','content':base64.b64encode(raw).decode()}
    response=client.post('/learning/topic-import/apply',headers=headers,json=body)
    assert response.status_code==200,response.text
    with SessionLocal() as session:
        row=session.scalar(select(LessonPlan));assert row.topic=='Assessment Test 2' and row.starts_at==datetime(2026,11,27,7,40)


def test_topic_file_can_attach_a_hosted_revision_test(client):
    headers,ids=setup_groups(client)
    body=payload(ids[:1],'position,topic,kind,test_url\n1,Revision Test 1,revision,/assessments/revision-1/\n')
    preview=client.post('/learning/topic-import/preview',headers=headers,json=body)
    assert preview.status_code==200 and preview.json()['groups'][0]['topics'][0]['test_url']=='/assessments/revision-1/'
    response=client.post('/learning/topic-import/apply',headers=headers,json=body)
    assert response.status_code==200
    with SessionLocal() as session:
        row=session.scalar(select(LessonPlan));assert row.kind=='revision' and row.test_url=='/assessments/revision-1/'
