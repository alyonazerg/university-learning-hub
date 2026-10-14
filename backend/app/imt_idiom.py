"""Private single-student MVP for the IMT idiom assessment."""
import hashlib,json,re,secrets,random
from pathlib import Path
from fastapi import APIRouter,Depends,HTTPException,Header,UploadFile,File
import csv
import io
from pydantic import Field
from sqlalchemy import select
from .learning import StrictModel,administrator,principal,database,no_store,now
from .models import LearningSession,Student,Group
from .models import ImtIdiomCollection
from .settings import settings

router=APIRouter(dependencies=[Depends(no_store)])
def pilot_admin(x_admin_token: str|None=Header(default=None),authorization: str|None=Header(default=None),session=Depends(database)):
    if settings.admin_token and x_admin_token and secrets.compare_digest(x_admin_token.encode('utf-8'),settings.admin_token.encode('utf-8')): return True
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
    attempt=dict(row.attempt) if row.status in ['assessment','submitted','reviewed'] else {}
    if attempt.get('questions'):attempt['questions']=[{k:v for k,v in q.items() if k!='answer'} for q in attempt['questions']]
    return {'id':row.id,'student_name':row.student_name,'group':row.group_code,'coursebook':row.coursebook,'unit':row.unit,'status':row.status,'entries':row.entries,'attempt':attempt,'result':row.result if row.status=='reviewed' else {k:v for k,v in row.result.items() if k in ['ai_review','practice_report','review_status','source_filename']}}

def parse_uploaded_material(filename:str, raw:bytes):
    """Return editable idiom rows from CSV/XLSX/PDF; never auto-publishes OCR."""
    suffix=Path(filename or '').suffix.lower()
    rows=[]
    if suffix in {'.png','.jpg','.jpeg','.webp'}:
        from .imt_ai import recognize
        return recognize(raw,suffix)
    if suffix=='.csv':
        text=raw.decode('utf-8-sig',errors='replace')
        rows=list(csv.DictReader(io.StringIO(text)))
    elif suffix in {'.xlsx','.xlsm'}:
        from openpyxl import load_workbook
        sheet=load_workbook(io.BytesIO(raw),read_only=True,data_only=True).active
        values=list(sheet.values)
        if values:
            headers=[str(x or '').strip().lower() for x in values[0]]
            rows=[dict(zip(headers,[str(x or '').strip() for x in value])) for value in values[1:]]
    elif suffix=='.pdf':
        try:
            from pypdf import PdfReader
            text='\n'.join(page.extract_text() or '' for page in PdfReader(io.BytesIO(raw)).pages)
        except Exception as exc:
            raise HTTPException(422,f'Could not read PDF: {exc}')
        # Conservative line-based extraction. Teacher confirms all rows before use.
        if not text.strip():
            from .imt_ai import recognize
            return recognize(raw,suffix)
        current={}
        for line in text.splitlines():
            line=re.sub(r'^\s*[-–—]\s*','',line).strip()
            m=re.match(r'\d+[.)]\s*(.+)',line)
            if m:
                if current.get('expression'): rows.append(current)
                current={'expression':m.group(1).strip()}; continue
            for key,markers in [('meaning',('перевод:', 'translation:')),('example',('example:',)),('explanation',('explain:', 'explanation:'))]:
                if any(line.lower().startswith(marker) for marker in markers):
                    current[key]=line.split(':',1)[1].strip(); break
        if current.get('expression'): rows.append(current)
    else:
        raise HTTPException(422,'Use PDF, CSV, XLSX, PNG, JPG or WebP')
    normalized=[]
    for row in rows:
        row={str(k).strip().lower():str(v or '').strip() for k,v in row.items()}
        expression=row.get('expression') or row.get('idiom') or row.get('phrase') or row.get('идома') or ''
        if expression:
            normalized.append({'expression':expression,'meaning':row.get('meaning') or row.get('translation') or row.get('перевод') or '', 'example':row.get('example') or row.get('пример') or '', 'explanation':row.get('explanation') or row.get('explain') or row.get('объяснение') or ''})
    if not normalized: raise HTTPException(422,'No idiom rows were found in the file')
    return normalized[:200]

@router.post('/learning/imt/materials/preview',dependencies=[Depends(pilot_admin)])
async def preview_material(file:UploadFile=File(...)):
    raw=await file.read()
    if len(raw)>10*1024*1024: raise HTTPException(413,'File must be 10 MB or smaller')
    return {'filename':file.filename,'rows':parse_uploaded_material(file.filename or '',raw),'requires_teacher_confirmation':True}

@router.post('/imt/idiom/material-preview')
async def student_material_preview(token:str,file:UploadFile=File(...),session=Depends(database)):
    actor(token,session)
    raw=await file.read()
    if len(raw)>10*1024*1024: raise HTTPException(413,'File must be 10 MB or smaller')
    return {'filename':file.filename,'rows':parse_uploaded_material(file.filename or '',raw),'requires_student_confirmation':True}

