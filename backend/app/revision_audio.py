"""Private durable audio. All external processing is off until explicitly enabled."""
from datetime import timedelta
from typing import Literal
from fastapi import APIRouter,Depends,Header,HTTPException,Request,Response,BackgroundTasks
from pydantic import Field
from sqlalchemy import select,cast,Text
from sqlalchemy.orm import defer
from sqlalchemy.exc import IntegrityError
from .learning import administrator,database,no_store,StrictModel,now
from .models import RevisionAttempt,RevisionAudio
from .revisions import access
from .settings import settings
router=APIRouter(dependencies=[Depends(no_store)])
LIMIT=12*1024*1024


def actor(identifier,authorization,session,teacher):
    row=session.get(RevisionAttempt,identifier) if teacher else access(identifier,authorization,session)
    if row is None:raise HTTPException(404,'Attempt not found')
    if not row.submitted_at:raise HTTPException(409,'Finish and submit the written test first')
    return row

def members(row,part,session):
    if part=='individual':return row,[row.id]
    if (row.oral or {}).get('status')!='paired':raise HTTPException(409,'Your teacher needs to assign this dialogue first')
    other=session.get(RevisionAttempt,row.oral.get('partner_id')) if row.oral.get('partner_id') else None
    if other:
        if (other.oral or {}).get('partner_id')!=row.id:raise HTTPException(409,'The dialogue pair has changed')
        return (row if row.oral.get('role')=='A' else other),[row.id,other.id]
    if row.oral.get('partner_name')=='Teacher':return row,[row.id,'teacher']
    raise HTTPException(409,'The dialogue partner is not available')

def recording(row,part,session):
    return session.scalar(select(RevisionAudio).options(defer(RevisionAudio.audio)).where(RevisionAudio.part==part,cast(RevisionAudio.participants,Text).contains('"'+row.id+'"')))

def view(media,session,teacher=False):
    if not media:return {'recording':None,'ai_enabled':settings.revision_audio_ai_enabled and bool(settings.revision_audio_ai_api_key)}
    labels={i:('Teacher' if i=='teacher' else (session.get(RevisionAttempt,i).student_name if session.get(RevisionAttempt,i) else 'Unavailable participant')) for i in media.participants}
    transcript=media.transcript or {};confirmed=all(media.confirmations.get(i)==media.version for i in media.participants if i!='teacher')
    result={'id':media.id,'part':media.part,'status':media.status,'mime':media.mime,'size':media.byte_count,'first_speaker':media.first_speaker,'participants':labels,'version':media.version,'segments':transcript.get('segments',[]),'confirmed':confirmed,'confirmations':media.confirmations,'uncertain':transcript.get('uncertain',[]),'note':transcript.get('note',''),'duration':media.analysis.get('duration'),'capture':transcript.get('capture',{}),'suggestions':media.suggestions if teacher else {}}
    if teacher:result['metrics']=media.analysis
    return {'recording':result,'ai_enabled':settings.revision_audio_ai_enabled and bool(settings.revision_audio_ai_api_key)}

