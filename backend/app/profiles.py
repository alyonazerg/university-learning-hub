"""Pseudonymous, opt-in group profiles. XP never changes academic grades."""
import re
import unicodedata
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator
from sqlalchemy.exc import IntegrityError
from .learning import StrictModel, principal, database, no_store
from .models import Student, StudentProfile, StudentXpEvent, ImtIdiomCollection, CampusMessage,CourseworkCredit

router = APIRouter(prefix='/learning/profile', dependencies=[Depends(no_store)])
MILESTONES = {
    'word_explorer': ('Word explorer', '🌱', 10),
    'practice_finisher': ('Practice finisher', '🌙', 30),
    'perfect_recall': ('Perfect recall', '✨', 20),
    'first_message': ('First connection', '💌', 10),
}

class ProfileBody(StrictModel):
    bio: str = Field(default='', max_length=160)
    avatar_seed: int = Field(ge=1, le=2147483647)
    avatar_theme: Literal['mooncat', 'starfox', 'forestowl', 'moonflower']
    share_profile: bool = False
    share_rating: bool = False

    @field_validator('bio')
    @classmethod
    def safe_bio(cls, value):
        if any(c.isalpha() and 'LATIN' not in unicodedata.name(c, '') for c in value):
            raise ValueError('Please write your short bio in English. Keep your name and personal details private.')
        if re.search(r'@|https?://|www\.|(?:\d[\s()+-]*){7,}', value, re.I):
            raise ValueError('Please remove contact details and links. Use only your campus alias.')
        return value

def student_actor(actor, session):
    if actor.role != 'student':
        raise HTTPException(403, 'Student profiles are available to students')
    return session.get(Student, actor.student_id)

def earned(session, student):
    """Award each verified milestone once for life, not once per retry/reset."""
    milestones = set()
    for collection in session.query(ImtIdiomCollection).filter_by(student_id=student.id):
        if collection.entries and collection.status != 'draft':
            milestones.add('word_explorer')
        attempt = collection.attempt or {}
        questions, responses = attempt.get('questions', []), attempt.get('responses', {})
        recall = attempt.get('recall_count', 0)
        if questions and all(str(i) in responses for i in range(len(questions))) and attempt.get('index', 0) >= len(questions):
            milestones.add('practice_finisher')
        if recall and all(responses.get(str(i), {}).get('correct') is True for i in range(recall)):
            milestones.add('perfect_recall')
    if session.query(CampusMessage.id).filter_by(student_id=student.id, sender_role='student').first():
        milestones.add('first_message')
    existing = {r.milestone for r in session.query(StudentXpEvent).filter_by(student_id=student.id)}
    for key in milestones - existing:
        try:
            with session.begin_nested():
                session.add(StudentXpEvent(student_id=student.id, milestone=key, points=MILESTONES[key][2]))
                session.flush()
        except IntegrityError:
            pass  # A concurrent refresh already awarded this milestone.
    return list(session.query(StudentXpEvent).filter_by(student_id=student.id))

def view(session, student, own=False):
    profile = session.get(StudentProfile, student.id)
    events = earned(session, student)
    result = {
        'alias': student.pseudonym, 'bio': profile.bio if profile else '',
        'avatar_seed': profile.avatar_seed if profile else student.id,
        'avatar_theme': profile.avatar_theme if profile else 'mooncat',
        'achievements': [{'key': e.milestone, 'label': MILESTONES[e.milestone][0], 'icon': MILESTONES[e.milestone][1], 'points': e.points} for e in events],
    }
    if own or (profile and profile.share_rating):
        result['xp'] = sum(e.points for e in events)+sum(r.xp for r in session.query(CourseworkCredit).filter_by(student_id=student.id))
    if own:
        result.update(share_profile=bool(profile and profile.share_profile), share_rating=bool(profile and profile.share_rating))
    return result

@router.get('')
def mine(actor=Depends(principal), session=Depends(database)):
    result = view(session, student_actor(actor, session), own=True)
    session.commit()
    return result

@router.put('')
def update(body: ProfileBody, actor=Depends(principal), session=Depends(database)):
    student = student_actor(actor, session)
    profile = session.get(StudentProfile, student.id)
    if not profile:
        profile = StudentProfile(student_id=student.id)
        session.add(profile)
    for key, value in body.model_dump().items():
        setattr(profile, key, value)
    if not profile.share_profile:
        profile.share_rating = False
    session.commit()
    return mine(actor, session)

@router.get('/group')
def group_profiles(actor=Depends(principal), session=Depends(database)):
    student = student_actor(actor, session)
    if not student.group_id:
        return {'profiles': [], 'leaderboard': []}
    students = session.query(Student).join(StudentProfile, StudentProfile.student_id == Student.id).filter(
        Student.group_id == student.group_id, Student.is_active.is_(True), StudentProfile.share_profile.is_(True)).all()
    rows = [view(session, s) for s in students]
    session.commit()
    rated = sorted((r for r in rows if 'xp' in r), key=lambda r: (-r['xp'], r['alias']))
    # Ties have equal rank; grades and student identifiers never enter this response.
    leaders = []
    for i, row in enumerate(rated):
        rank = i + 1 if not i or row['xp'] != rated[i-1]['xp'] else leaders[-1]['rank']
        leaders.append({'alias': row['alias'], 'xp': row['xp'], 'rank': rank})
    return {'profiles': rows, 'leaderboard': leaders[:10]}