@router.get('/learning/imt/my')
def my_collection(actor=Depends(principal),session=Depends(database)):
    if actor.role!='student': raise HTTPException(403,'Student access required')
    row=session.scalar(select(ImtIdiomCollection).where(ImtIdiomCollection.student_id==actor.student_id).order_by(ImtIdiomCollection.updated_at.desc()))
    return public(row) if row else {'status':'not_started','entries':[],'attempt':{},'result':{}}

@router.post('/learning/imt/my/upload')
async def upload_my_material(file:UploadFile=File(...),actor=Depends(principal),session=Depends(database)):
    if actor.role!='student': raise HTTPException(403,'Student access required')
    raw=await file.read()
    if len(raw)>10*1024*1024: raise HTTPException(413,'File must be 10 MB or smaller')
    entries=parse_uploaded_material(file.filename or '',raw)
    student=session.get(Student,actor.student_id)
    row=session.scalar(select(ImtIdiomCollection).where(ImtIdiomCollection.student_id==student.id).order_by(ImtIdiomCollection.updated_at.desc()))
    if not row:
        row=ImtIdiomCollection(student_id=student.id,student_name=student.pseudonym,group_code=(re.search(r'\b\d{3}\b',session.get(Group,student.group_id).name).group() if student.group_id and re.search(r'\b\d{3}\b',session.get(Group,student.group_id).name) else ''),coursebook='Evolve 5',unit='7',token_hash=sha(secrets.token_urlsafe(32)),entries=[],attempt={},result={});session.add(row)
    if row.status not in ['draft','changes_requested']: raise HTTPException(409,'Your submitted material is locked for review')
    row.entries=[{'expression':x['expression'],'meaning':x.get('meaning',''),'example':x.get('example',''),'topic':'Student IMT'} for x in entries];row.status='draft';row.result={'review_status':'preview','source_filename':file.filename};row.updated_at=now();session.commit();return public(row)
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
    snapshot=material(book,unit)
    uploaded=body.get('entries')
    if uploaded is not None:
        if not isinstance(uploaded,list) or not uploaded: raise HTTPException(422,'entries must be a non-empty list')
        entries=[]
        for item in uploaded[:200]:
            if not isinstance(item,dict) or not str(item.get('expression','')).strip(): raise HTTPException(422,'Every entry needs an expression')
            entries.append({'expression':str(item['expression']).strip()[:180],'meaning':str(item.get('meaning','')).strip()[:800],'example':str(item.get('example','')).strip()[:1000],'topic':str(item.get('topic','IMT material')).strip()[:160]})
    else:
        entries=[]
    result=[]
    for value in students:
        name=str(value).strip()
        if not name or len(name)>100: raise HTTPException(422,'Every student needs a name under 100 characters')
        token=secrets.token_urlsafe(32);row=ImtIdiomCollection(student_name=name,group_code=group,coursebook=book,unit=unit,token_hash=sha(token),material_snapshot=snapshot,entries=entries,attempt={},result={});
        if entries: row.status='approved'
        session.add(row);session.flush()
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

class MyEntry(StrictModel):
    expression:str=Field(min_length=1,max_length=180)
    meaning:str=Field(default='',max_length=800)
    example:str=Field(default='',max_length=1000)
    topic:str=Field(default='Student IMT',max_length=160)
class MyEntries(StrictModel):
    entries:list[MyEntry]=Field(min_length=1,max_length=200)
def own_collection(actor,session):
    if actor.role!='student': raise HTTPException(403,'Student access required')
    row=session.scalar(select(ImtIdiomCollection).where(ImtIdiomCollection.student_id==actor.student_id).order_by(ImtIdiomCollection.updated_at.desc()))
    if not row: raise HTTPException(404,'Upload your IMT first')
    return row
