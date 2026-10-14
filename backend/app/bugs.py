"""Private issue queue, with public submission and capability-based receipts."""
import hashlib,json,secrets
from datetime import timedelta
from urllib.parse import urlsplit
from fastapi import APIRouter,Depends,HTTPException,Request,Response,UploadFile,File,Form,Header
from pydantic import Field
from sqlalchemy import select,func
from .learning import StrictModel,administrator,database,no_store,now
from .models import BugReport,LearningSession,Student
router=APIRouter(prefix='/learning/bugs',dependencies=[Depends(no_store)])
STATUSES={'new','triaged','in_progress','resolved','closed'}
PRIORITIES={'low','medium','high','critical'}
def sha(value):return hashlib.sha256(value.encode()).hexdigest()
def view(row):
    return {'id':row.id,'key':f'MC-{row.id:04d}','title':row.title,'description':row.description,'steps':row.steps,'expected':row.expected,'page':row.page,'environment':row.environment,'status':row.status,'priority':row.priority,'assignee':row.assignee,'reporter':row.reporter,'has_screenshot':bool(row.screenshot),'history':row.history,'created_at':row.created_at.isoformat(),'updated_at':row.updated_at.isoformat()}
@router.post('',status_code=201)
async def create(request:Request,title:str=Form(...),description:str=Form(...),steps:str=Form(''),expected:str=Form(''),page:str=Form(''),environment:str=Form('{}'),screenshot:UploadFile|None=File(None),authorization:str|None=Header(None),session=Depends(database)):
    if not 3<=len(title.strip())<=160 or not 5<=len(description.strip())<=5000 or len(steps)>3000 or len(expected)>2000:raise HTTPException(422,'Add a short title and a description of the problem.')
    address=request.client.host if request.client else 'unknown'
    submitter=sha(address)
    count=session.scalar(select(func.count()).select_from(BugReport).where(BugReport.submitter_hash==submitter,BugReport.created_at>now()-timedelta(hours=1)))
    if count>=20:raise HTTPException(429,'Too many reports. Please try again later.')
    try:
        data=json.loads(environment)
        if not isinstance(data,dict):raise ValueError()
        env={k:str(data.get(k,''))[:300] for k in ['browser','viewport','language','online','app_version']}
    except (ValueError,TypeError):raise HTTPException(422,'Invalid browser information')
    try:
        parsed=urlsplit(page)
        cleanpage=parsed.path[:500]  # Drop query/hash: invitation and attempt secrets.
    except ValueError:cleanpage=''
    image=None;mime=''
    if screenshot:
        image=await screenshot.read(5*1024*1024+1)
        if len(image)>5*1024*1024:raise HTTPException(413,'Screenshot must be under 5 MB.')
        if image.startswith(b'\x89PNG\r\n\x1a\n'):mime='image/png'
        elif image.startswith(b'\xff\xd8\xff'):mime='image/jpeg'
        elif image.startswith(b'RIFF') and image[8:12]==b'WEBP':mime='image/webp'
        else:raise HTTPException(422,'Use a PNG, JPG or WebP screenshot.')
    reporter='Guest'
    if authorization and authorization.startswith('Bearer '):
        record=session.get(LearningSession,sha(authorization[7:]))
        if record and record.expires_at>now():reporter='Teacher' if record.role=='admin' else session.get(Student,record.student_id).pseudonym if record.student_id else 'Guest'
    token=secrets.token_urlsafe(32)
    row=BugReport(title=title.strip(),description=description.strip(),steps=steps,expected=expected,page=cleanpage,environment=env,reporter=reporter,receipt_hash=sha(token),submitter_hash=submitter,screenshot=image,screenshot_mime=mime,history=[{'at':now().isoformat(),'action':'created','author':reporter}])
    session.add(row);session.commit()
    return {'id':row.id,'key':f'MC-{row.id:04d}','receipt':token,'status':row.status}
@router.get('',dependencies=[Depends(administrator)])
def queue(session=Depends(database)):return [view(row) for row in session.scalars(select(BugReport).order_by(BugReport.updated_at.desc()))]
class Update(StrictModel):
    status:str=Field(max_length=24)
    priority:str=Field(max_length=16)
    assignee:str=Field(default='',max_length=100)
    comment:str=Field(default='',max_length=3000)
@router.put('/{identifier}',dependencies=[Depends(administrator)])
def update(identifier:int,body:Update,session=Depends(database)):
    row=session.scalar(select(BugReport).where(BugReport.id==identifier).with_for_update())
    if not row:raise HTTPException(404,'Report not found')
    if body.status not in STATUSES or body.priority not in PRIORITIES:raise HTTPException(422,'Unknown status or priority')
    event={'at':now().isoformat(),'author':'Teacher','action':'updated','changes':{}}
    for key in ['status','priority','assignee']:
        value=getattr(body,key)
        if getattr(row,key)!=value:event['changes'][key]={'from':getattr(row,key),'to':value};setattr(row,key,value)
    if body.comment:event['comment']=body.comment
    row.history=[*row.history,event];row.updated_at=now();session.commit();return view(row)
@router.get('/{identifier}/screenshot',dependencies=[Depends(administrator)])
def attachment(identifier:int,session=Depends(database)):
    row=session.get(BugReport,identifier)
    if not row or not row.screenshot:raise HTTPException(404,'Screenshot not found')
    return Response(row.screenshot,media_type=row.screenshot_mime,headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'})
@router.get('/receipt/{token}')
def receipt(token:str,session=Depends(database)):
    row=session.scalar(select(BugReport).where(BugReport.receipt_hash==sha(token)))
    if not row:raise HTTPException(404,'Report not found')
    return {'key':f'MC-{row.id:04d}','status':row.status,'updated_at':row.updated_at.isoformat()}
