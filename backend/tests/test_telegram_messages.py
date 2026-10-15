from unittest.mock import patch
from types import SimpleNamespace
from uuid import uuid4
from app.db import SessionLocal
from app.models import CampusMessage,Student,TeacherTelegramAlert
from test_messages import students
from test_learning import admin

def test_student_alerts_are_opt_in_and_delivery_does_not_duplicate(client):
    teacher=admin(client);first,_,first_id,_=students()
    with SessionLocal() as session:
        student=session.query(Student).filter_by(public_id=first_id).one();student.telegram_user_id=12345;session.commit()
    assert not client.get('/learning/messages/telegram',headers=first).json()['enabled']
    assert client.post('/learning/messages/telegram',headers=first,json={'enabled':True}).json()['enabled']
    body={'student_id':first_id,'body':'Hello from campus!','request_id':str(uuid4())}
    with patch('app.telegram_messages.httpx.post',return_value=SimpleNamespace(is_success=True,json=lambda:{'ok':True})) as send:
        result=client.post('/learning/messages',headers=teacher,json=body);assert result.status_code==201
        assert client.post('/learning/messages',headers=teacher,json=body).status_code==201
        send.assert_called_once();assert send.call_args.kwargs['json']['chat_id']==12345
        assert 'Hello from campus!' in send.call_args.kwargs['json']['text']
    with SessionLocal() as session:assert session.get(CampusMessage,result.json()['id']).telegram_status=='delivered'

def test_teacher_connection_and_failed_delivery_preserve_message(client):
    teacher=admin(client);first,_,first_id,_=students()
    assert client.post('/learning/messages/telegram/connect',headers=first,json={'telegram_data':{}}).status_code==403
    with patch('app.telegram_messages.telegram_user_id',return_value=45678):
        assert client.post('/learning/messages/telegram/connect',headers=teacher,json={'telegram_data':{'id':'45678'}}).json()['enabled']
    with patch('app.telegram_messages.httpx.post',return_value=SimpleNamespace(is_success=False)):
        result=client.post('/learning/messages',headers=first,json={'body':'Message stays saved','request_id':str(uuid4())});assert result.status_code==201
    with SessionLocal() as session:
        message=session.get(CampusMessage,result.json()['id']);assert message.body=='Message stays saved' and message.telegram_status=='failed'

def test_telegram_test_explains_blocked_bot_without_exposing_token(client):
    first,_,first_id,_=students()
    with SessionLocal() as session:
        student=session.query(Student).filter_by(public_id=first_id).one();student.telegram_user_id=777001;session.commit()
    with patch('app.telegram_messages.httpx.post',return_value=SimpleNamespace(is_success=False,status_code=403)):
        response=client.post('/learning/messages/telegram/test',headers=first,json={})
    assert response.status_code==200 and not response.json()['delivered']
    assert 'Start' in response.json()['message'] and 'synthetic-test-bot' not in response.text
    assert client.post('/learning/messages/telegram/test',headers=first,json={}).status_code==429
    assert client.get('/learning/messages/telegram',headers=first).json()['configured']