@router.put('/learning/imt/my/confirm')
def confirm_my(body:MyEntries,actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    if row.status not in ['draft','changes_requested']: raise HTTPException(409,'Material already submitted')
    row.entries=[e.model_dump() for e in body.entries];row.status='submitted';row.result={k:v for k,v in row.result.items() if k!='ai_review'};row.result={**row.result,'review_status':'pending'};row.updated_at=now();session.commit();return public(row)
@router.post('/learning/imt/my/start')
def start_my(actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    if row.status not in ['approved','submitted'] or row.attempt: raise HTTPException(409,'Tasks have already started or material is not submitted')
    if not row.result.get('ai_review'): raise HTTPException(409,'Check your material first')
    row.attempt=make_adaptive_practice(row.entries);row.status='assessment';session.commit();return public(row)

def make_adaptive_practice(entries):
    from .imt_ai import recall_situations,completion
    recall=recall_situations(entries)
    expressions=list(dict.fromkeys(e['expression'] for e in entries))
    for q in recall:
        target=entries[q['entry_index']]['expression']
        others=[value for value in expressions if value!=target]
        if not others:
            generated=completion('Return JSON {alternatives:[string,string,string]}. Supply three real idioms with different meanings from the given expression. No instructions or explanations.',target)
            others=[str(value)[:180] for value in generated.get('alternatives',[]) if str(value)!=target][:3]
        if not others:raise HTTPException(502,'Could not create answer choices. Please retry.')
        options=random.sample(others,min(3,len(others)))+[target];random.shuffle(options)
        q.update({'type':'multiple_choice','options':options,'answer':target})
    random.shuffle(recall)
    if len(recall)>1 and [q['entry_index'] for q in recall]==list(range(len(entries))):recall=recall[1:]+recall[:1]
    return {'version':'adaptive_mcq_1','stage':'recall','index':0,'responses':{},'questions':recall,'recall_count':len(recall)}
@router.put('/learning/imt/my/answer')
def answer_my(body:AnswerBody,actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    if row.status!='assessment': raise HTTPException(409,'Tasks are not active')
    if row.attempt.get('last_feedback',{}).get('question_index') is not None:raise HTTPException(409,'Continue after checking your answer first')
    a=dict(row.attempt);index=a['index'];responses=dict(a.get('responses',{}));question=a['questions'][index]
    feedback=None
    if question.get('type')=='multiple_choice':
        if body.response not in question['options']:raise HTTPException(422,'Choose one of the expressions')
        correct=body.response==question['answer'];feedback={'correct':correct,'answer':question['answer'],'stage':'recall'}
        responses[str(index)]={'response':body.response,'correct':correct}
    else:
        responses[str(index)]={'response':body.response}
        if a.get('version')=='adaptive_mcq_1':
            if not body.response.strip():raise HTTPException(422,'Write a sentence first')
            from .imt_ai import check_sentence,comment_sentence_count
            if not re.search(r'[A-Za-z]',body.response):raise HTTPException(422,'Please write your comment in English: 2–3 sentences about the situation, using an appropriate idiom.')
            if comment_sentence_count(body.response)<2:raise HTTPException(422,'Write a comment of 2–3 complete sentences using an appropriate idiom.')
            checked=check_sentence(question['expression'],question['prompt'],body.response)
            feedback={'correct':checked['successful'],'answer':question['expression'],'stage':'reuse','feedback':checked['feedback'],'correction':checked['correction']}
            responses[str(index)].update({'correct':checked['successful'],'feedback':checked['feedback'],'original':checked['original'],'correction':checked['correction']})
    if a.get('version')=='adaptive_mcq_1' and index+1==a['recall_count']:
        missed=[q['entry_index'] for i,q in enumerate(a['questions'][:a['recall_count']]) if not responses[str(i)].get('correct')]
        selected=missed or random.sample(list(range(len(row.entries))),min(5,len(row.entries)))
        random.shuffle(selected)
        practice=make_context_practice(row.entries,selected)
        a['questions']=a['questions'][:a['recall_count']]+practice
        a['practice_reason']='mistakes' if missed else 'all_correct'
    a['responses']=responses;a['index']=index+1
    if feedback:a['last_feedback']={**feedback,'question_index':index}
    else:a.pop('last_feedback',None)
    row.attempt=a
    if a.get('recall_count') and a['index']>=a['recall_count']: a['stage']='reuse'
    if a['index']>=len(a['questions']): row.status='submitted';row.result={**row.result,'review_status':'answers_pending'}
    row.updated_at=now();session.commit();return public(row)

@router.post('/learning/imt/my/continue')
def continue_after_feedback(actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    attempt=dict(row.attempt);attempt.pop('last_feedback',None)
    row.attempt=attempt;row.updated_at=now();session.commit();return public(row)

def make_context_practice(entries,indices):
    from .imt_ai import recall_situations
    questions=recall_situations([entries[i] for i in indices],stage='reuse')
    return [{**q,'type':'production','entry_index':indices[q['entry_index']],'expression':entries[indices[q['entry_index']]]['expression']} for q in questions]

@router.post('/learning/imt/my/context-tasks')
def update_generic_contexts(actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    if row.status!='assessment' or 'approved_grade' in row.result:raise HTTPException(409,'Completed practice remains unchanged')
    attempt=dict(row.attempt);questions=list(attempt['questions'])
    positions=[i for i,q in enumerate(questions) if i>=attempt['index'] and q.get('stage')=='reuse' and q.get('prompt')=='Write an original sentence using this expression. Make its meaning clear through the context.' and str(i) not in attempt.get('responses',{})]
    if positions:
        replacement=make_context_practice(row.entries,[questions[i]['entry_index'] for i in positions])
        for position,question in zip(positions,replacement):questions[position]=question
        attempt['questions']=questions;row.attempt=attempt;row.updated_at=now();session.commit()
    return public(row)

@router.post('/learning/imt/my/results')
def my_practice_results(actor=Depends(principal),session=Depends(database)):
    from .imt_ai import practice_report
    row=own_collection(actor,session)
    if row.status not in ['submitted','reviewed'] or not row.attempt.get('questions') or len(row.attempt.get('responses',{}))!=len(row.attempt['questions']):raise HTTPException(409,'Complete both practice stages first')
    if row.result.get('practice_report'):return public(row)
    if row.attempt.get('version')=='adaptive_mcq_1':
        from .imt_ai import adaptive_report
        report=adaptive_report(row.entries,row.attempt)
    else:report=practice_report(row.entries,row.attempt)
    row.result={**row.result,'practice_report':report};row.updated_at=now();session.commit();return public(row)

@router.post('/learning/imt/my/check-ai')
def check_my_ai(actor=Depends(principal),session=Depends(database)):
    from .imt_ai import review
    row=own_collection(actor,session)
    if row.status not in ['submitted','approved'] or row.attempt:raise HTTPException(409,'Confirm your material before AI review; started tasks remain unchanged')
    analysis=review(row.entries,row.material_snapshot)
    row.result={**row.result,'ai_review':analysis};row.updated_at=now();session.commit();return public(row)

@router.put('/learning/imt/my/list')
def save_my_list(body:MyEntries,actor=Depends(principal),session=Depends(database)):
    if actor.role!='student':raise HTTPException(403,'Student access required')
    row=session.scalar(select(ImtIdiomCollection).where(ImtIdiomCollection.student_id==actor.student_id).order_by(ImtIdiomCollection.updated_at.desc()))
    if row and row.status not in ['draft','changes_requested']:raise HTTPException(409,'Your submitted material is locked for review')
    if not row:
        student=session.get(Student,actor.student_id)
        row=ImtIdiomCollection(student_id=student.id,student_name=student.pseudonym,group_code='',token_hash=sha(secrets.token_urlsafe(32)),entries=[],attempt={},result={});session.add(row)
    row.entries=[e.model_dump() for e in body.entries];row.status='draft';row.result={'review_status':'preview','source_filename':'Pasted list'};row.updated_at=now();session.commit();return public(row)

@router.post('/learning/imt/my/reset')
def reset_my_material(actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    if row.attempt or 'approved_grade' in row.result: raise HTTPException(409,'Started or graded work cannot be reset')
    row.entries=[];row.status='draft';row.result={'review_status':'preview'};row.updated_at=now();session.commit();return public(row)

@router.post('/learning/imt/my/revise')
def revise_my(actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    if row.status not in ['submitted','approved','changes_requested','assessment'] or row.attempt.get('responses') or 'approved_grade' in row.result:
        raise HTTPException(409,'Started tasks and graded work cannot be changed')
    previous=dict(row.result)
    history=list(previous.get('material_revisions',[]))
    history.append({'entries':row.entries,'ai_review':previous.get('ai_review'),'revised_at':now().isoformat()})
    row.result={**previous,'material_revisions':history,'review_status':'preview'}
    row.attempt={}
    row.status='changes_requested';row.updated_at=now();session.commit();return public(row)

@router.post('/learning/imt/my/refresh-tasks')
def refresh_unused_tasks(actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    if row.status!='assessment' or 'approved_grade' in row.result:raise HTTPException(409,'Graded tasks cannot be regenerated')
    legacy_prompts={'What does this expression mean? Explain it in your own words.','Explain this expression in your own words and give a new example.'}
    legacy=row.attempt.get('version')!='adaptive_mcq_1'
    if row.attempt.get('responses') and not legacy:raise HTTPException(409,'Answered current tasks cannot be regenerated')
    replacement=make_adaptive_practice(row.entries)
    history=list(row.result.get('previous_practice_attempts',[]))
    history.append({'attempt':row.attempt,'replaced_at':now().isoformat(),'reason':'Upgrade legacy definition tasks to situation-based retrieval'})
    row.result={**row.result,'previous_practice_attempts':history}
    row.attempt=replacement
    row.updated_at=now();session.commit();return public(row)

@router.post('/learning/imt/my/back')
def previous_my_task(actor=Depends(principal),session=Depends(database)):
    row=own_collection(actor,session)
    if row.status!='assessment' or row.attempt.get('index',0)<=0:raise HTTPException(409,'No previous task is available')
    attempt=dict(row.attempt);attempt['index']-=1
    attempt['stage']='recall' if attempt['index']<attempt.get('recall_count',len(attempt['questions'])) else 'reuse'
    row.attempt=attempt;row.updated_at=now();session.commit();return public(row)
