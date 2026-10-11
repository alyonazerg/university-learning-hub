"""Preview and atomically apply a reviewed, dated group schedule."""
from datetime import datetime
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from .learning import StrictModel, administrator, database, no_store
from .homework import utc
from .models import Group, LessonPlan
from .planning import validate_schedule

router = APIRouter(prefix='/learning/schedule-import', dependencies=[Depends(administrator), Depends(no_store)])


class ImportedLesson(StrictModel):
    topic: str = Field(min_length=1, max_length=200)
    starts_at: datetime
    duration_minutes: int = Field(ge=1, le=480)

    @field_validator('starts_at')
    @classmethod
    def dated(cls, value):
        return utc(value)


class ImportedGroup(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    course_id: Literal['grammar', 'speech']
    lessons: list[ImportedLesson] = Field(min_length=1, max_length=250)


class ScheduleImport(StrictModel):
    groups: list[ImportedGroup] = Field(min_length=1, max_length=30)


def prepare(payload, session, save):
    names = [group.name for group in payload.groups]
    if len(names) != len(set(names)):
        raise HTTPException(422, 'Duplicate group names in import')
    summary = []
    for item in sorted(payload.groups, key=lambda group: group.name):
        group = session.scalar(select(Group).where(Group.name == item.name).with_for_update())
        if group and (not group.is_active or group.course_id != item.course_id):
            raise HTTPException(409, 'Existing group has another course or is inactive')
        existing = list(session.scalars(select(LessonPlan).where(LessonPlan.group_id == group.id))) if group else []
        by_time = {row.starts_at: row for row in existing if row.starts_at}
        new = []
        skipped = 0
        for lesson in sorted(item.lessons, key=lambda lesson: lesson.starts_at):
            old = by_time.get(lesson.starts_at)
            if old:
                if old.duration_minutes != lesson.duration_minutes or old.kind != 'lesson':
                    raise HTTPException(409, 'Lessons overlap in this group')
                skipped += 1
            else:
                new.append(LessonPlan(**lesson.model_dump(), kind='lesson', position=1))
        validate_schedule(existing + new)
        # Validate duplicate input rows, including those already present on the server.
        validate_schedule(item.lessons)
        summary.append({'name': item.name, 'course_id': item.course_id, 'new_group': group is None,
                        'add': len(new), 'keep': skipped, 'total': len(item.lessons)})
        if save:
            if group is None:
                group = Group(name=item.name, course_id=item.course_id)
                session.add(group)
                session.flush()
            start = max([row.position for row in existing] or [0])
            for index, row in enumerate(new, start + 1):
                row.group_id = group.id
                row.position = index
            session.add_all(new)
    return {'groups': summary, 'add': sum(group['add'] for group in summary), 'keep': sum(group['keep'] for group in summary)}


@router.post('/preview')
def preview(payload: ScheduleImport, session=Depends(database)):
    return prepare(payload, session, False)


@router.post('/apply')
def apply(payload: ScheduleImport, session=Depends(database)):
    try:
        result = prepare(payload, session, True)
        session.commit()
        return result
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, 'Schedule changed concurrently; preview again')
    except HTTPException:
        session.rollback()
        raise
