"""Persistent, group-scoped vocabulary with expiring server-authorized sessions."""
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import hashlib
import secrets
import unicodedata
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, update, delete
from sqlalchemy.exc import IntegrityError
from .auth import telegram_user_id
from .db import SessionLocal
from .models import Group, Student, LearningSession, CardEditor, VocabularyDeck, VocabularyCard, CardProgress, ReviewEvent
from .settings import settings

router = APIRouter(prefix='/learning', tags=['learning'])

def now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

def database():
    with SessionLocal() as session:
        yield session

def no_store(response: Response):
    response.headers['Cache-Control'] = 'no-store'

def group_for(group_id, session):
    group = session.get(Group, group_id)
    if not group or not group.is_active:
        raise HTTPException(404, 'Group not found')
    return group

def principal(authorization: str | None = Header(default=None), session=Depends(database)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Sign in required')
    record = session.get(LearningSession, hashlib.sha256(authorization[7:].encode()).hexdigest())
    if not record or record.expires_at <= now():
        raise HTTPException(401, 'Session expired')
    if record.role == 'student':
        student = session.get(Student, record.student_id)
        if not student or not student.is_active:
            raise HTTPException(403, 'Student unavailable')
        group_for(student.group_id, session)
    elif record.role != 'admin':
        raise HTTPException(403, 'Invalid role')
    return record

def administrator(actor=Depends(principal)):
    if actor.role != 'admin':
        raise HTTPException(403, 'Administrator access required')
    return actor

def check_group(actor, group_id, session):
    group_for(group_id, session)
    if actor.role != 'admin' and session.get(Student, actor.student_id).group_id != group_id:
        raise HTTPException(404, 'Group not found')

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)

class TelegramLogin(StrictModel):
    telegram_data: dict[str, str] = Field(default_factory=dict)
    init_data: str = Field(default='', max_length=16384)

class AdminLogin(StrictModel):
    token: str = Field(min_length=1, max_length=512)

class EditorUpdate(StrictModel):
    student_id: str | None = Field(default=None, max_length=36)

