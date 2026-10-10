"""Durable group plans; students see only their group's schedule."""
from datetime import timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from .learning import StrictModel, principal, administrator, database, no_store, group_for
from .homework import utc, iso, TaskInput
from .models import LessonPlan, Student, AttendanceLesson
from datetime import datetime

router = APIRouter(prefix='/learning/plans', tags=['planning'], dependencies=[Depends(no_store)])


class PlanInput(StrictModel):
    group_id: int = Field(gt=0)
    position: int = Field(default=1, ge=1, le=10000)
    topic: str = Field(min_length=1, max_length=200)
    starts_at: datetime | None = None
    duration_minutes: int = Field(default=90, ge=1, le=480)
    room: str = Field(default='', max_length=200)
    kind: Literal['lesson', 'test', 'imt', 'extra'] = 'lesson'
    objectives: str = Field(default='', max_length=5000)
    materials: str = Field(default='', max_length=5000)
    vocabulary: list[str] = Field(default_factory=list, max_length=100)
    constructions: list[str] = Field(default_factory=list, max_length=100)
    completed: bool = False

    @field_validator('starts_at')
    @classmethod
    def dated(cls, value):
        return utc(value) if value else None

    @field_validator('vocabulary', 'constructions')
    @classmethod
    def targets(cls, values):
        return TaskInput.targets(values)


class BatchInput(StrictModel):
    lessons: list[PlanInput] = Field(min_length=1, max_length=120)


def view(plan):
    return {key: getattr(plan, key) for key in ['id', 'group_id', 'position', 'topic', 'duration_minutes',
            'room', 'kind', 'objectives', 'materials', 'vocabulary', 'constructions', 'completed', 'attendance_lesson_id']} | {'starts_at': iso(plan.starts_at)}


def validate_schedule(plans):
    dated = sorted([plan for plan in plans if plan.starts_at], key=lambda plan: plan.starts_at)
    for first, second in zip(dated, dated[1:]):
        if first.starts_at + timedelta(minutes=first.duration_minutes) > second.starts_at:
            raise HTTPException(409, 'Lessons overlap in this group')


@router.get('')
def plans(actor=Depends(principal), session=Depends(database)):
    query = select(LessonPlan)
    if actor.role == 'student':
        query = query.where(LessonPlan.group_id == session.get(Student, actor.student_id).group_id)
    return [view(plan) for plan in session.scalars(query.order_by(LessonPlan.group_id, LessonPlan.position, LessonPlan.id))]


@router.post('', status_code=201)
def create_plans(payload: BatchInput, actor=Depends(administrator), session=Depends(database)):
    gids = sorted({plan.group_id for plan in payload.lessons})
    # Lock in stable order to serialize schedule changes on PostgreSQL.
    from .models import Group
    for gid in gids:
        group_for(gid, session)
        session.scalar(select(Group).where(Group.id == gid).with_for_update())
    rows = [LessonPlan(**plan.model_dump()) for plan in payload.lessons]
    for gid in gids:
        existing = list(session.scalars(select(LessonPlan).where(LessonPlan.group_id == gid)))
        validate_schedule(existing + [row for row in rows if row.group_id == gid])
    session.add_all(rows)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Lessons overlap in this group')
    return [view(row) for row in rows]


@router.put('/{plan_id}')
def update_plan(plan_id: str, payload: PlanInput, actor=Depends(administrator), session=Depends(database)):
    from .models import Group
    session.scalar(select(Group).where(Group.id == payload.group_id).with_for_update())
    plan = session.scalar(select(LessonPlan).where(LessonPlan.id == plan_id).with_for_update())
    if not plan:
        raise HTTPException(404, 'Plan not found')
    if plan.group_id != payload.group_id:
        raise HTTPException(422, 'Plan group cannot be changed')
    group_for(plan.group_id, session)
    if plan.attendance_lesson_id and (plan.starts_at != payload.starts_at or plan.topic != payload.topic):
        raise HTTPException(409, 'Lesson already has an attendance journal')
    others = list(session.scalars(select(LessonPlan).where(LessonPlan.group_id == plan.group_id, LessonPlan.id != plan_id)))
    validate_schedule(others + [payload])
    for key, value in payload.model_dump().items():
        setattr(plan, key, value)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Lessons overlap in this group')
    return view(plan)


@router.post('/{plan_id}/attendance')
def open_attendance(plan_id: str, actor=Depends(administrator), session=Depends(database)):
    plan = session.scalar(select(LessonPlan).where(LessonPlan.id == plan_id).with_for_update())
    if not plan:
        raise HTTPException(404, 'Plan not found')
    group_for(plan.group_id, session)
    if not plan.starts_at:
        raise HTTPException(422, 'Set a lesson date first')
    if plan.attendance_lesson_id:
        return {'lesson_id': plan.attendance_lesson_id}
    lesson = session.scalar(select(AttendanceLesson).where(AttendanceLesson.group_id == plan.group_id, AttendanceLesson.starts_at == plan.starts_at))
    if lesson and lesson.title != plan.topic:
        raise HTTPException(409, 'Attendance topic differs; review the existing journal')
    if not lesson:
        lesson = AttendanceLesson(group_id=plan.group_id, starts_at=plan.starts_at, title=plan.topic)
        session.add(lesson)
        try:
            session.flush()
        except IntegrityError:
            session.rollback()
            raise HTTPException(409, 'Attendance changed concurrently; refresh')
    plan.attendance_lesson_id = lesson.id
    session.commit()
    return {'lesson_id': lesson.id}
