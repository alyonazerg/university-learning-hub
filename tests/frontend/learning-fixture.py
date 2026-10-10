"""Synthetic integration fixture; never imports or uses real student records."""
from alembic import command
from alembic.config import Config
from app.db import SessionLocal
from app.models import Group, Student
command.upgrade(Config('alembic.ini'), 'head')
with SessionLocal() as session:
    first = Group(name='Synthetic speech',course_id='speech')
    other = Group(name='Synthetic grammar',course_id='grammar')
    session.add_all([first,other]); session.flush()
    session.add_all([Student(telegram_user_id=11,pseudonym='Silver Fern',group_id=first.id),Student(telegram_user_id=12,pseudonym='Silver Willow',group_id=first.id),Student(telegram_user_id=22,pseudonym='Amber Fern',group_id=other.id)])
    session.commit()
