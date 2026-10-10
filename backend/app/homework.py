"""Authenticated coursework and attendance; public aliases only, never medical documents."""
import base64
import binascii
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID
from urllib.parse import urlsplit
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator, model_validator
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from .learning import StrictModel, database, principal, administrator, no_store, group_for, now
from .models import (Student, HomeworkTask, HomeworkGroup, CompensationAccess,
                     HomeworkSubmission, HomeworkFeedback, AttendanceLesson, AttendanceMark)

router = APIRouter(prefix='/learning', tags=['homework and attendance'], dependencies=[Depends(no_store)])


def utc(value):
    if value.tzinfo is None:
        raise ValueError('Dates need a timezone')
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def iso(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


class TaskInput(StrictModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20000)
    group_ids: list[int] = Field(min_length=1, max_length=200)
    kind: Literal['regular', 'imt', 'checkpoint', 'extra', 'compensation'] = 'regular'
    starts_at: datetime
    ends_at: datetime
    test_at: datetime | None = None
    checkpoint_id: UUID | None = None
    vocabulary: list[str] = Field(default_factory=list, max_length=100)
    constructions: list[str] = Field(default_factory=list, max_length=100)
    criteria: str = Field(default='', max_length=10000)

    @field_validator('starts_at', 'ends_at', 'test_at')
    @classmethod
    def dated(cls, value):
        return utc(value) if value else None

    @field_validator('group_ids')
    @classmethod
    def unique_groups(cls, values):
        if len(set(values)) != len(values) or any(value <= 0 for value in values):
            raise ValueError('Select unique groups')
        return values

    @field_validator('vocabulary', 'constructions')
    @classmethod
    def targets(cls, values):
        if any(not value.strip() or len(value) > 200 for value in values):
            raise ValueError('Targets need 1–200 characters')
        return list(dict.fromkeys(value.strip() for value in values))

    @model_validator(mode='after')
    def period(self):
        if self.ends_at < self.starts_at or (self.test_at and not self.starts_at <= self.test_at <= self.ends_at):
            raise ValueError('Invalid period or test date')
        if (self.kind == 'compensation') != bool(self.checkpoint_id):
            raise ValueError('Only compensation tasks require a checkpoint')
        if self.test_at and self.kind != 'checkpoint':
            raise ValueError('Test date belongs to a checkpoint')
        return self


class AccessInput(StrictModel):
    student_id: UUID
    certificate_checked: bool


class PhotoInput(StrictModel):
    name: str = Field(min_length=1, max_length=150)
    src: str = Field(max_length=1400000)

    @field_validator('src')
    @classmethod
    def jpeg(cls, value):
        # The browser resizes images and strips metadata through a canvas first.
        prefix = 'data:image/jpeg;base64,'
        if not value.startswith(prefix):
            raise ValueError('Only prepared JPEG photos are supported')
        try:
            data = base64.b64decode(value[len(prefix):], validate=True)
        except (binascii.Error, ValueError):
            raise ValueError('Invalid photo')
        if not 4 <= len(data) <= 1024 * 1024 or not data.startswith(b'\xff\xd8\xff') or not data.endswith(b'\xff\xd9'):
            raise ValueError('Invalid or oversized JPEG')
        return value


class SubmissionInput(StrictModel):
    kind: Literal['text', 'link'] = 'text'
    content: str = Field(default='', max_length=20000)
    photos: list[PhotoInput] = Field(default_factory=list, max_length=3)
    request_id: UUID

    @model_validator(mode='after')
    def answer(self):
        if not self.content and not self.photos:
            raise ValueError('Add text, link or photos')
        if self.kind == 'link':
            try:
                url = urlsplit(self.content)
                valid = url.scheme in ['https', 'http'] and url.hostname and not url.username and not url.password
                url.port
            except ValueError:
                valid = False
            if not valid or any(character.isspace() for character in self.content):
                raise ValueError('Use a full HTTP(S) link without credentials')
        return self


class FeedbackInput(StrictModel):
    comment: str = Field(min_length=1, max_length=10000)


class LessonInput(StrictModel):
    group_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=200)
    starts_at: datetime

    @field_validator('starts_at')
    @classmethod
    def dated(cls, value):
        return utc(value)


class MarkInput(StrictModel):
    student_id: UUID
    status: Literal['unmarked', 'present', 'late', 'absent', 'excused']


class MarksInput(StrictModel):
    marks: list[MarkInput] = Field(min_length=1, max_length=200)

    @field_validator('marks')
    @classmethod
    def unique_students(cls, values):
        if len({value.student_id for value in values}) != len(values):
            raise ValueError('Duplicate students')
        return values


def group_ids(task, session):
    return list(session.scalars(select(HomeworkGroup.group_id).where(HomeworkGroup.task_id == task.id).order_by(HomeworkGroup.group_id)))


def task_for(task_id, actor, session, lock=False):
    query = select(HomeworkTask).where(HomeworkTask.id == task_id)
    task = session.scalar(query.with_for_update() if lock else query)
    if not task:
        raise HTTPException(404, 'Task not found')
    if actor.role != 'admin':
        learner = session.get(Student, actor.student_id)
        if learner.group_id not in group_ids(task, session):
            raise HTTPException(404, 'Task not found')
    return task


