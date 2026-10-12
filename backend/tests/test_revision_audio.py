"""Synthetic audio and mocked providers only. No real recordings or external requests."""
import io,json,wave,math,struct
from types import SimpleNamespace
import pytest
from sqlalchemy import select
from app.db import SessionLocal
from app.models import RevisionAttempt,RevisionAudio
from app import revision_audio_processing as processing
from app.settings import settings
from test_revisions import setup

@pytest.fixture(autouse=True)
def no_external(monkeypatch):
    monkeypatch.setattr(settings,'revision_audio_ai_enabled',False);monkeypatch.setattr(settings,'revision_audio_ai_api_key',None)
    monkeypatch.setattr(processing.httpx,'post',lambda *a,**kw:(_ for _ in ()).throw(AssertionError('No real external audio requests')))

def wav():
    b=io.BytesIO()
    with wave.open(b,'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(16000)
        f.writeframes(b''.join(struct.pack('<h',int(12000*math.sin(i/16000*2*math.pi*440)) if i<8000 or i>=14400 else 0) for i in range(32000)))
    return b.getvalue()

def pair(client):
    test,admin=setup(client);spec=next(t for t in client.get('/learning/revisions/tests',headers=admin).json() if t['id']==test)['definition'];spec['oral_dialogue']=['Situation: choose a project. Student A: classes. Student B: archives.'];client.put('/learning/revisions/tests/'+test,headers=admin,json=spec);client.post('/learning/revisions/tests/'+test+'/publish',headers=admin);rows=[]
    for group in ['213','213','214']:
        started=client.post('/revision-tests/'+test+'/start',json={'group':group,'student_name':'Synthetic Learner','research_consent':False}).json();path='/revision-attempts/'+started['attempt_id'];auth={'Authorization':'Bearer '+started['token']};client.post(path+'/begin',headers=auth);client.post(path+'/submit',headers=auth,json={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'Synthetic essay.'});client.put('/learning/revisions/attempts/'+started['attempt_id']+'/oral-review',headers=admin,json={'score':16,'breakdown':{key:4 for key in ['individual_vocabulary','individual_grammar','individual_coherence','individual_content']},'feedback':'Individual feedback.'});rows.append((started['attempt_id'],path,auth))
    a,b,c=rows;assert client.post('/learning/revisions/attempts/'+a[0]+'/pair',headers=admin,json={'partner_attempt_id':b[0]}).status_code==200
    return test,admin,a,b,c

def test_audio_private_durable_shared_and_no_external_by_default(client):
    test,admin,a,b,c=pair(client);payload=wav();path=b[1]+'/audio/dialogue'
    assert client.put(path+'?first_speaker='+b[0],content=payload,headers={**b[2],'Content-Type':'audio/wav'}).status_code==200
    metadata=client.get(a[1]+'/audio/dialogue',headers=a[2]).json()['recording'];assert metadata['first_speaker']==b[0] and metadata['size']==len(payload)
    assert client.get(a[1]+'/audio/dialogue/file',headers=a[2]).content==payload
    assert client.get(a[1]+'/audio/dialogue/file').status_code==401
    assert client.get(c[1]+'/audio/dialogue/file',headers=c[2]).status_code==404
    assert client.get(a[1]+'/audio/dialogue/file',headers=c[2]).status_code==401
    assert client.put(a[1]+'/audio/dialogue?first_speaker='+a[0],content=payload,headers={**a[2],'Content-Type':'audio/wav'}).status_code==409
    assert client.post('/learning/revisions/attempts/'+a[0]+'/audio/dialogue/transcribe',headers=admin).status_code==503
    with SessionLocal() as s:
        media=s.scalar(select(RevisionAudio));assert media.audio==payload and media.owner_id==a[0]
    assert client.delete('/learning/revisions/attempts/'+a[0]+'/audio/dialogue',headers=admin).json()['grades_unchanged'] is True
    assert client.get('/learning/revisions/attempts/'+a[0],headers=admin).json()['oral']['individual_score']==16

def test_attribution_cannot_change_text_and_requires_versioned_both_checks(client):
    test,admin,a,b,c=pair(client);client.put(a[1]+'/audio/dialogue?first_speaker='+a[0],content=wav(),headers={**a[2],'Content-Type':'audio/wav'})
    with SessionLocal() as s:
        media=s.scalar(select(RevisionAudio));media.status='ready';media.version=1;media.transcript={'segments':[{'text':'I support classes.','speaker':a[0],'start':0,'end':1},{'text':'I support archives.','speaker':b[0],'start':1,'end':2}],'uncertain':[]};media.analysis={'duration':2,'silence_intervals':[]};s.commit()
    body={'version':1,'speakers':[a[0],b[0]],'uncertain':[]}
    assert client.put(a[1]+'/audio/dialogue/speakers',headers=a[2],json={**body,'text':'Edited answer'}).status_code==422
    assert client.put(a[1]+'/audio/dialogue/speakers',headers=a[2],json=body).json()['recording']['confirmed'] is False
    assert client.put(b[1]+'/audio/dialogue/speakers',headers=b[2],json=body).json()['recording']['confirmed'] is True
    changed={**body,'speakers':[b[0],a[0]]};response=client.put(b[1]+'/audio/dialogue/speakers',headers=b[2],json=changed).json()['recording'];assert response['version']==2 and response['confirmed'] is False
    assert client.put(a[1]+'/audio/dialogue/speakers',headers=a[2],json=body).status_code==409
    assert response['segments'][0]['text']=='I support classes.'
    assert client.put('/learning/revisions/attempts/'+a[0]+'/audio/dialogue/speakers',headers=admin,json={**changed,'version':2}).json()['recording']['confirmed'] is True
    assert client.delete('/learning/revisions/attempts/'+a[0],headers=admin).status_code==200
    assert client.get(b[1]+'/audio/dialogue',headers=b[2]).json()['recording'] is None

def test_mocked_transcription_and_suggestions_do_not_modify_grades(client,monkeypatch):
    test,admin,a,b,c=pair(client);client.put(a[1]+'/audio/dialogue?first_speaker='+b[0],content=wav(),headers={**a[2],'Content-Type':'audio/wav'})
    for person in [a,b]:client.put('/learning/revisions/attempts/'+person[0]+'/oral-review',headers=admin,json={'score':12,'breakdown':{key:3 for key in ['dialogue_vocabulary','dialogue_grammar','dialogue_coherence','dialogue_strategies']},'feedback':'Dialogue feedback.'})
    monkeypatch.setattr(settings,'revision_audio_ai_enabled',True);monkeypatch.setattr(settings,'revision_audio_ai_api_key','synthetic-audio-key');monkeypatch.setattr(processing,'decode',lambda data:{'duration':2,'silence_intervals':[[.4,.8]]})
    def provider(url,**kwargs):
        assert url.startswith('https://api.openai.com/v1/')
        if url.endswith('/audio/transcriptions'):result={'segments':[{'speaker':'speaker_0','start':0,'end':1,'text':'Um, I support classes.'},{'speaker':'speaker_1','start':1,'end':2,'text':'I support archives.'}]}
        else:
            payload=json.loads(kwargs['json']['messages'][1]['content']);assert 'Synthetic Learner' not in str(payload);result={'breakdown':{'vocabulary':4,'grammar':4,'coherence':4,'strategies':4},'feedback':'Clear ideas. Try to respond to your partner.','language_errors':[]}
        return SimpleNamespace(raise_for_status=lambda:None,json=lambda:result if url.endswith('/audio/transcriptions') else {'choices':[{'message':{'content':json.dumps(result)}}]})
    monkeypatch.setattr(processing.httpx,'post',provider)
    endpoint='/learning/revisions/attempts/'+a[0]+'/audio/dialogue';assert client.post(endpoint+'/transcribe',headers=admin).status_code==200
    record=client.get(endpoint,headers=admin).json()['recording'];assert record['segments'][0]['speaker']==b[0]
    assert client.post(endpoint+'/suggest',headers=admin).status_code==409
    assert client.put(endpoint+'/speakers',headers=admin,json={'version':record['version'],'speakers':[b[0],a[0]],'uncertain':[]}).status_code==200
    assert client.post(endpoint+'/suggest',headers=admin).status_code==200
    record=client.get(endpoint,headers=admin).json()['recording'];assert set(record['suggestions'])=={a[0],b[0]};assert record['suggestions'][a[0]]['score']==16
    assert record['metrics']['participants'][b[0]]['filled_pauses_in_asr']==1
    for person in [a,b]:
        row=client.get('/learning/revisions/attempts/'+person[0],headers=admin).json();assert row['oral']['individual_score']==16 and row['oral']['dialogue_score']==12
        assert row['oral']['individual_feedback']=='Individual feedback.' and row['oral']['dialogue_feedback']=='Dialogue feedback.'
        assert client.get(person[1],headers=person[2]).json()['oral_feedback']==''

def test_pause_measurement_is_descriptive_not_a_grade():
    analysis=processing.decode(wav());assert 1.9<analysis['duration']<2.1;assert any(.35<end-start<.5 for start,end in analysis['silence_intervals'])
    media=SimpleNamespace(transcript={'segments':[{'speaker':'a','start':0,'end':1,'text':'Um I I agree.'},{'speaker':'a','start':1,'end':1.5,'text':'Yes.'},{'speaker':'b','start':1.5,'end':2,'text':'Okay.'}],'uncertain':[]},analysis=analysis)
    result=processing.metrics(media,'a');assert result['turns']==1 and result['adjacent_word_repetitions']==1 and result['filled_pauses_in_asr']==1 and result['within_turn_silent_pauses_ge_300ms']==1

def test_queue_waits_for_submission_and_preserves_marks(client):
    test,admin=setup(client)
    started=client.post('/revision-tests/'+test+'/start',json={'group':'214','student_name':'Synthetic Learner','research_consent':False}).json()
    path='/revision-attempts/'+started['attempt_id'];auth={'Authorization':'Bearer '+started['token']};endpoint='/learning/revisions/attempts/'+started['attempt_id']+'/call-speaking'
    assert client.post(endpoint,headers=admin).status_code==409
    client.post(path+'/begin',headers=auth);client.post(path+'/submit',headers=auth,json={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'Synthetic essay.'})
    assert client.post(endpoint).status_code==401
    called=client.post(endpoint,headers=admin);assert called.status_code==200
    first=called.json()['oral']['called_at']
    assert client.post(endpoint,headers=admin).json()['oral']['called_at']==first
    assert client.get(path+'/oral',headers=auth).json()['queue_status']=='called'
    client.put('/learning/revisions/attempts/'+started['attempt_id']+'/oral-review',headers=admin,json={'score':16,'feedback':'Existing mark.'})
    assert client.post(endpoint,headers=admin).status_code==409
    assert client.get('/learning/revisions/attempts/'+started['attempt_id'],headers=admin).json()['oral']['score']==16
