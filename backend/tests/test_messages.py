from uuid import uuid4
from app.db import SessionLocal
from app.models import Group,Student
from app.learning import issue_session
from test_learning import admin
import asyncio
from app.messages import live_events
from app.learning import now
from types import SimpleNamespace
from datetime import timedelta

def students():
    with SessionLocal() as session:
        group=Group(name='Messaging Test',course_id='speech');session.add(group);session.flush()
        first=Student(pseudonym='First Student',group_id=group.id);second=Student(pseudonym='Second Student',group_id=group.id);session.add_all([first,second]);session.commit()
        token=issue_session('student',first.id,session)['access_token'];other=issue_session('student',second.id,session)['access_token']
        return {'Authorization':'Bearer '+token},{'Authorization':'Bearer '+other},first.public_id,second.public_id

def test_private_conversation_send_read_and_retry(client):
    teacher=admin(client);first,second,first_id,second_id=students()
    body={'body':'Hello 😊','request_id':str(uuid4())}
    sent=client.post('/learning/messages',headers=first,json=body);assert sent.status_code==201
    assert client.post('/learning/messages',headers=first,json=body).json()['id']==sent.json()['id']
    assert len(client.get('/learning/messages',headers=first).json()['messages'])==1
    assert client.get('/learning/messages?student_id='+first_id,headers=second).status_code==404
    assert client.post('/learning/messages',headers=second,json={**body,'student_id':first_id}).status_code==404
    threads=client.get('/learning/messages/threads',headers=teacher).json();assert next(t for t in threads if t['student_id']==first_id)['unread']==1
    assert client.post('/learning/messages/read',headers=teacher,json={'student_id':first_id,'through':sent.json()['id']}).status_code==200
    assert client.get('/learning/messages',headers=first).json()['messages'][0]['read_at']
    reply=client.post('/learning/messages',headers=teacher,json={'student_id':first_id,'body':'Hello!','request_id':str(uuid4())});assert reply.status_code==201
    assert client.get('/learning/messages/threads',headers=first).json()[0]['unread']==1
    assert client.get('/learning/messages/threads',headers=second).json()[0]['student_id']==second_id

def test_messages_require_auth_and_nonempty_text(client):
    assert client.get('/learning/messages/threads').status_code==401
    first,_,_,_=students()
    assert client.post('/learning/messages',headers=first,json={'body':'   ','request_id':str(uuid4())}).status_code==422
    assert client.get('/learning/messages/events').status_code==401

def test_live_event_is_scoped_and_contains_no_message_text(client):
    teacher=admin(client);first,second,first_id,second_id=students()
    client.post('/learning/messages',headers=teacher,json={'student_id':first_id,'body':'Private message','request_id':str(uuid4())})
    async def read_first():
        response=live_events(second['Authorization'])
        event=await response.body_iterator.__anext__()
        await response.body_iterator.aclose()
        return event
    event=asyncio.run(read_first())
    assert 'event: changed' in event and '"latest": 0' in event
    assert 'Private message' not in event
