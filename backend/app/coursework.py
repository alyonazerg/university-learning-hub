"""Teacher-confirmed coursework assessments and a group-scoped academic journal."""
from collections import defaultdict
from decimal import Decimal
from uuid import UUID
from datetime import timedelta
from fastapi import APIRouter,Depends,HTTPException,UploadFile,File,Response
from pydantic import Field
from sqlalchemy import select,func,delete
from sqlalchemy.exc import IntegrityError
from .learning import StrictModel,principal,administrator,database,no_store,now,group_for
from .models import (Student,Group,HomeworkTask,HomeworkGroup,HomeworkSubmission,CourseworkAiJob,
                     CourseworkReview,CourseworkCredit,CourseworkAttachment)
from .coursework_catalog import CATALOG,CAPS
from .coursework_contracts import hundredths

router=APIRouter(prefix='/learning/coursework',dependencies=[Depends(no_store)])

def assessment_view(work,session,teacher=False):
    job=session.get(CourseworkAiJob,work.id)
    review=session.scalar(select(CourseworkReview).where(CourseworkReview.submission_id==work.id).order_by(CourseworkReview.version.desc()).limit(1))
    files=session.scalars(select(CourseworkAttachment).where(CourseworkAttachment.submission_id==work.id))
    result={'review_version':work.review_version,'state':review.decision if review else ('ai_'+job.status if job and job.status in ('queued','running','failed') else 'teacher_review'),
            'review':{'decision':review.decision,'points':review.points/100 if review.points is not None else None,'comment':review.comment,'scores':review.scores,'created_at':review.created_at.isoformat()+'Z'} if review else None,
            'attachments':[{'id':f.id,'name':f.name,'size':len(f.data),'mime':f.mime} for f in files]}
    if teacher:result['ai']={'status':job.status,'attempts':job.attempts,'result':job.result,'error':job.error} if job else None
    return result

@router.get('/catalog')
def catalog(actor=Depends(principal)):return CATALOG

@router.get('/queue')
def queue(actor=Depends(administrator),session=Depends(database)):
    from .homework import submission_view
    rows=session.scalars(select(HomeworkSubmission).join(HomeworkTask).order_by(HomeworkSubmission.created_at,HomeworkSubmission.id))
    result=[]
    for work in rows:
        if not work.snapshot.get('assessment'):continue
        task=session.get(HomeworkTask,work.task_id)
        item=submission_view(work,session,True)
        item.update(title=work.snapshot.get('title',task.title),assessment=work.snapshot['assessment'],course_id=task.course_id)
        latest=session.scalar(select(func.max(HomeworkSubmission.attempt)).where(HomeworkSubmission.task_id==work.task_id,HomeworkSubmission.student_id==work.student_id))
        item['latest_attempt']=work.attempt==latest
        result.append(item)
    return result

class ReviewInput(StrictModel):
    request_id: UUID
    expected_version: int = Field(ge=0)
    decision: str = Field(pattern='^(graded|revision_requested)$')
    scores: dict[str,Decimal] = Field(default_factory=dict)
    comment: str = Field(min_length=1,max_length=10000)