async def upload(identifier,part,first_speaker,request,authorization,session,teacher,capture_source='file',client_started_at=None):
    if client_started_at and len(client_started_at)>50:raise HTTPException(422,'Invalid recording start time')
    row=actor(identifier,authorization,session,teacher);owner,participants=members(row,part,session)
    if recording(row,part,session):raise HTTPException(409,'A recording is already saved. Ask the teacher to remove it before replacing it.')
    if part=='individual':first_speaker=row.id
    elif first_speaker=='partner':first_speaker=next((p for p in participants if p!=row.id),'')
    if first_speaker not in participants:raise HTTPException(422,'Choose who spoke first before uploading the dialogue')
    mime=request.headers.get('content-type','').split(';')[0].lower()
    if mime not in ['audio/webm','video/webm','audio/mp4','video/mp4','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/flac']:raise HTTPException(415,'Use WebM, M4A, MP3, WAV, OGG or FLAC audio')
    chunks=[];size=0
    async for chunk in request.stream():
        size+=len(chunk)
        if size>LIMIT:raise HTTPException(413,'Maximum size is 12 MB. Use compressed audio.')
        chunks.append(chunk)
    data=b''.join(chunks)
    valid=(mime.endswith('webm') and data.startswith(b'\x1a\x45\xdf\xa3')) or (mime.endswith('mp4') and data[4:8]==b'ftyp') or (mime.endswith('mpeg') and (data.startswith(b'ID3') or len(data)>1 and data[0]==255 and data[1]&224==224)) or (mime in ['audio/wav','audio/x-wav'] and data[:4]==b'RIFF' and data[8:12]==b'WAVE') or (mime.endswith('ogg') and data.startswith(b'OggS')) or (mime.endswith('flac') and data.startswith(b'fLaC'))
    if not valid:raise HTTPException(422,'The file does not match its audio format')
    media=RevisionAudio(owner_id=owner.id,part=part,participants=participants,first_speaker=first_speaker,mime=mime,audio=data,byte_count=len(data),status='uploaded',transcript={'capture':{'source':capture_source,'client_started_at':client_started_at,'client_time_unverified':True}},confirmations={},analysis={},suggestions={},version=0);session.add(media)
    try:session.commit()
    except IntegrityError:session.rollback();raise HTTPException(409,'The other participant already saved this recording')
    return view(media,session,teacher)

@router.put('/revision-attempts/{identifier}/audio/{part}')
async def public_upload(identifier:str,part:Literal['individual','dialogue'],request:Request,first_speaker:str='',capture_source:Literal['file','microphone']='file',client_started_at:str|None=None,authorization:str|None=Header(default=None),session=Depends(database)):
    return await upload(identifier,part,first_speaker,request,authorization,session,False,capture_source,client_started_at)
@router.put('/learning/revisions/attempts/{identifier}/audio/{part}',dependencies=[Depends(administrator)])
async def teacher_upload(identifier:str,part:Literal['individual','dialogue'],request:Request,first_speaker:str='',capture_source:Literal['file','microphone']='file',client_started_at:str|None=None,session=Depends(database)):
    return await upload(identifier,part,first_speaker,request,None,session,True,capture_source,client_started_at)
@router.get('/revision-attempts/{identifier}/audio/{part}')
def public_metadata(identifier:str,part:Literal['individual','dialogue'],authorization:str|None=Header(default=None),session=Depends(database)):
    return view(recording(actor(identifier,authorization,session,False),part,session),session)
@router.get('/learning/revisions/attempts/{identifier}/audio/{part}',dependencies=[Depends(administrator)])
def teacher_metadata(identifier:str,part:Literal['individual','dialogue'],session=Depends(database)):
    return view(recording(actor(identifier,None,session,True),part,session),session,True)

def file(identifier,part,authorization,session,teacher):
    media=recording(actor(identifier,authorization,session,teacher),part,session)
    if not media:raise HTTPException(404,'Recording not found')
    return Response(media.audio,media_type=media.mime,headers={'Content-Disposition':'inline; filename="recording"','X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'})
@router.get('/revision-attempts/{identifier}/audio/{part}/file')
def public_file(identifier:str,part:Literal['individual','dialogue'],authorization:str|None=Header(default=None),session=Depends(database)):
    return file(identifier,part,authorization,session,False)
@router.get('/learning/revisions/attempts/{identifier}/audio/{part}/file',dependencies=[Depends(administrator)])
def teacher_file(identifier:str,part:Literal['individual','dialogue'],session=Depends(database)):
    return file(identifier,part,None,session,True)

class Attribution(StrictModel):
    version:int=Field(ge=1)
    speakers:list[str]=Field(max_length=1000)
    uncertain:list[int]=Field(default_factory=list,max_length=1000)

