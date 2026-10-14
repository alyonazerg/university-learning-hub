"""Invitation-only student accounts for ordinary browsers."""
import hashlib,re,secrets
from datetime import timedelta
from fastapi import APIRouter,Depends,HTTPException
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from .learning import StrictModel,database,administrator,no_store,now,group_for,issue_session
from .models import BrowserAccount,BrowserInvitation,Student
router=APIRouter(prefix='/learning',dependencies=[Depends(no_store)])
def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def password_hash(password,salt=None):
    salt=salt or secrets.token_hex(16)
    return salt+':'+hashlib.scrypt(password.encode(),salt=bytes.fromhex(salt),n=16384,r=8,p=1).hex()
class Bulk(StrictModel):
    names:list[str]=Field(default_factory=list,max_length=100)
    count:int=Field(default=1,ge=1,le=100)
class Credentials(StrictModel):
    email:str=Field(min_length=3,max_length=254)
    password:str=Field(min_length=10,max_length=128)
class Registration(Credentials):
    invitation:str=Field(min_length=1,max_length=128)
    alias:str=Field(min_length=3,max_length=80)
def email(value):
    value=value.strip().lower()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value): raise HTTPException(422,'Enter a valid email address')
    return value
@router.post('/groups/{group_id}/browser-invitations',dependencies=[Depends(administrator)])
def invitations(group_id:int,body:Bulk,session=Depends(database)):
    group_for(group_id,session);result=[]
    for i,label in enumerate(body.names or ['Student '+str(i+1) for i in range(body.count)]):
        token=secrets.token_urlsafe(32)
        row=BrowserInvitation(token_hash=digest(token),group_id=group_id,label=label[:100],expires_at=now()+timedelta(days=14))
        session.add(row);session.flush();result.append({'id':row.id,'label':row.label,'link':'/student-account.html#invite='+token,'status':'Not registered'})
    session.commit();return result
@router.get('/groups/{group_id}/browser-invitations',dependencies=[Depends(administrator)])
def invitation_status(group_id:int,session=Depends(database)):
    group_for(group_id,session)
    return [{'id':r.id,'label':r.label,'status':'Registered' if r.student_id else 'Expired' if r.expires_at<=now() else 'Not registered','alias':session.get(Student,r.student_id).pseudonym if r.student_id else None} for r in session.scalars(select(BrowserInvitation).where(BrowserInvitation.group_id==group_id))]
@router.post('/register/browser')
def register(body:Registration,session=Depends(database)):
    invitation=session.scalar(select(BrowserInvitation).where(BrowserInvitation.token_hash==digest(body.invitation)).with_for_update())
    if not invitation or invitation.student_id or invitation.expires_at<=now(): raise HTTPException(410,'Invitation expired or already used')
    group_for(invitation.group_id,session)
    student=Student(pseudonym=body.alias,group_id=invitation.group_id)
    session.add(student)
    try:
        session.flush();session.add(BrowserAccount(student_id=student.id,email=email(body.email),password_hash=password_hash(body.password)));invitation.student_id=student.id;session.commit()
    except IntegrityError:
        session.rollback();raise HTTPException(409,'This email or alias is already in use. Choose another alias or sign in.')
    return issue_session('student',student.id,session)
@router.post('/login/browser')
def login(body:Credentials,session=Depends(database)):
    account=session.scalar(select(BrowserAccount).where(BrowserAccount.email==email(body.email)))
    reference=account.password_hash if account else password_hash('dummy-password-value')
    if not secrets.compare_digest(password_hash(body.password,reference.split(':')[0]),reference) or not account: raise HTTPException(401,'Incorrect email or password')
    student=session.get(Student,account.student_id)
    if not student or not student.is_active: raise HTTPException(403,'Student unavailable')
    group_for(student.group_id,session);return issue_session('student',student.id,session)