def admitted(task, student_id, session):
    access = session.get(CompensationAccess, (task.checkpoint_id, student_id)) if task.kind == 'compensation' else None
    return task.kind != 'compensation' or bool(access and access.certificate_checked)


def task_view(task, actor, session):
    allowed = actor.role == 'admin' or admitted(task, actor.student_id, session)
    # Locked compensation contents are not sent to the student browser.
    return {'id': task.id, 'title': task.title, 'kind': task.kind, 'course_id': task.course_id,
            'group_ids': group_ids(task, session), 'starts_at': iso(task.starts_at), 'ends_at': iso(task.ends_at),
            'test_at': iso(task.test_at), 'checkpoint_id': task.checkpoint_id, 'allowed': allowed,
            'description': task.description if allowed else '', 'vocabulary': task.vocabulary if allowed else [],
            'constructions': task.constructions if allowed else [], 'criteria': task.criteria if allowed else '',
            'max_attempts': 3}


@router.get('/tasks')
def tasks(actor=Depends(principal), session=Depends(database)):
    query = select(HomeworkTask)
    if actor.role == 'student':
        learner = session.get(Student, actor.student_id)
        query = query.join(HomeworkGroup).where(HomeworkGroup.group_id == learner.group_id)
    return [task_view(task, actor, session) for task in session.scalars(query.order_by(HomeworkTask.created_at, HomeworkTask.id))]


@router.post('/tasks', status_code=201)
def create_task(payload: TaskInput, actor=Depends(administrator), session=Depends(database)):
    groups = [group_for(group_id, session) for group_id in payload.group_ids]
    if len({group.course_id for group in groups}) != 1:
        raise HTTPException(422, 'Choose groups from one course')
    if payload.checkpoint_id:
        checkpoint = task_for(str(payload.checkpoint_id), actor, session)
        if checkpoint.kind != 'checkpoint' or not set(payload.group_ids) <= set(group_ids(checkpoint, session)):
            raise HTTPException(422, 'Compensation must use groups of its checkpoint')
    values = payload.model_dump(exclude={'group_ids', 'checkpoint_id'})
    task = HomeworkTask(**values, course_id=groups[0].course_id,
                        checkpoint_id=str(payload.checkpoint_id) if payload.checkpoint_id else None)
    session.add(task)
    session.flush()
    session.add_all([HomeworkGroup(task_id=task.id, group_id=group.id) for group in groups])
    session.commit()
    return task_view(task, actor, session)


@router.get('/tasks/{task_id}/access', dependencies=[Depends(administrator)])
def access_roster(task_id: str, actor=Depends(administrator), session=Depends(database)):
    task = task_for(task_id, actor, session)
    if task.kind != 'checkpoint':
        raise HTTPException(422, 'Select a checkpoint')
    learners = session.scalars(select(Student).where(Student.group_id.in_(group_ids(task, session)), Student.is_active.is_(True)).order_by(Student.pseudonym))
    result = []
    for learner in learners:
        access = session.get(CompensationAccess, (task.id, learner.id))
        result.append({'student_id': learner.public_id, 'pseudonym': learner.pseudonym,
                       'certificate_checked': bool(access and access.certificate_checked)})
    return result


@router.put('/tasks/{task_id}/access')
def set_access(task_id: str, payload: AccessInput, actor=Depends(administrator), session=Depends(database)):
    task = task_for(task_id, actor, session, lock=True)
    if task.kind != 'checkpoint':
        raise HTTPException(422, 'Select a checkpoint')
    learner = session.scalar(select(Student).where(Student.public_id == str(payload.student_id), Student.is_active.is_(True)))
    if not learner or learner.group_id not in group_ids(task, session):
        raise HTTPException(404, 'Student not found in this group')
    access = session.get(CompensationAccess, (task.id, learner.id))
    if not access:
        access = CompensationAccess(checkpoint_id=task.id, student_id=learner.id)
        session.add(access)
    access.certificate_checked = payload.certificate_checked
    access.updated_at = now()
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Access changed concurrently; refresh')
    return {'student_id': learner.public_id, 'certificate_checked': access.certificate_checked}


def submission_view(submission, session):
    feedback = session.get(HomeworkFeedback, submission.id)
    learner = session.get(Student, submission.student_id)
    return {'id': submission.id, 'task_id': submission.task_id, 'student_id': learner.public_id,
            'pseudonym': learner.pseudonym, 'attempt': submission.attempt, 'kind': submission.kind,
            'content': submission.content, 'photos': submission.photos, 'created_at': iso(submission.created_at),
            'late': submission.late, 'feedback': feedback.comment if feedback else '',
            'feedback_updated_at': iso(feedback.updated_at) if feedback else None}


