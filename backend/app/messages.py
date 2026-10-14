"""Authenticated one-to-one student/teacher conversations."""
from datetime import timedelta
import asyncio,json
from uuid import UUID,uuid5
from fastapi import APIRouter,Depends,HTTPException,Header
from pydantic import Field
from sqlalchemy import select,func,update
from sqlalchemy.exc import IntegrityError
from fastapi.responses import StreamingResponse
from .db import SessionLocal
from .learning import StrictModel,database,principal,administrator,group_for,no_store,now
from .models import CampusMessage,Student,Group,MessageBroadcast
router=APIRouter(prefix='/learning/messages',dependencies=[Depends(no_store)])
@router.get('/events')
def live_events(authorization:str|None=Header(default=None)):
    # Release the authentication connection before opening a long-lived stream.
    with SessionLocal() as session:
        actor=principal(authorization=authorization,session=session)
        role=actor.role;student_id=actor.student_id;expires=actor.expires_at
    async def stream():
        previous=None;heartbeat=0
        while now()<expires:
            with SessionLocal() as session:
                query=select(func.max(CampusMessage.id),func.max(CampusMessage.read_at))
                if role!='admin':query=query.where(CampusMessage.student_id==student_id)
                latest,read=session.execute(query).one()
                snapshot=(latest or 0,read.isoformat() if read else '')
            if snapshot!=previous:
                previous=snapshot
                yield 'event: changed\ndata: '+json.dumps({'latest':snapshot[0]})+'\n\n'
            elif heartbeat%20==0:yield ': keepalive\n\n'
            heartbeat+=1;await asyncio.sleep(1)
        yield 'event: expired\ndata: {}\n\n'
    return StreamingResponse(stream(),media_type='text/event-stream',headers={'Cache-Control':'no-store','X-Accel-Buffering':'no'})
def participant(actor,student_id,session):
    if actor.role=='admin':
        if not student_id:raise HTTPException(422,'Choose a student')
        student=session.scalar(select(Student).where(Student.public_id==student_id,Student.is_active.is_(True)))
    else:
        student=session.get(Student,actor.student_id)
        if student_id and student and student.public_id!=student_id:raise HTTPException(404,'Conversation not found')
    if not student or not student.is_active:raise HTTPException(404,'Student not found')
    if student.group_id:group_for(student.group_id,session)
    return student
def view(message):
    return {'id':message.id,'sender':message.sender_role,'body':message.body,'group':message.group_name,'created_at':message.created_at.isoformat()+'Z','read_at':message.read_at.isoformat()+'Z' if message.read_at else None}

class BroadcastInput(StrictModel):
    group_ids:list[int]=Field(default_factory=list,max_length=100)
    all_groups:bool=False
    body:str=Field(min_length=1,max_length=3000)
    request_id:UUID
def broadcast_view(row):return {'id':row.id,'body':row.body,'groups':row.groups,'sent':len(row.recipients),'created_at':row.created_at.isoformat()+'Z'}
@router.post('/broadcast',status_code=201)
def broadcast(body:BroadcastInput,actor=Depends(administrator),session=Depends(database)):
    previous=session.get(MessageBroadcast,str(body.request_id))
    if previous:return broadcast_view(previous)
    groups=list(session.scalars(select(Group).where(Group.is_active.is_(True)))) if body.all_groups else [group_for(i,session) for i in set(body.group_ids)]
    if not groups:raise HTTPException(422,'Choose at least one active group')
    targets=list(session.scalars(select(Student).where(Student.is_active.is_(True),Student.group_id.in_([g.id for g in groups]))))
    if not targets:raise HTTPException(422,'No registered active students in the selected groups')
    if len(targets)>1000:raise HTTPException(422,'Send to at most 1000 students at a time')
    count=session.scalar(select(func.count()).select_from(MessageBroadcast).where(MessageBroadcast.created_at>now()-timedelta(minutes=1)))
    if count>=10:raise HTTPException(429,'Please wait before sending another group message')
    batch=MessageBroadcast(id=str(body.request_id),body=body.body,groups=[{'id':g.id,'name':g.name} for g in groups],recipients=[s.public_id for s in targets]);session.add(batch)
    names={g.id:g.name for g in groups}
    for student in targets:session.add(CampusMessage(student_id=student.id,sender_role='admin',body=body.body,group_name=names[student.group_id],request_id=str(uuid5(body.request_id,student.public_id))))
    try:session.commit()
    except IntegrityError:
        session.rollback();previous=session.get(MessageBroadcast,str(body.request_id))
        if not previous:raise HTTPException(409,'Could not send the group message. Retry.')
        return broadcast_view(previous)
    return broadcast_view(batch)