class GroupInput(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    course_id: Literal['speech', 'grammar']


class CardInput(StrictModel):
    term: str = Field(min_length=1, max_length=120)
    meaning: str = Field(min_length=1, max_length=300)
    definition: str = Field(default='', max_length=500)
    transcription: str = Field(default='', max_length=120)
    example: str = Field(default='', max_length=500)
    synonyms: list[str] = Field(default_factory=list, max_length=10)
    antonyms: list[str] = Field(default_factory=list, max_length=10)
    collocations: list[str] = Field(default_factory=list, max_length=10)
    @field_validator('synonyms', 'antonyms', 'collocations')
    @classmethod
    def bounded_phrases(cls, values):
        if any(not value.strip() or len(value) > 150 for value in values):
            raise ValueError('Phrases must contain 1–150 characters')
        return [value.strip() for value in values]

class DeckInput(StrictModel):
    title: str = Field(min_length=1, max_length=120)
    source: str = Field(default='', max_length=150)
    group_id: int = Field(gt=0)
    cards: list[CardInput] = Field(min_length=1, max_length=100)
    @field_validator('cards')
    @classmethod
    def unique_cards(cls, cards):
        keys = [unicodedata.normalize('NFKC', card.term).casefold() for card in cards]
        if len(set(keys)) != len(keys):
            raise ValueError('Duplicate expressions')
        return cards

class ReviewInput(StrictModel):
    rating: Literal['again', 'hard', 'good', 'easy']

def issue_session(role, student_id, session):
    token = secrets.token_urlsafe(32)
    session.query(LearningSession).filter(LearningSession.expires_at <= now()).delete(synchronize_session=False)
    session.add(LearningSession(token_hash=hashlib.sha256(token.encode()).hexdigest(), role=role, student_id=student_id, expires_at=now()+timedelta(hours=8)))
    session.commit()
    return {'access_token': token, 'expires_in': 28800, 'role': role}

@router.post('/login/telegram', dependencies=[Depends(no_store)])
def login_telegram(payload: TelegramLogin, session=Depends(database)):
    if not settings.telegram_bot_token:
        raise HTTPException(503, 'Telegram authentication is not configured')
    user_id = telegram_user_id(payload.telegram_data, payload.init_data, settings.telegram_bot_token)
    if user_id is None:
        raise HTTPException(401, 'Invalid or expired Telegram authentication')
    student = session.scalar(select(Student).where(Student.telegram_user_id == user_id))
    if not student or not student.is_active:
        raise HTTPException(403, 'Registered student required')
    group_for(student.group_id, session)
    return issue_session('student', student.id, session)

@router.post('/login/admin', dependencies=[Depends(no_store)])
def login_admin(payload: AdminLogin, session=Depends(database)):
    if not settings.admin_token or not secrets.compare_digest(payload.token.encode(), settings.admin_token.encode()):
        raise HTTPException(403, 'Administrator access required')
    return issue_session('admin', None, session)

@router.post('/logout', status_code=204, dependencies=[Depends(no_store)])
def logout(actor=Depends(principal), session=Depends(database)):
    session.delete(actor)
    session.commit()

@router.get('/me', dependencies=[Depends(no_store)])
def me(actor=Depends(principal), session=Depends(database)):
    if actor.role == 'admin':
        return {'role': 'admin'}
    student = session.get(Student, actor.student_id)
    editor = session.get(CardEditor, student.group_id)
    return {'role': 'student', 'pseudonym': student.pseudonym, 'group_id': student.group_id, 'is_card_editor': bool(editor and editor.student_id == student.id)}

@router.get('/groups', dependencies=[Depends(administrator), Depends(no_store)])
def groups(session=Depends(database)):
    result = []
    for group in session.scalars(select(Group).where(Group.is_active.is_(True)).order_by(Group.id)):
        editor = session.get(CardEditor, group.id)
        result.append({'id': group.id, 'name': group.name, 'course_id': group.course_id,
            'editor_student_id': session.get(Student, editor.student_id).public_id if editor else None,
            'students': [{'id': student.public_id, 'pseudonym': student.pseudonym} for student in group.students if student.is_active]})
    return result

@router.post('/groups', status_code=201, dependencies=[Depends(administrator), Depends(no_store)])
def create_group(payload: GroupInput, session=Depends(database)):
    group = Group(name=payload.name, course_id=payload.course_id)
    session.add(group)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Group already exists')
    return {'id': group.id, 'name': group.name, 'course_id': group.course_id}


@router.put('/groups/{group_id}/editor', dependencies=[Depends(administrator), Depends(no_store)])
def assign_editor(group_id: int, payload: EditorUpdate, session=Depends(database)):
    group_for(group_id, session)
    student = None
    if payload.student_id:
        student = session.scalar(select(Student).where(Student.public_id == payload.student_id, Student.group_id == group_id, Student.is_active.is_(True)))
        if not student:
            raise HTTPException(404, 'Student not found in this group')
    existing = session.get(CardEditor, group_id)
    if existing:
        if student:
            existing.student_id = student.id
        else:
            session.delete(existing)
    elif student:
        session.add(CardEditor(group_id=group_id, student_id=student.id))
    session.commit()
    return {'student_id': student.public_id if student else None}

def deck_view(deck):
    return {'id': deck.id, 'title': deck.title, 'source': deck.source, 'group_id': deck.group_id, 'status': deck.status,
        'cards': [{'id': card.id, **card.content} for card in sorted(deck.cards, key=lambda card: card.position)]}

@router.get('/decks', dependencies=[Depends(no_store)])
def decks(actor=Depends(principal), session=Depends(database)):
    query = select(VocabularyDeck)
    if actor.role == 'student':
        student = session.get(Student, actor.student_id)
        query = query.where(VocabularyDeck.group_id == student.group_id)
        query = query.where((VocabularyDeck.status == 'approved') | (VocabularyDeck.author_student_id == student.id))
    return [deck_view(deck) for deck in session.scalars(query.order_by(VocabularyDeck.created_at, VocabularyDeck.id))]

@router.post('/decks', status_code=201, dependencies=[Depends(no_store)])
def create_deck(payload: DeckInput, actor=Depends(principal), session=Depends(database)):
    check_group(actor, payload.group_id, session)
    if actor.role == 'student':
        editor = session.get(CardEditor, payload.group_id)
        rich = any(card.definition or card.transcription or card.synonyms or card.antonyms or card.collocations for card in payload.cards)
        if rich and (not editor or editor.student_id != actor.student_id):
            raise HTTPException(403, 'Appointed card editor required')
    deck = VocabularyDeck(title=payload.title, source=payload.source, group_id=payload.group_id,
        author_student_id=actor.student_id, status='approved' if actor.role == 'admin' else 'pending')
    session.add(deck)
    session.flush()
    for index, card in enumerate(payload.cards):
        session.add(VocabularyCard(deck_id=deck.id, position=index, content=card.model_dump()))
    session.commit()
    session.refresh(deck)
    return deck_view(deck)

@router.put('/decks/{deck_id}', dependencies=[Depends(administrator), Depends(no_store)])
def correct_draft(deck_id: str, payload: DeckInput, session=Depends(database)):
    deck = session.get(VocabularyDeck, deck_id)
    if not deck:
        raise HTTPException(404, 'Deck not found')
    if deck.group_id != payload.group_id:
        raise HTTPException(422, 'Draft group cannot be changed')
    group_for(deck.group_id, session)
    changed = session.execute(update(VocabularyDeck).where(VocabularyDeck.id == deck_id, VocabularyDeck.status == 'pending').values(title=payload.title, source=payload.source))
    if changed.rowcount != 1:
        session.rollback()
        raise HTTPException(409, 'Published deck cannot be rewritten')
    session.execute(delete(VocabularyCard).where(VocabularyCard.deck_id == deck_id))
    for index, card in enumerate(payload.cards):
        session.add(VocabularyCard(deck_id=deck_id, position=index, content=card.model_dump()))
    session.commit()
    session.expire(deck, ['cards'])
    return deck_view(deck)


@router.post('/decks/{deck_id}/approve', dependencies=[Depends(administrator), Depends(no_store)])
def approve(deck_id: str, session=Depends(database)):
    deck = session.get(VocabularyDeck, deck_id)
    if not deck:
        raise HTTPException(404, 'Deck not found')
    group_for(deck.group_id, session)
    deck.status = 'approved'
    session.commit()
    return deck_view(deck)

def intervals(progress):
    previous = progress.interval_days if progress else 0
    return {'again': 600, 'hard': max(1, min(365, int(previous*1.2+0.5)))*86400,
        'good': max(3, min(365, int(previous*2+0.5)))*86400, 'easy': max(7, min(365, int(previous*3+0.5)))*86400}

@router.get('/study', dependencies=[Depends(no_store)])
def study(actor=Depends(principal), session=Depends(database)):
    if actor.role != 'student':
        raise HTTPException(403, 'Student access required')
    student = session.get(Student, actor.student_id)
    cards = session.scalars(select(VocabularyCard).join(VocabularyDeck).where(VocabularyDeck.group_id == student.group_id, VocabularyDeck.status == 'approved').order_by(VocabularyDeck.created_at, VocabularyDeck.id, VocabularyCard.position)).all()
    progress = {item.card_id: item for item in session.scalars(select(CardProgress).where(CardProgress.student_id == student.id))}
    events = session.scalars(select(ReviewEvent).where(ReviewEvent.student_id == student.id)).all()
    dates = {event.day for event in events}
    current = now().replace(tzinfo=timezone.utc).astimezone(ZoneInfo('Europe/Moscow')).date()
    if current.isoformat() not in dates:
        current -= timedelta(days=1)
    streak = 0
    while current.isoformat() in dates:
        streak += 1
        current -= timedelta(days=1)
    return {'total': len(cards), 'reinforced': sum(1 for card in cards if card.id in progress and progress[card.id].level >= 3),
        'xp': len(events), 'streak': streak,
        'due': [{'id': card.id, **card.content, 'intervals': intervals(progress.get(card.id))} for card in cards if card.id not in progress or progress[card.id].due_at <= now()]}

@router.post('/cards/{card_id}/review', dependencies=[Depends(no_store)])
def review(card_id: str, payload: ReviewInput, actor=Depends(principal), session=Depends(database)):
    if actor.role != 'student':
        raise HTTPException(403, 'Student access required')
    card = session.get(VocabularyCard, card_id)
    if not card:
        raise HTTPException(404, 'Card not found')
    deck = session.get(VocabularyDeck, card.deck_id)
    check_group(actor, deck.group_id, session)
    if deck.status != 'approved':
        raise HTTPException(404, 'Card not found')
    timestamp = now()
    previous = session.get(CardProgress, (actor.student_id, card_id))
    if previous and previous.due_at > timestamp:
        raise HTTPException(409, 'Card is not due yet')
    delay = intervals(previous)[payload.rating]
    old_level = previous.level if previous else 0
    level = 0 if payload.rating == 'again' else old_level if payload.rating == 'hard' else min(old_level+1, 4)
    values = {'level': level, 'interval_days': 0 if payload.rating == 'again' else delay//86400, 'due_at': timestamp+timedelta(seconds=delay)}
    if previous:
        changed = session.execute(update(CardProgress).where(CardProgress.student_id == actor.student_id, CardProgress.card_id == card_id, CardProgress.version == previous.version, CardProgress.due_at <= timestamp).values(**values, version=previous.version+1))
        if changed.rowcount != 1:
            session.rollback()
            raise HTTPException(409, 'Review already recorded')
    else:
        session.add(CardProgress(student_id=actor.student_id, card_id=card_id, version=1, **values))
    day = timestamp.replace(tzinfo=timezone.utc).astimezone(ZoneInfo('Europe/Moscow')).date().isoformat()
    if not session.get(ReviewEvent, (actor.student_id, card_id, day)):
        session.add(ReviewEvent(student_id=actor.student_id, card_id=card_id, day=day, created_at=timestamp))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Review already recorded')
    return {'due_at': values['due_at'].replace(tzinfo=timezone.utc).isoformat(), 'level': level}