@router.get('/tasks/{task_id}/submissions')
def submissions(task_id: str, actor=Depends(principal), session=Depends(database)):
    task_for(task_id, actor, session)
    query = select(HomeworkSubmission).where(HomeworkSubmission.task_id == task_id)
    if actor.role == 'student':
        query = query.where(HomeworkSubmission.student_id == actor.student_id)
    return [submission_view(item, session) for item in session.scalars(query.order_by(HomeworkSubmission.created_at, HomeworkSubmission.attempt))]


@router.post('/tasks/{task_id}/submissions', status_code=201)
def submit(task_id: str, payload: SubmissionInput, actor=Depends(principal), session=Depends(database)):
    if actor.role != 'student':
        raise HTTPException(403, 'Student access required')
    task = task_for(task_id, actor, session, lock=True)
    if task.checkpoint_id:
        task_for(task.checkpoint_id, actor, session, lock=True)
    timestamp = now()
    if not admitted(task, actor.student_id, session):
        raise HTTPException(403, 'Compensation access required')
    if timestamp < task.starts_at:
        raise HTTPException(409, 'Task has not started')
    photos = [photo.model_dump() for photo in payload.photos]
    previous = session.scalar(select(HomeworkSubmission).where(HomeworkSubmission.student_id == actor.student_id, HomeworkSubmission.request_id == str(payload.request_id)))
    if previous:
        if (previous.task_id, previous.kind, previous.content, previous.photos) != (task_id, payload.kind, payload.content, photos):
            raise HTTPException(409, 'Request already used for another submission')
        return submission_view(previous, session)
    attempt = (session.scalar(select(func.max(HomeworkSubmission.attempt)).where(HomeworkSubmission.task_id == task_id, HomeworkSubmission.student_id == actor.student_id)) or 0) + 1
    if attempt > 3:
        raise HTTPException(409, 'All three attempts used')
    submission = HomeworkSubmission(task_id=task.id, student_id=actor.student_id, attempt=attempt,
        kind=payload.kind, content=payload.content, photos=photos, request_id=str(payload.request_id),
        created_at=timestamp, late=timestamp > task.ends_at)
    session.add(submission)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Submission changed concurrently; refresh')
    return submission_view(submission, session)


@router.put('/submissions/{submission_id}/feedback')
def feedback(submission_id: str, payload: FeedbackInput, actor=Depends(administrator), session=Depends(database)):
    submission = session.get(HomeworkSubmission, submission_id)
    if not submission:
        raise HTTPException(404, 'Submission not found')
    record = session.get(HomeworkFeedback, submission_id)
    if not record:
        record = HomeworkFeedback(submission_id=submission_id)
        session.add(record)
    record.comment, record.updated_at = payload.comment, now()
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Feedback changed concurrently; refresh')
    return submission_view(submission, session)


def lesson_view(lesson, actor, session):
    query = select(Student).where(Student.group_id == lesson.group_id, Student.is_active.is_(True))
    if actor.role == 'student':
        query = query.where(Student.id == actor.student_id)
    marks = []
    for learner in session.scalars(query.order_by(Student.pseudonym)):
        mark = session.get(AttendanceMark, (lesson.id, learner.id))
        marks.append({'student_id': learner.public_id, 'pseudonym': learner.pseudonym,
                      'status': mark.status if mark else 'unmarked'})
    return {'id': lesson.id, 'group_id': lesson.group_id, 'title': lesson.title,
            'starts_at': iso(lesson.starts_at), 'marks': marks}


@router.get('/attendance')
def attendance(actor=Depends(principal), session=Depends(database)):
    query = select(AttendanceLesson)
    if actor.role == 'student':
        query = query.where(AttendanceLesson.group_id == session.get(Student, actor.student_id).group_id)
    return [lesson_view(lesson, actor, session) for lesson in session.scalars(query.order_by(AttendanceLesson.starts_at.desc(), AttendanceLesson.id))]


@router.post('/attendance', status_code=201)
def create_lesson(payload: LessonInput, actor=Depends(administrator), session=Depends(database)):
    group_for(payload.group_id, session)
    lesson = AttendanceLesson(**payload.model_dump())
    session.add(lesson)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Lesson already exists at this time')
    return lesson_view(lesson, actor, session)


@router.put('/attendance/{lesson_id}')
def mark_attendance(lesson_id: str, payload: MarksInput, actor=Depends(administrator), session=Depends(database)):
    lesson = session.scalar(select(AttendanceLesson).where(AttendanceLesson.id == lesson_id).with_for_update())
    if not lesson:
        raise HTTPException(404, 'Lesson not found')
    group_for(lesson.group_id, session)
    learners = {learner.public_id: learner for learner in session.scalars(select(Student).where(Student.group_id == lesson.group_id, Student.is_active.is_(True)))}
    if any(str(mark.student_id) not in learners for mark in payload.marks):
        raise HTTPException(404, 'Student not found in this group')
    for value in payload.marks:
        learner = learners[str(value.student_id)]
        mark = session.get(AttendanceMark, (lesson_id, learner.id))
        if not mark:
            mark = AttendanceMark(lesson_id=lesson_id, student_id=learner.id)
            session.add(mark)
        mark.status, mark.updated_at = value.status, now()
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Attendance changed concurrently; refresh')
    return lesson_view(lesson, actor, session)
