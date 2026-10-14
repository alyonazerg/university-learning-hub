from datetime import datetime
import uuid
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, String, Text, JSON, UniqueConstraint, CheckConstraint, LargeBinary
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
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)
    pseudonym: Mapped[str] = mapped_column(String(80), unique=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    telegram_messages_enabled: Mapped[bool] = mapped_column(Boolean,default=False)
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
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, nullable=True)
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


class HomeworkTask(Base):
    __tablename__ = 'homework_tasks'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    course_id: Mapped[str] = mapped_column(String(16))
    kind: Mapped[str] = mapped_column(String(20))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    test_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    checkpoint_id: Mapped[str | None] = mapped_column(ForeignKey('homework_tasks.id'), nullable=True)
    vocabulary: Mapped[list] = mapped_column(JSON, default=list)
    constructions: Mapped[list] = mapped_column(JSON, default=list)
    criteria: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class HomeworkGroup(Base):
    __tablename__ = 'homework_groups'
    task_id: Mapped[str] = mapped_column(ForeignKey('homework_tasks.id'), primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), primary_key=True)


class CompensationAccess(Base):
    __tablename__ = 'compensation_access'
    checkpoint_id: Mapped[str] = mapped_column(ForeignKey('homework_tasks.id'), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'), primary_key=True)
    certificate_checked: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class HomeworkSubmission(Base):
    __tablename__ = 'homework_submissions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task_id: Mapped[str] = mapped_column(ForeignKey('homework_tasks.id'), index=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'), index=True)
    attempt: Mapped[int] = mapped_column()
    kind: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    photos: Mapped[list] = mapped_column(JSON, default=list)
    request_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    late: Mapped[bool] = mapped_column(Boolean)
    __table_args__ = (UniqueConstraint('task_id', 'student_id', 'attempt', name='uq_homework_attempt'),
                      UniqueConstraint('student_id', 'request_id', name='uq_homework_request'),
                      CheckConstraint('attempt BETWEEN 1 AND 3', name='ck_homework_attempt'))


class HomeworkFeedback(Base):
    __tablename__ = 'homework_feedback'
    submission_id: Mapped[str] = mapped_column(ForeignKey('homework_submissions.id'), primary_key=True)
    comment: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AttendanceLesson(Base):
    __tablename__ = 'attendance_lessons'
    __table_args__ = (UniqueConstraint('group_id', 'starts_at', name='uq_attendance_lesson'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), index=True)
    title: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime)


class AttendanceMark(Base):
    __tablename__ = 'attendance_marks'
    lesson_id: Mapped[str] = mapped_column(ForeignKey('attendance_lessons.id'), primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'), primary_key=True)
    status: Mapped[str] = mapped_column(String(16))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LessonPlan(Base):
    __tablename__ = 'lesson_plans'
    __table_args__ = (UniqueConstraint('group_id', 'starts_at', name='uq_plan_group_time'),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'), index=True)
    position: Mapped[int] = mapped_column()
    topic: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(default=90)
    room: Mapped[str] = mapped_column(String(200), default='')
    kind: Mapped[str] = mapped_column(String(16), default='lesson')
    test_url: Mapped[str] = mapped_column(String(2048), default='')
    objectives: Mapped[str] = mapped_column(Text, default='')
    materials: Mapped[str] = mapped_column(Text, default='')
    vocabulary: Mapped[list] = mapped_column(JSON, default=list)
    constructions: Mapped[list] = mapped_column(JSON, default=list)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    attendance_lesson_id: Mapped[str | None] = mapped_column(ForeignKey('attendance_lessons.id'), nullable=True)

class RevisionGroup(Base):
    __tablename__='revision_groups'
    code: Mapped[str] = mapped_column(String(3),primary_key=True)
    condition: Mapped[str | None] = mapped_column(String(16),nullable=True)
    roster: Mapped[list] = mapped_column(JSON,default=list)
    emergent: Mapped[list] = mapped_column(JSON,default=list)
    expected_count: Mapped[int] = mapped_column(default=0)
    inactive_count: Mapped[int] = mapped_column(default=0)
    allocation_seed: Mapped[str] = mapped_column(String(40),default='')

class RevisionTest(Base):
    __tablename__='revision_tests'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    definition: Mapped[dict] = mapped_column(JSON)
    published: Mapped[bool] = mapped_column(Boolean,default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)

class RevisionAttempt(Base):
    __tablename__='revision_attempts'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    test_id: Mapped[str] = mapped_column(ForeignKey('revision_tests.id'),index=True)
    oral: Mapped[dict] = mapped_column(JSON,default=dict,nullable=False)
    research_consent: Mapped[bool] = mapped_column(Boolean,nullable=False)
    consent_version: Mapped[str] = mapped_column(String(40),nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64))
    student_id: Mapped[str] = mapped_column(String(36))
    student_name: Mapped[str] = mapped_column(String(100))
    group_code: Mapped[str] = mapped_column(String(3))
    condition: Mapped[str] = mapped_column(String(16))
    snapshot: Mapped[dict] = mapped_column(JSON)
    answers: Mapped[dict] = mapped_column(JSON,default=dict)
    timing: Mapped[dict] = mapped_column(JSON,default=dict)
    writing: Mapped[str] = mapped_column(Text,default='')
    report: Mapped[dict] = mapped_column(JSON,default=dict)
    started_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)
    begun_at: Mapped[datetime | None] = mapped_column(DateTime,nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime,nullable=True)
    teacher_status: Mapped[str] = mapped_column(String(16),default='pending')


