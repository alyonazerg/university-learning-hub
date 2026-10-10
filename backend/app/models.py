from datetime import datetime
import uuid
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base
class Group(Base):
    __tablename__ = "groups"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    course_id: Mapped[str] = mapped_column(String(16), default='speech')
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    students: Mapped[list["Student"]] = relationship(back_populates="group")
class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), unique=True, default=lambda: str(uuid.uuid4()))
    telegram_user_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    pseudonym: Mapped[str] = mapped_column(String(80), unique=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    group: Mapped[Group | None] = relationship(back_populates="students")
    identity: Mapped["IdentityRegistry | None"] = relationship(back_populates="student", uselist=False)
class IdentityRegistry(Base):
    __tablename__ = "identity_registry"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"), unique=True)
    legal_name: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    student: Mapped[Student] = relationship(back_populates="identity")


class PseudonymReservation(Base):
    __tablename__ = "pseudonym_reservations"
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    telegram_user_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    pseudonym: Mapped[str] = mapped_column(String(80), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class GroupInvitation(Base):
    __tablename__ = "group_invitations"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class CardEditor(Base):
    __tablename__ = 'card_editors'
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'))


class LearningSession(Base):
    __tablename__ = 'learning_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    role: Mapped[str] = mapped_column(String(16))
    student_id: Mapped[int | None] = mapped_column(ForeignKey('students.id'), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class VocabularyDeck(Base):
    __tablename__ = 'vocabulary_decks'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'))
    author_student_id: Mapped[int | None] = mapped_column(ForeignKey('students.id'), nullable=True)
    title: Mapped[str] = mapped_column(String(120))
    source: Mapped[str] = mapped_column(String(150), default='')
    status: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    cards: Mapped[list['VocabularyCard']] = relationship(back_populates='deck')


class VocabularyCard(Base):
    __tablename__ = 'vocabulary_cards'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deck_id: Mapped[str] = mapped_column(ForeignKey('vocabulary_decks.id'))
    position: Mapped[int] = mapped_column()
    content: Mapped[dict] = mapped_column(JSON)
    deck: Mapped[VocabularyDeck] = relationship(back_populates='cards')


class CardProgress(Base):
    __tablename__ = 'card_progress'
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'), primary_key=True)
    card_id: Mapped[str] = mapped_column(ForeignKey('vocabulary_cards.id'), primary_key=True)
    level: Mapped[int] = mapped_column(default=0)
    interval_days: Mapped[int] = mapped_column(default=0)
    due_at: Mapped[datetime] = mapped_column(DateTime)
    version: Mapped[int] = mapped_column(default=1)


class ReviewEvent(Base):
    __tablename__ = 'review_events'
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'), primary_key=True)
    card_id: Mapped[str] = mapped_column(ForeignKey('vocabulary_cards.id'), primary_key=True)
    day: Mapped[str] = mapped_column(String(10), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