def confirm(identifier,part,body,authorization,session,teacher):
    row=actor(identifier,authorization,session,teacher);media=recording(row,part,session)
    if media:media=session.scalar(select(RevisionAudio).options(defer(RevisionAudio.audio)).where(RevisionAudio.id==media.id).with_for_update().execution_options(populate_existing=True))
    if not media or media.status not in ['ready','suggested']:raise HTTPException(409,'Wait for transcription first')
    if body.version!=media.version:raise HTTPException(409,'The transcript changed. Reload before confirming.')
    segments=media.transcript.get('segments',[])
    if len(body.speakers)!=len(segments) or any(s not in media.participants for s in body.speakers) or any(i<0 or i>=len(segments) for i in body.uncertain):raise HTTPException(422,'Assign every turn to one of the participants')
    transcript=dict(media.transcript);changed=body.speakers!=[s['speaker'] for s in segments] or sorted(body.uncertain)!=sorted(transcript.get('uncertain',[]))
    if changed:
        transcript['confirmation_details']={}
        media.version+=1;media.confirmations={};media.suggestions={};media.status='ready';transcript['segments']=[{**s,'speaker':p} for s,p in zip(segments,body.speakers)];transcript['uncertain']=sorted(set(body.uncertain));media.transcript=transcript
    confirmations=dict(media.confirmations)
    for p in (media.participants if teacher else [row.id]):
        if p!='teacher':confirmations[p]=media.version
    media.confirmations=confirmations
    details=dict(media.transcript.get('confirmation_details',{}))
    for person in (media.participants if teacher else [row.id]):
        if person!='teacher':details[person]={'version':media.version,'by':'teacher' if teacher else 'participant','at':now().isoformat()+'Z'}
    media.transcript={**media.transcript,'confirmation_details':details}
    from .revision_audio_processing import metrics
    media.analysis={**media.analysis,'participants':{p:metrics(media,p) for p in media.participants if p!='teacher'}}
    media.updated_at=now();session.commit();return view(media,session,teacher)
@router.put('/revision-attempts/{identifier}/audio/{part}/speakers')
def public_confirm(identifier:str,part:Literal['individual','dialogue'],body:Attribution,authorization:str|None=Header(default=None),session=Depends(database)):
    return confirm(identifier,part,body,authorization,session,False)
@router.put('/learning/revisions/attempts/{identifier}/audio/{part}/speakers',dependencies=[Depends(administrator)])
def teacher_confirm(identifier:str,part:Literal['individual','dialogue'],body:Attribution,session=Depends(database)):
    return confirm(identifier,part,body,None,session,True)

def external_permission():
    if not settings.revision_audio_ai_enabled or not settings.revision_audio_ai_api_key:raise HTTPException(503,'External audio processing is disabled. Explicit approval and REVISION_AUDIO_AI_ENABLED plus a separate REVISION_AUDIO_AI_API_KEY are required for OpenAI audio/transcript processing.')

@router.post('/learning/revisions/attempts/{identifier}/audio/{part}/transcribe',dependencies=[Depends(administrator)])
def transcribe(identifier:str,part:Literal['individual','dialogue'],background:BackgroundTasks,session=Depends(database)):
    external_permission();media=recording(actor(identifier,None,session,True),part,session)
    if not media:raise HTTPException(404,'Upload audio first')
    if media.status in ['processing','grading'] and media.updated_at>now()-timedelta(minutes=15):raise HTTPException(409,'Processing is already running')
    from .revision_audio_processing import transcribe_job
    media.status='processing';media.updated_at=now();session.commit();background.add_task(transcribe_job,media.id);return view(media,session,True)
@router.post('/learning/revisions/attempts/{identifier}/audio/{part}/suggest',dependencies=[Depends(administrator)])
def suggest(identifier:str,part:Literal['individual','dialogue'],background:BackgroundTasks,session=Depends(database)):
    external_permission();media=recording(actor(identifier,None,session,True),part,session)
    if not media or media.status not in ['ready','suggested']:raise HTTPException(409,'Transcribe and confirm attribution first')
    if not all(media.confirmations.get(p)==media.version for p in media.participants if p!='teacher'):raise HTTPException(409,'Both students must confirm attribution, or the teacher can confirm it after listening')
    from .revision_audio_processing import suggest_job
    media.status='grading';media.updated_at=now();session.commit();background.add_task(suggest_job,media.id,media.version);return view(media,session,True)
@router.delete('/learning/revisions/attempts/{identifier}/audio/{part}',dependencies=[Depends(administrator)])
def remove(identifier:str,part:Literal['individual','dialogue'],session=Depends(database)):
    media=recording(actor(identifier,None,session,True),part,session)
    if media:session.delete(media);session.commit()
    return {'deleted':True,'grades_unchanged':True}