@router.put('/submissions/{identifier}/review')
def review(identifier:str,body:ReviewInput,actor=Depends(administrator),session=Depends(database)):
    # Lock the assignment first, consistently with submission creation: prevents approving
    # an old attempt while a new submission is being created.
    source=session.get(HomeworkSubmission,identifier)
    if not source:raise HTTPException(404,'Submission not found')
    session.scalar(select(HomeworkTask).where(HomeworkTask.id==source.task_id).with_for_update())
    work=session.scalar(select(HomeworkSubmission).where(HomeworkSubmission.id==identifier).with_for_update())
    config=work.snapshot.get('assessment',{})
    if not config:raise HTTPException(409,'This legacy assignment has no grading policy. Its original feedback is preserved.')
    old=session.get(CourseworkReview,str(body.request_id))
    scores={k:str(v) for k,v in body.scores.items()} if body.decision=='graded' else {}
    if old:
        if (old.submission_id,old.decision,old.scores,old.comment)!=(identifier,body.decision,scores,body.comment):raise HTTPException(409,'Review request already used')
        return assessment_view(work,session,True)
    if work.review_version!=body.expected_version:raise HTTPException(409,'This assessment changed. Refresh before saving.')
    session.scalar(select(Student).where(Student.id==work.student_id).with_for_update())
    latest=session.scalar(select(func.max(HomeworkSubmission.attempt)).where(HomeworkSubmission.task_id==work.task_id,HomeworkSubmission.student_id==work.student_id))
    if latest!=work.attempt:raise HTTPException(409,'A newer attempt exists. Review the latest submission.')
    credit=session.get(CourseworkCredit,(work.task_id,work.student_id))
    points=None
    if body.decision=='graded':
        rubric={r['key']:Decimal(str(r['max'])) for r in config['rubric']}
        if set(body.scores)!=set(rubric):raise HTTPException(422,'Enter a score for every criterion')
        for key,value in body.scores.items():
            if not value.is_finite() or value<0 or value>rubric[key] or value!=value.quantize(Decimal('.01')):raise HTTPException(422,'Criterion scores must be within their maximum, with at most two decimal places')
        points=sum(hundredths(v) for v in body.scores.values())
        if points>hundredths(config['max_points']):raise HTTPException(422,'Total exceeds assignment maximum')
        if work.snapshot.get('course_id')=='speech' and config['category'] in ('imt','extra') and points>0:
            count=0
            for award in session.scalars(select(CourseworkCredit).where(CourseworkCredit.student_id==work.student_id,CourseworkCredit.task_id!=work.task_id,CourseworkCredit.points>0)):
                prior=session.get(HomeworkSubmission,award.submission_id).snapshot
                policy=prior.get('assessment',{})
                if prior.get('course_id')=='speech' and policy.get('semester')==config['semester'] and policy.get('category')==config['category'] and (config['category']=='extra' or policy.get('period')==config['period']):count+=1
            if count>=3:raise HTTPException(409,'At most three tasks may receive positive credit in this category/period. Correct an earlier award before adding another.')
    elif credit and credit.submission_id==work.id:
        raise HTTPException(409,'This work already has confirmed points. Save a corrected grade instead of removing its approval.')
    work.review_version+=1
    job=session.get(CourseworkAiJob,work.id)
    if job and job.status=='queued':job.status='cancelled';job.updated_at=now()
    record=CourseworkReview(id=str(body.request_id),submission_id=identifier,version=work.review_version,decision=body.decision,points=points,comment=body.comment,scores=scores)
    session.add(record)
    try:session.flush()
    except IntegrityError:
        session.rollback();raise HTTPException(409,'Assessment changed concurrently. Refresh before saving.')
    if points is not None:
        if not credit:
            credit=CourseworkCredit(task_id=work.task_id,student_id=work.student_id);session.add(credit)
        credit.submission_id=identifier;credit.review_id=record.id;credit.points=points
        credit.xp=config.get('xp',0) if points>0 else 0
    try:session.commit()
    except IntegrityError:
        session.rollback();raise HTTPException(409,'Assessment changed concurrently. Refresh before saving.')
    return assessment_view(work,session,True)

@router.post('/submissions/{identifier}/retry-ai')
def retry(identifier:str,actor=Depends(administrator),session=Depends(database)):
    job=session.scalar(select(CourseworkAiJob).where(CourseworkAiJob.submission_id==identifier).with_for_update())
    if not job:raise HTTPException(404,'No AI check for this submission')
    if job.status!='failed':raise HTTPException(409,'Only a failed AI check can be retried')
    if job.attempts>=3:raise HTTPException(409,'AI retry limit reached. Review this work manually.')
    job.status='queued';job.error='';job.updated_at=now();session.commit();return {'status':'queued'}

@router.get('/submissions/{identifier}/history')
def history(identifier:str,actor=Depends(principal),session=Depends(database)):
    work=session.get(HomeworkSubmission,identifier)
    if not work or (actor.role!='admin' and work.student_id!=actor.student_id):raise HTTPException(404,'Submission not found')
    rows=session.scalars(select(CourseworkReview).where(CourseworkReview.submission_id==identifier).order_by(CourseworkReview.version))
    return [{'version':r.version,'decision':r.decision,'points':r.points/100 if r.points is not None else None,'scores':r.scores,'comment':r.comment,'created_at':r.created_at.isoformat()+'Z'} for r in rows]

