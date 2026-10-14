"""Private single-student MVP for the IMT idiom assessment."""
import hashlib,json,re,secrets
from pathlib import Path
from fastapi import APIRouter,Depends,HTTPException,Header
from pydantic import Field
from sqlalchemy import select
from .learning import StrictModel,administrator,database,no_store,now
from .models import LearningSession
from .models import ImtIdiomCollection
from .settings import settings

router=APIRouter(dependencies=[Depends(no_store)])
def pilot_admin(x_admin_token: str|None=Header(default=None),authorization: str|None=Header(default=None),session=Depends(database)):
    if settings.admin_token and x_admin_token and secrets.compare_digest(x_admin_token,settings.admin_token): return True
    if authorization and authorization.startswith('Bearer '):
        record=session.get(LearningSession,sha(authorization[7:]))
        if record and record.role=='admin' and record.expires_at>now(): return True
    raise HTTPException(403,'Admin access required')
ROOT=Path(__file__).resolve().parents[1]/'revision_materials'
def sha(v): return hashlib.sha256(v.encode()).hexdigest()
def material(book,unit):
    level='b2' if book=='Evolve 5' else 'c1'; path=ROOT/f'unit{unit}-{level}.json'
    if not path.exists(): return {'verified':False,'coursebook':book,'unit':unit,'vocabulary':[],'grammar':''}
    data=json.loads(path.read_text()); words=[i['target_word'] for i in data.get('items',[]) if i.get('target_word')]
    return {'verified':True,'coursebook':book,'unit':unit,'vocabulary':list(dict.fromkeys(words)),'grammar':data.get('grammar_notes','')}
class Entry(StrictModel):
    expression:str=Field(min_length=1,max_length=180)
    meaning:str=Field(min_length=1,max_length=800)
    example:str=Field(min_length=1,max_length=1000)
    topic:str=Field(min_length=1,max_length=160)
class CollectionBody(StrictModel): entries:list[Entry]=Field(min_length=1,max_length=15)
class AnswerBody(StrictModel): response:str=Field(default='',max_length=3000); audio_id:str|None=None
def actor(token,session):
    row=session.scalar(select(ImtIdiomCollection).where(ImtIdiomCollection.token_hash==sha(token)))
    if not row: raise HTTPException(401,'Invalid private IMT link')
    return row
def public(row):
    return {'id':row.id,'student_name':row.student_name,'group':row.group_code,'coursebook':row.coursebook,'unit':row.unit,'status':row.status,'entries':row.entries,'attempt':row.attempt if row.status in ['assessment','submitted','reviewed'] else {},'result':row.result if row.status=='reviewed' else {}}
@router.post('/learning/imt/collections',dependencies=[Depends(pilot_admin)])
def create(body:dict,session=Depends(database)):
    name=str(body.get('student_name','')).strip();book=str(body.get('coursebook','Evolve 5'));unit=str(body.get('unit','7'));group=str(body.get('group',''))
    if not name or book not in ['Evolve 5','Evolve 6'] or not re.fullmatch(r'\d+',unit): raise HTTPException(422,'Provide student, coursebook and unit')
    token=secrets.token_urlsafe(32); row=ImtIdiomCollection(student_name=name,group_code=group,coursebook=book,unit=unit,token_hash=sha(token),material_snapshot=material(book,unit),entries=[],attempt={},result={});session.add(row);session.commit()
    return {'id':row.id,'token':token,'student_link':'/imt-idiom.html#token='+token,'material':row.material_snapshot}
@router.post('/learning/imt/collections/bulk',dependencies=[Depends(pilot_admin)])
def create_bulk(body:dict,session=Depends(database)):
    students=body.get('students');book=str(body.get('coursebook','Evolve 5'));unit=str(body.get('unit','7'));group=str(body.get('group',''))
    if not isinstance(students,list) or not 1<=len(students)<=50: raise HTTPException(422,'Provide 1–50 students')
    if book not in ['Evolve 5','Evolve 6'] or not re.fullmatch(r'\d+',unit): raise HTTPException(422,'Provide a valid coursebook and unit')
    snapshot=material(book,unit);result=[]
    for value in students:
        name=str(value).strip()
        if not name or len(name)>100: raise HTTPException(422,'Every student needs a name under 100 characters')
        token=secrets.token_urlsafe(32);row=ImtIdiomCollection(student_name=name,group_code=group,coursebook=book,unit=unit,token_hash=sha(token),material_snapshot=snapshot,entries=[],attempt={},result={});session.add(row);session.flush()
        result.append({'id':row.id,'student_name':name,'token':token,'student_link':'/imt-idiom.html#token='+token})
    session.commit();return {'coursebook':book,'unit':unit,'material':snapshot,'collections':result}