class RevisionAudio(Base):
    __tablename__='revision_audio'
    __table_args__=(UniqueConstraint('owner_id','part',name='uq_revision_audio_part'),)
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    owner_id: Mapped[str] = mapped_column(ForeignKey('revision_attempts.id'),index=True)
    part: Mapped[str] = mapped_column(String(12))
    participants: Mapped[list] = mapped_column(JSON)
    first_speaker: Mapped[str] = mapped_column(String(36))
    mime: Mapped[str] = mapped_column(String(80))
    audio: Mapped[bytes] = mapped_column(LargeBinary)
    byte_count: Mapped[int] = mapped_column(default=0)
    status: Mapped[str] = mapped_column(String(20),default='uploaded')
    transcript: Mapped[dict] = mapped_column(JSON,default=dict)
    confirmations: Mapped[dict] = mapped_column(JSON,default=dict)
    analysis: Mapped[dict] = mapped_column(JSON,default=dict)
    suggestions: Mapped[dict] = mapped_column(JSON,default=dict)
    version: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)

class ImtIdiomCollection(Base):
    __tablename__='imt_idiom_collections'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    student_name: Mapped[str] = mapped_column(String(100))
    student_id: Mapped[int|None] = mapped_column(ForeignKey('students.id'),nullable=True,index=True)
    group_code: Mapped[str] = mapped_column(String(3),default='')
    coursebook: Mapped[str] = mapped_column(String(30),default='Evolve 5')
    unit: Mapped[str] = mapped_column(String(20),default='7')
    token_hash: Mapped[str] = mapped_column(String(64),unique=True,index=True)
    status: Mapped[str] = mapped_column(String(20),default='draft')
    entries: Mapped[list] = mapped_column(JSON,default=list)
    material_snapshot: Mapped[dict] = mapped_column(JSON,default=dict)
    attempt: Mapped[dict] = mapped_column(JSON,default=dict)
    result: Mapped[dict] = mapped_column(JSON,default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)

class BrowserAccount(Base):
    __tablename__='browser_accounts'
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'),primary_key=True)
    email: Mapped[str] = mapped_column(String(254),unique=True)
    password_hash: Mapped[str] = mapped_column(String(256))

class BrowserInvitation(Base):
    __tablename__='browser_invitations'
    id: Mapped[str] = mapped_column(String(36),primary_key=True,default=lambda:str(uuid.uuid4()))
    token_hash: Mapped[str] = mapped_column(String(64),unique=True)
    group_id: Mapped[int] = mapped_column(ForeignKey('groups.id'))
    label: Mapped[str] = mapped_column(String(100),default='')
    student_id: Mapped[int|None] = mapped_column(ForeignKey('students.id'),nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
class BugReport(Base):
    __tablename__='bug_reports'
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    steps: Mapped[str] = mapped_column(Text,default='')
    expected: Mapped[str] = mapped_column(Text,default='')
    page: Mapped[str] = mapped_column(String(500))
    environment: Mapped[dict] = mapped_column(JSON,default=dict)
    status: Mapped[str] = mapped_column(String(24),default='new')
    priority: Mapped[str] = mapped_column(String(16),default='medium')
    assignee: Mapped[str] = mapped_column(String(100),default='')
    reporter: Mapped[str] = mapped_column(String(100),default='Guest')
    receipt_hash: Mapped[str] = mapped_column(String(64),unique=True)
    submitter_hash: Mapped[str] = mapped_column(String(64),index=True)
    screenshot: Mapped[bytes|None] = mapped_column(LargeBinary,nullable=True)
    screenshot_mime: Mapped[str] = mapped_column(String(30),default='')
    history: Mapped[list] = mapped_column(JSON,default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)
class CampusMessage(Base):
    __tablename__='campus_messages'
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey('students.id'),index=True)
    sender_role: Mapped[str] = mapped_column(String(16))
    body: Mapped[str] = mapped_column(Text)
    group_name: Mapped[str] = mapped_column(String(120),default='')
    telegram_status: Mapped[str] = mapped_column(String(16),default='pending')
    request_id: Mapped[str] = mapped_column(String(36),unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)
    read_at: Mapped[datetime|None] = mapped_column(DateTime,nullable=True)

class MessageBroadcast(Base):
    __tablename__='message_broadcasts'
    id: Mapped[str] = mapped_column(String(36),primary_key=True)
    body: Mapped[str] = mapped_column(Text)
    groups: Mapped[list] = mapped_column(JSON)
    recipients: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime,default=datetime.utcnow)

class TeacherTelegramAlert(Base):
    __tablename__='teacher_telegram_alerts'
    id: Mapped[int] = mapped_column(primary_key=True)
    chat_id: Mapped[int] = mapped_column(BigInteger)
    enabled: Mapped[bool] = mapped_column(Boolean,default=True)