@router.get('/broadcasts',dependencies=[Depends(administrator)])
def broadcasts(session=Depends(database)):
    return [broadcast_view(row) for row in session.scalars(select(MessageBroadcast).order_by(MessageBroadcast.created_at.desc()).limit(100))]
@router.get('/threads')
def threads(actor=Depends(principal),session=Depends(database)):
    query=select(Student).where(Student.is_active.is_(True)).order_by(Student.pseudonym)
    if actor.role!='admin':query=query.where(Student.id==actor.student_id)
    students=list(session.scalars(query));result=[]
    unread=dict(session.execute(select(CampusMessage.student_id,func.count()).where(CampusMessage.sender_role!=actor.role,CampusMessage.read_at.is_(None)).group_by(CampusMessage.student_id)).all())
    for student in students:
        group=session.get(Group,student.group_id) if student.group_id else None
        if group and not group.is_active:continue
        latest=session.scalar(select(CampusMessage).where(CampusMessage.student_id==student.id).order_by(CampusMessage.id.desc()).limit(1))
        incoming=session.scalar(select(func.max(CampusMessage.id)).where(CampusMessage.student_id==student.id,CampusMessage.sender_role!=actor.role)) or 0
        result.append({'student_id':student.public_id,'alias':student.pseudonym,'group':group.name if group else '', 'unread':unread.get(student.id,0),'last_incoming_id':incoming,'last_message':latest.body[:100] if latest else '', 'updated_at':latest.created_at.isoformat()+'Z' if latest else None})
    return result
@router.get('')
def conversation(student_id:str|None=None,after:int=0,before:int|None=None,actor=Depends(principal),session=Depends(database)):
    student=participant(actor,student_id,session)
    query=select(CampusMessage).where(CampusMessage.student_id==student.id,CampusMessage.id>after)
    if before is not None:query=query.where(CampusMessage.id<before)
    rows=list(session.scalars(query.order_by(CampusMessage.id.desc()).limit(200)))
    return {'student_id':student.public_id,'alias':student.pseudonym,'messages':[view(row) for row in reversed(rows)]}
class MessageInput(StrictModel):
    student_id:str|None=Field(default=None,max_length=36)
    body:str=Field(min_length=1,max_length=3000)
    request_id:UUID
@router.post('',status_code=201)
def send(body:MessageInput,actor=Depends(principal),session=Depends(database)):
    student=participant(actor,body.student_id,session)
    previous=session.scalar(select(CampusMessage).where(CampusMessage.request_id==str(body.request_id)))
    if previous:
        if previous.student_id!=student.id or previous.sender_role!=actor.role:raise HTTPException(409,'Request already used')
        return view(previous)
    count=session.scalar(select(func.count()).select_from(CampusMessage).where(CampusMessage.student_id==student.id,CampusMessage.sender_role==actor.role,CampusMessage.created_at>now()-timedelta(minutes=1)))
    if count>=20:raise HTTPException(429,'Please wait a moment before sending more messages')
    row=CampusMessage(student_id=student.id,sender_role=actor.role,body=body.body,request_id=str(body.request_id));session.add(row)
    try:session.commit()
    except IntegrityError:
        session.rollback();previous=session.scalar(select(CampusMessage).where(CampusMessage.request_id==str(body.request_id)))
        if not previous or previous.student_id!=student.id or previous.sender_role!=actor.role:raise HTTPException(409,'Could not send this message; try again')
        return view(previous)
    return view(row)
class ReadInput(StrictModel):
    student_id:str|None=Field(default=None,max_length=36)
    through:int=Field(ge=0)
@router.post('/read')
def mark_read(body:ReadInput,actor=Depends(principal),session=Depends(database)):
    student=participant(actor,body.student_id,session)
    session.execute(update(CampusMessage).where(CampusMessage.student_id==student.id,CampusMessage.sender_role!=actor.role,CampusMessage.read_at.is_(None),CampusMessage.id<=body.through).values(read_at=now()));session.commit();return {'ok':True}
