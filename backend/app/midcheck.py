"""Authenticated pseudonym context for the existing Grammar Lab diagnostic."""
from fastapi import APIRouter,Depends,HTTPException
from .learning import principal,database,no_store,group_for
from .models import Student
router=APIRouter(prefix='/learning/midcheck',dependencies=[Depends(no_store)])

@router.get('/context')
def context(group_id:int,actor=Depends(principal),session=Depends(database)):
    if actor.role=='student':
        student=session.get(Student,actor.student_id)
        if student.group_id!=group_id: raise HTTPException(403,'This Midcheck belongs to another group')
        alias=student.pseudonym
    else: alias='Teacher Preview'
    group=group_for(group_id,session)
    if group.course_id!='grammar' or group.name not in ['150','151','154']:
        raise HTTPException(422,'Grammar Lab Topic 1 is available for grammar groups 150, 151 and 154')
    return {'alias':alias,'group':group.name,'preview':actor.role=='admin'}
