from datetime import datetime, timedelta, timezone
import hashlib
import secrets

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError

from .settings import settings
from .auth import telegram_user_id
from .db import SessionLocal
from .models import Group, GroupInvitation, IdentityRegistry, PseudonymReservation, Student
from .pseudonyms import choose_pseudonym
from .schemas import GroupCreate, PseudonymView, StudentView, TelegramAuthentication, TelegramRegistration

app = FastAPI(title='University Learning Hub API', version=settings.app_version)
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_methods=['POST', 'GET'], allow_headers=['Content-Type', 'X-Admin-Token'])


def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def require_admin(x_admin_token: str | None = Header(default=None)):
    if not settings.admin_token or not x_admin_token or not secrets.compare_digest(x_admin_token.encode(), settings.admin_token.encode()):
        raise HTTPException(403, 'Admin access required')


def authenticate(payload):
    if not settings.telegram_bot_token:
        raise HTTPException(503, 'Telegram authentication is not configured')
    user_id = telegram_user_id(payload.telegram_data, payload.init_data, settings.telegram_bot_token)
    if user_id is None:
        raise HTTPException(401, 'Invalid or expired Telegram authentication')
    return user_id


def invitation_for(token, session):
    invitation = session.get(GroupInvitation, hashlib.sha256(token.encode()).hexdigest())
    if not invitation or invitation.expires_at <= now() or invitation.used:
        raise HTTPException(403, 'Invalid or expired invitation')
    group = session.get(Group, invitation.group_id)
    if not group or not group.is_active:
        raise HTTPException(403, 'Group is unavailable')
    return invitation


@app.get('/health', tags=['system'])
def health():
    return {'status': 'ok', 'version': settings.app_version}


@app.post('/auth/telegram/pseudonym', response_model=PseudonymView)
def reserve_pseudonym(payload: TelegramAuthentication, response: Response, session=Depends(db)):
    response.headers['Cache-Control'] = 'no-store'
    user_id = authenticate(payload)
    invitation_for(payload.invitation_token, session)
    if session.query(Student).filter_by(telegram_user_id=user_id).first():
        raise HTTPException(409, 'Telegram account is already registered')
    for _ in range(5):
        current = session.query(PseudonymReservation).filter_by(telegram_user_id=user_id).first()
        unavailable = {name for (name,) in session.query(Student.pseudonym).all()}
        unavailable.update(name for (name,) in session.query(PseudonymReservation.pseudonym).filter(PseudonymReservation.expires_at > now()).all())
        if current:
            unavailable.add(current.pseudonym)
        name = choose_pseudonym(unavailable)
        if name is None:
            raise HTTPException(409, 'No pseudonyms available; contact your teacher')
        session.query(PseudonymReservation).filter(PseudonymReservation.expires_at <= now()).delete(synchronize_session=False)
        session.query(PseudonymReservation).filter_by(telegram_user_id=user_id).delete(synchronize_session=False)
        token = secrets.token_urlsafe(32)
        session.add(PseudonymReservation(token=token, telegram_user_id=user_id, pseudonym=name, expires_at=now()+timedelta(minutes=5)))
        try:
            session.commit()
            return {'pseudonym': name, 'token': token, 'expires_in': 300}
        except IntegrityError:
            session.rollback()
    raise HTTPException(409, 'Please try generating a pseudonym again')


@app.post('/auth/telegram/register', response_model=StudentView, status_code=201)
def register(payload: TelegramRegistration, response: Response, session=Depends(db)):
    response.headers['Cache-Control'] = 'no-store'
    user_id = authenticate(payload)
    invitation = invitation_for(payload.invitation_token, session)
    reservation = session.get(PseudonymReservation, payload.pseudonym_token)
    if not reservation or reservation.telegram_user_id != user_id or reservation.expires_at <= now():
        raise HTTPException(409, 'Generate a new pseudonym')
    student = Student(telegram_user_id=user_id, pseudonym=reservation.pseudonym, group_id=invitation.group_id)
    consumed = session.execute(update(GroupInvitation).where(GroupInvitation.token_hash == invitation.token_hash, GroupInvitation.used.is_(False), GroupInvitation.expires_at > now()).values(used=True))
    if consumed.rowcount != 1:
        session.rollback()
        raise HTTPException(409, 'Invitation has already been used')
    session.add(student)
    session.delete(reservation)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Account or pseudonym is already registered')
    session.refresh(student)
    return student


@app.post('/groups', status_code=201, dependencies=[Depends(require_admin)])
def create_group(payload: GroupCreate, session=Depends(db)):
    group = Group(name=payload.name)
    session.add(group)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Group already exists')
    session.refresh(group)
    return {'id': group.id, 'name': group.name}


@app.post('/admin/groups/{group_id}/invitations', status_code=201, dependencies=[Depends(require_admin)])
def create_invitation(group_id: int, response: Response, session=Depends(db)):
    response.headers['Cache-Control'] = 'no-store'
    group = session.get(Group, group_id)
    if not group or not group.is_active:
        raise HTTPException(404, 'Group not found')
    token = secrets.token_urlsafe(32)
    session.add(GroupInvitation(token_hash=hashlib.sha256(token.encode()).hexdigest(), group_id=group_id, expires_at=now()+timedelta(days=7), used=False))
    session.commit()
    return {'invitation_token': token, 'expires_in': 604800}


@app.get('/admin/groups', dependencies=[Depends(require_admin)])
def list_groups(response: Response, session=Depends(db)):
    response.headers['Cache-Control'] = 'no-store'
    return [{'id': group.id, 'name': group.name, 'students': [{'id': student.public_id, 'pseudonym': student.pseudonym} for student in group.students]} for group in session.query(Group).order_by(Group.id).all()]


@app.get('/admin/identity-registry', dependencies=[Depends(require_admin)])
def identity_registry(response: Response, session=Depends(db)):
    response.headers['Cache-Control'] = 'no-store'
    return [{'student_id': i.student.public_id, 'legal_name': i.legal_name} for i in session.query(IdentityRegistry).all()]
