"""Authenticated one-to-one student/teacher conversations."""
from datetime import timedelta
from uuid import UUID
from fastapi import APIRouter,Depends,HTTPException
from pydantic import Field
from sqlalchemy import select,func,update
from sqlalchemy.exc import IntegrityError
from .learning import StrictModel,database,principal,group_for,no_store,now
from .models import CampusMessage,Student,Group
router=APIRouter(prefix='/learning/messages',dependencies=[Depends(no_store)])
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
    return {'id':message.id,'sender':message.sender_role,'body':message.body,'created_at':message.created_at.isoformat()+'Z','read_at':message.read_at.isoformat()+'Z' if message.read_at else None}
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
        result.append({'student_id':student.public_id,'alias':student.pseudonym,'group':group.name if group else '', 'unread':unread.get(student.id,0),'last_message':latest.body[:100] if latest else '', 'updated_at':latest.created_at.isoformat()+'Z' if latest else None})
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