@router.get('/submissions/{identifier}')
def saved_work(identifier:str,actor=Depends(principal),session=Depends(database)):
    from .homework import submission_view
    work=session.get(HomeworkSubmission,identifier)
    if not work or (actor.role!='admin' and work.student_id!=actor.student_id):raise HTTPException(404,'Submission not found')
    return {**submission_view(work,session,actor.role=='admin'),'title':work.snapshot.get('title','Saved work')}

@router.post('/tasks/{identifier}/attachments',status_code=201)
async def upload(identifier:str,file:UploadFile=File(...),actor=Depends(principal),session=Depends(database)):
    from .homework import task_for,admitted
    if actor.role!='student':raise HTTPException(403,'Student access required')
    task=task_for(identifier,actor,session)
    if not admitted(task,actor.student_id,session):raise HTTPException(403,'Assignment access required')
    if now()<task.starts_at:raise HTTPException(409,'Task has not started')
    # Bounded uploads, not arbitrary URLs. Documents are never fetched from user links.
    name=(file.filename or 'document').replace('\\','/').rsplit('/',1)[-1][:160]
    suffix=name.rsplit('.',1)[-1].lower()
    types={'pdf':'application/pdf','docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','txt':'text/plain','mp3':'audio/mpeg','m4a':'audio/mp4','mp4':'video/mp4','webm':'video/webm','wav':'audio/wav'}
    if suffix not in types:raise HTTPException(422,'Use PDF, DOCX, TXT, MP3, M4A, MP4, WebM or WAV')
    raw=await file.read(12*1024*1024+1)
    if not raw or len(raw)>12*1024*1024:raise HTTPException(413,'Use a file up to 12 MB, or submit a private link for a larger recording')
    session.scalar(select(Student).where(Student.id==actor.student_id).with_for_update())
    session.execute(delete(CourseworkAttachment).where(CourseworkAttachment.student_id==actor.student_id,CourseworkAttachment.submission_id.is_(None),CourseworkAttachment.created_at<now()-timedelta(days=1)))
    count=session.scalar(select(func.count()).select_from(CourseworkAttachment).where(CourseworkAttachment.student_id==actor.student_id,CourseworkAttachment.created_at>now()-timedelta(hours=24)))
    if count>=12:raise HTTPException(429,'Daily upload limit reached. Reuse an uploaded file or try tomorrow.')
    pending=session.scalar(select(func.count()).select_from(CourseworkAttachment).where(CourseworkAttachment.student_id==actor.student_id,CourseworkAttachment.submission_id.is_(None)))
    if pending>=6:raise HTTPException(429,'Submit or remove unused uploads before adding more files')
    item=CourseworkAttachment(student_id=actor.student_id,task_id=identifier,name=name,mime=types[suffix],data=raw);session.add(item);session.commit()
    return {'id':item.id,'name':item.name,'size':len(raw)}

@router.get('/tasks/{identifier}/attachments')
def unused_uploads(identifier:str,actor=Depends(principal),session=Depends(database)):
    from .homework import task_for
    if actor.role!='student':raise HTTPException(403,'Student access required')
    task_for(identifier,actor,session)
    files=session.scalars(select(CourseworkAttachment).where(CourseworkAttachment.student_id==actor.student_id,CourseworkAttachment.task_id==identifier,CourseworkAttachment.submission_id.is_(None)).order_by(CourseworkAttachment.created_at))
    return [{'id':f.id,'name':f.name,'size':len(f.data)} for f in files]

@router.delete('/attachments/{identifier}',status_code=204)
def remove_upload(identifier:str,actor=Depends(principal),session=Depends(database)):
    item=session.get(CourseworkAttachment,identifier)
    if not item or actor.role!='student' or item.student_id!=actor.student_id or item.submission_id:raise HTTPException(404,'Unused upload not found')
    session.delete(item);session.commit()

