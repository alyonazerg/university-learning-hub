"""Opt-in Telegram delivery; campus messages remain the source of truth."""
import httpx
from time import monotonic
from collections import OrderedDict
from fastapi import APIRouter,Depends,HTTPException
from .learning import StrictModel,principal,administrator,database,no_store
from .models import Student,CampusMessage,TeacherTelegramAlert
from .settings import settings
from .auth import telegram_user_id
from .db import SessionLocal
router=APIRouter(prefix='/learning/messages/telegram',dependencies=[Depends(no_store)])
_tests=OrderedDict()
class Preference(StrictModel):enabled:bool
class Connect(StrictModel):telegram_data:dict[str,str]
@router.get('')
def preference(actor=Depends(principal),session=Depends(database)):
    query=session.query(CampusMessage).filter(CampusMessage.sender_role==('student' if actor.role=='admin' else 'admin'))
    if actor.role!='admin':query=query.filter(CampusMessage.student_id==actor.student_id)
    last=query.order_by(CampusMessage.id.desc()).first()
    diagnostics={'configured':bool(settings.telegram_bot_token),'last_delivery':last.telegram_status if last else None,'delivery_error':last.telegram_error if last else ''}
    if actor.role=='admin':
        row=session.get(TeacherTelegramAlert,1)
        return {'linked':bool(row),'enabled':bool(row and row.enabled),**diagnostics}
    student=session.get(Student,actor.student_id)
    return {'linked':bool(student.telegram_user_id),'enabled':student.telegram_messages_enabled,**diagnostics}
@router.post('')
def change(body:Preference,actor=Depends(principal),session=Depends(database)):
    if actor.role=='admin':
        row=session.get(TeacherTelegramAlert,1)
        if not row:raise HTTPException(409,'Connect your Telegram account first')
        row.enabled=body.enabled
    else:
        row=session.get(Student,actor.student_id)
        if not row.telegram_user_id:raise HTTPException(409,'Connect your Telegram account first')
        row.telegram_messages_enabled=body.enabled
    session.commit();return preference(actor,session)
@router.post('/connect')
def connect(body:Connect,actor=Depends(administrator),session=Depends(database)):
    if not settings.telegram_bot_token:raise HTTPException(503,'Telegram is not configured')
    identifier=telegram_user_id(body.telegram_data,'',settings.telegram_bot_token)
    if not identifier:raise HTTPException(401,'Invalid Telegram authentication')
    row=session.get(TeacherTelegramAlert,1)
    if not row:row=TeacherTelegramAlert(id=1,chat_id=identifier,enabled=True);session.add(row)
    else:row.chat_id=identifier;row.enabled=True
    session.commit();return {'linked':True,'enabled':True}

def send_telegram(recipient,text):
    if not settings.telegram_bot_token:return 'failed','Telegram is not configured on the server. Contact your teacher.'
    try:
        response=httpx.post('https://api.telegram.org/bot'+settings.telegram_bot_token+'/sendMessage',json={'chat_id':recipient,'text':text,'reply_markup':{'inline_keyboard':[[{'text':'Open Messages','url':'https://mooncampus.ru/learning.html#connected-messages'}]]}},timeout=8)
        if response.is_success and response.json().get('ok'):return 'delivered',''
        code=getattr(response,'status_code',None)
        if code in (400,403):return 'failed','Open @mooncampusbot, press Start and unblock the bot, then try again.'
        if code==401:return 'failed','The bot token is invalid. Ask your teacher to check the server configuration.'
        if code==429:return 'failed','Telegram is busy. Please retry shortly.'
    except (httpx.HTTPError,ValueError):pass
    return 'failed','Telegram could not deliver this notification. Please try the test again.'

@router.post('/test')
def test_delivery(actor=Depends(principal),session=Depends(database)):
    if actor.role=='admin':
        row=session.get(TeacherTelegramAlert,1);recipient=row.chat_id if row else None
    else:recipient=session.get(Student,actor.student_id).telegram_user_id
    if not recipient:raise HTTPException(409,'Connect your Telegram account first')
    key=(actor.role,recipient)
    if monotonic()-_tests.get(key,-60)<10:raise HTTPException(429,'Please wait ten seconds before sending another test')
    _tests[key]=monotonic();_tests.move_to_end(key)
    if len(_tests)>2048:_tests.popitem(last=False)
    status,error=send_telegram(recipient,'Moon Campus ✨\nYour Telegram notifications are connected.')
    return {'delivered':status=='delivered','message':error or 'Test sent! Check your Telegram chat with @mooncampusbot.'}

def deliver(identifier):
    with SessionLocal() as session:
        message=session.get(CampusMessage,identifier)
        if not message or message.telegram_status!='pending':return
        student=session.get(Student,message.student_id);teacher=session.get(TeacherTelegramAlert,1)
        recipient=student.telegram_user_id if message.sender_role=='admin' and student.telegram_messages_enabled else teacher.chat_id if message.sender_role=='student' and teacher and teacher.enabled else None
        if not recipient or not settings.telegram_bot_token:
            message.telegram_status='skipped';message.telegram_error='Telegram alerts are off or the bot is not configured.';session.commit();return
        sender='Teacher' if message.sender_role=='admin' else student.pseudonym
        text='Moon Campus · '+sender+('\nGroup: '+message.group_name if message.group_name else '')+'\n\n'+message.body
    status,error=send_telegram(recipient,text)
    with SessionLocal() as session:
        message=session.get(CampusMessage,identifier)
        if message:message.telegram_status=status;message.telegram_error=error;session.commit()