@router.get('/imt/idiom')
def get(token:str,session=Depends(database)): return public(actor(token,session))
@router.put('/imt/idiom/collection')
def collection(token:str,body:CollectionBody,session=Depends(database)):
    row=actor(token,session)
    if row.status not in ['draft','changes_requested']: raise HTTPException(409,'Collection is not editable now')
    row.entries=[e.model_dump() for e in body.entries];row.status='submitted';row.updated_at=now();session.commit();return public(row)
@router.post('/learning/imt/collections/{identifier}/review',dependencies=[Depends(pilot_admin)])
def review(identifier:str,body:dict,session=Depends(database)):
    row=session.get(ImtIdiomCollection,identifier)
    if not row: raise HTTPException(404,'Collection not found')
    decision=body.get('status');comment=str(body.get('comment',''))[:1000]
    if decision not in ['approved','changes_requested','rejected']: raise HTTPException(422,'Unknown review status')
    row.status=decision;row.result={**row.result,'collection_comment':comment};session.commit();return public(row)
@router.post('/imt/idiom/start')
def start(token:str,session=Depends(database)):
    row=actor(token,session)
    if row.status!='approved': raise HTTPException(409,'Teacher approval is required before assessment')
    questions=[{'stage':'retrieval','number':i,'prompt':'Explain the meaning of this expression in your own words and use it in an example.','expression':e['expression']} for i,e in enumerate(row.entries)]
    row.attempt={'stage':'retrieval','index':0,'responses':{},'questions':questions};row.status='assessment';session.commit();return public(row)
@router.put('/imt/idiom/answer')
def answer(token:str,body:AnswerBody,session=Depends(database)):
    row=actor(token,session)
    if row.status!='assessment': raise HTTPException(409,'Assessment is not active')
    attempt=dict(row.attempt);idx=int(attempt.get('index',0));questions=attempt.get('context_questions',[]) if attempt.get('stage')=='context' else attempt.get('questions',[])
    if idx>=len(questions): raise HTTPException(409,'Retrieval is complete')
    attempt.setdefault('responses',{})[str(idx)]={'response':body.response,'audio_id':body.audio_id};idx+=1
    if idx<len(questions): attempt['index']=idx
    elif attempt.get('stage')=='context':
        row.attempt=attempt;row.status='submitted';row.result={'proposed_grade':None,'review_status':'pending','note':'Teacher review required in this MVP.'};session.commit();return public(row)
    else:
        attempt['stage']='context';attempt['index']=0;attempt['context_questions']=[{'number':i,'prompt':'Describe a new situation in which one of your expressions would be appropriate. Do not force an expression that does not fit.'} for i in range(len(questions))]
    row.attempt=attempt;session.commit();return public(row)
@router.post('/imt/idiom/submit')
def submit(token:str,session=Depends(database)):
    row=actor(token,session); attempt=row.attempt
    if row.status!='assessment' or attempt.get('stage')!='context' or len(attempt.get('responses',{}))<len(row.entries)*2: raise HTTPException(409,'Complete retrieval and context stages first')
    row.status='submitted';row.result={'proposed_grade':None,'review_status':'pending','note':'AI evaluation is not configured in this MVP; teacher review required.'};session.commit();return public(row)
@router.get('/learning/imt/collections',dependencies=[Depends(pilot_admin)])
def list_collections(session=Depends(database)): return [public(r) for r in session.scalars(select(ImtIdiomCollection).order_by(ImtIdiomCollection.updated_at.desc()))]
@router.put('/learning/imt/collections/{identifier}/grade',dependencies=[Depends(pilot_admin)])
def grade(identifier:str,body:dict,session=Depends(database)):
    row=session.get(ImtIdiomCollection,identifier)
    if not row or row.status not in ['submitted','reviewed']: raise HTTPException(404,'Submitted assessment not found')
    value=body.get('approved_grade');reason=str(body.get('reason','')).strip()
    if type(value) not in [int,float] or value<0 or value>3 or value!=int(value) or not reason: raise HTTPException(422,'Use an integer 0–3 and give an override reason')
    row.result={**row.result,'approved_grade':int(value),'teacher_feedback':str(body.get('feedback',''))[:2000],'override_reason':reason,'review_status':'approved'};row.status='reviewed';session.commit();return public(row)