@router.get('/attachments/{identifier}')
def download(identifier:str,actor=Depends(principal),session=Depends(database)):
    item=session.get(CourseworkAttachment,identifier)
    if not item or (actor.role!='admin' and item.student_id!=actor.student_id):raise HTTPException(404,'Attachment not found')
    from urllib.parse import quote
    return Response(item.data,media_type='application/octet-stream',headers={'Content-Disposition':"attachment; filename*=UTF-8''"+quote(item.name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})

@router.get('/journal')
def journal(group_id:int|None=None,semester:str='2026-2027-1',actor=Depends(principal),session=Depends(database)):
    if actor.role=='student':group_id=session.get(Student,actor.student_id).group_id
    if not group_id:raise HTTPException(422,'Choose a group')
    group=group_for(group_id,session)
    tasks=list(session.scalars(select(HomeworkTask).join(HomeworkGroup).where(HomeworkGroup.group_id==group_id).order_by(HomeworkTask.created_at,HomeworkTask.id)))
    assigned={t.id for t in tasks}
    member_ids=list(session.scalars(select(Student.id).where(Student.group_id==group_id,Student.is_active.is_(True))))
    if actor.role=='student':member_ids=[actor.student_id]
    previous_ids=set(session.scalars(select(CourseworkCredit.task_id).where(CourseworkCredit.student_id.in_(member_ids))))-assigned
    if previous_ids:tasks.extend(session.scalars(select(HomeworkTask).where(HomeworkTask.id.in_(previous_ids)).order_by(HomeworkTask.created_at,HomeworkTask.id)))
    tasks=[t for t in tasks if t.assessment_config.get('semester')==semester and t.course_id==group.course_id]
    query=select(Student).where(Student.group_id==group_id,Student.is_active.is_(True))
    if actor.role=='student':query=query.where(Student.id==actor.student_id)
    rows=[]
    for student in session.scalars(query.order_by(Student.pseudonym)):
        cells=[];buckets=defaultdict(int);xp=0;speech_counts=defaultdict(int)
        for task in tasks:
            config=task.assessment_config
            work=session.scalar(select(HomeworkSubmission).where(HomeworkSubmission.student_id==student.id,HomeworkSubmission.task_id==task.id).order_by(HomeworkSubmission.attempt.desc()).limit(1))
            award=session.get(CourseworkCredit,(task.id,student.id))
            detail=assessment_view(work,session,False) if work else None
            points=award.points if award else None
            if award:
                buckets[(str(config['period']),config['category'])]+=points;xp+=award.xp
                if points>0:speech_counts[(str(config['period']),config['category'])]+=1
            cells.append({'task_id':task.id,'submission_id':work.id if work else None,'state':detail['state'] if detail else ('not_assigned' if task.id not in assigned else 'not_selected' if task.kind in ('imt','extra') else 'not_submitted'),'points':points/100 if points is not None else None,'review':detail['review'] if detail else None,'previous_confirmed':bool(award and work and award.submission_id!=work.id)})
        categories=[];total=0
        for (period,category),raw in sorted(buckets.items()):
            cap=CAPS.get(group.course_id,{}).get(period,{}).get(category)
            counted=min(raw,hundredths(cap)) if cap is not None else raw
            # Extra is capped across the entire semester, not once per period.
            if category in ('extra','credit_test','credit_oral'):continue
            total+=counted;categories.append({'period':int(period),'category':category,'raw':raw/100,'credited':counted/100,'cap':cap})
        for special,cap in {'extra':15,'credit_test':6 if group.course_id=='grammar' else 0,'credit_oral':14 if group.course_id=='grammar' else 20}.items():
            raw=sum(v for (p,c),v in buckets.items() if c==special)
            if any(c==special for p,c in buckets):
                counted=min(raw,hundredths(cap));total+=counted;categories.append({'period':0,'category':special,'raw':raw/100,'credited':counted/100,'cap':cap})
        warnings=[]
        if group.course_id=='speech' and any(n>3 for (p,c),n in speech_counts.items() if c=='imt'):warnings.append('More than three IMT tasks graded in one period. Select the credited tasks before finalising this semester.')
        rows.append({'student_id':student.public_id,'alias':student.pseudonym,'cells':cells,'categories':categories,'total':total/100,'xp':xp,'warnings':warnings})
    return {'group':group.name,'semester':semester,'scope':'Confirmed points from assignments published with a grading policy. Standalone IMT and revision results are not automatically linked. Attendance awards no points.','tasks':[{'id':t.id,'title':t.title,'optional':t.kind in ('imt','extra'),'assessment':t.assessment_config} for t in tasks],'students':rows,'policy_version':'coursework-v1'}
