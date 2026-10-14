"""Exact anchoring, teacher approval and publication; no external AI requests."""
import json
from types import SimpleNamespace
from app import essay_annotations as a
from app.db import SessionLocal
from app.models import RevisionAttempt
from test_revisions import setup

def annotation(original,category='grammar',intent='correction',**kw):return {'original':original,'category':category,'intent':intent,'replacement':'I agree' if intent!='praise' else None,'explanation':'A concise helpful comment.',**kw}
def submitted(client):
    test,admin=setup(client);started=client.post('/revision-tests/'+test+'/start',json={'group':'214','student_name':'Synthetic Learner','research_consent':False}).json();path='/revision-attempts/'+started['attempt_id'];auth={'Authorization':'Bearer '+started['token']};client.post(path+'/begin',headers=auth);client.post(path+'/submit',headers=auth,json={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'😀 I am agree. Our roots are a foundation, not a cage.'});return test,admin,started['attempt_id'],path,auth

def test_exact_unicode_repetition_invalid_and_stable_anchors():
    text='😀 I am agree. I am agree.'
    assert not a.normalize(text,[annotation('I am agree')],'id')
    good=annotation('I am agree',start=2,end=12)
    rows=a.normalize(text,[good,good,annotation('Invented'),annotation('I am agree',category='clarity',start=2,end=12)],'id')
    assert len(rows)==1 and rows[0]['start']==2 and rows[0]['status']=='pending'
    assert a.normalize(text,[good],'id')[0]['id']==rows[0]['id']
    assert not a.normalize(text,[annotation('I am agree',intent='praise',start=15,end=999)],'id')
    assert a.normalize('Correct.',[annotation('Correct.',category='style',intent='praise')],'id')[0]['replacement'] is None

def test_teacher_edits_and_publishes_only_approved_without_changing_essay(client):
    test,admin,identifier,path,auth=submitted(client)
    with SessionLocal() as s:
        row=s.get(RevisionAttempt,identifier);draft=a.normalize(row.writing,[annotation('I am agree'),annotation('Our roots',category='style',intent='improvement',replacement='Our background'),annotation('not a cage',category='style',intent='praise')],identifier);row.report={**row.report,'essay_annotation_draft':draft,'essay_annotation_version':'v1'};s.commit()
    assert client.get(path,headers=auth).json()['essay_annotations']==[]
    view=client.get('/learning/revisions/attempts/'+identifier,headers=admin).json();edits=[{k:item[k] for k in ['id','status','replacement','explanation']} for item in view['essay_annotation_draft']];edits[0].update(status='approved',replacement='I agree',explanation='Use agree without am.');edits[1]['status']='rejected'
    body={'writing_score':15,'feedback':'Your metaphor is effective. Focus on precise verb forms in your next draft.','annotations':edits,'annotation_source_hash':view['annotation_source_hash'],'annotation_version':view['annotation_version']};endpoint='/learning/revisions/attempts/'+identifier+'/review'
    assert client.put(endpoint,json=body).status_code==401
    assert client.put(endpoint,headers=admin,json={**body,'annotation_source_hash':'bad'}).status_code==409
    assert client.put(endpoint,headers=admin,json={**body,'annotations':edits[:1]}).status_code==422
    response=client.put(endpoint,headers=admin,json=body);assert response.status_code==200,response.text
    result=client.get(path,headers=auth).json();assert len(result['essay_annotations'])==1 and result['essay_annotations'][0]['explanation']=='Use agree without am.';assert result['essay_text']=='😀 I am agree. Our roots are a foundation, not a cage.' and result['essay_score']==15
    assert client.put(endpoint,headers=admin,json=body).status_code==409
    # A new AI draft cannot replace published annotations or teacher marks.
    with SessionLocal() as s:
        row=s.get(RevisionAttempt,identifier);row.report={**row.report,'essay_annotation_draft':[],'essay_annotation_version':'v2'};s.commit()
    assert len(client.get(path,headers=auth).json()['essay_annotations'])==1
    assert client.post('/learning/revisions/tests/'+test+'/regrade',headers=admin).status_code==200
    result=client.get(path,headers=auth).json();assert result['essay_score']==15 and len(result['essay_annotations'])==1

def test_legacy_comments_pending_but_legacy_feedback_remains(client):
    _,admin,identifier,path,auth=submitted(client)
    with SessionLocal() as s:
        row=s.get(RevisionAttempt,identifier);row.report={**row.report,'ai_language_errors':[{'original':'I am agree','correction':'I agree','explanation':'Verb form.','category':'spelling'}],'writing_score':10,'teacher_feedback':'Existing teacher feedback.'};s.commit()
    view=client.get('/learning/revisions/attempts/'+identifier,headers=admin).json();assert view['essay_annotation_draft'][0]['category']=='grammar' and view['essay_annotation_draft'][0]['status']=='pending'
    result=client.get(path,headers=auth).json();assert result['essay_feedback']=='Existing teacher feedback.' and result['essay_annotations']==[]

def test_ai_annotations_are_validated_pending_and_never_auto_published(client,monkeypatch):
    from app import revisions
    _,admin,identifier,path,auth=submitted(client)
    monkeypatch.setattr(revisions.settings,'revision_ai_api_key','synthetic-private-key')
    payload={'score':16,'feedback':'You express a clear opinion and use an effective metaphor. Focus on accurate verb forms when explaining your position. In your next draft, check expressions with agree and connect your examples directly to the main argument. Keep your concise conclusion and develop one supporting example further.','breakdown':{k:4 for k in ['content','organisation','grammar','vocabulary']},'annotations':[annotation('I am agree'),annotation('not a cage',category='style',intent='praise'),annotation('Invented quote'),{'category':'grammar','intent':'correction','original':'Our roots','replacement':{},'explanation':'Malformed.'}]}
    def provider(*args,**kwargs):
        assert 'grammar|vocabulary|style' in kwargs['json']['messages'][0]['content']
        return SimpleNamespace(raise_for_status=lambda:None,json=lambda:{'choices':[{'message':{'content':json.dumps(payload)}}]})
    monkeypatch.setattr(revisions.httpx,'post',provider)
    result=client.post('/learning/revisions/attempts/'+identifier+'/ai-review',headers=admin);assert result.status_code==200
    body=result.json();assert body['report']['ai_status']=='provisional';assert len(body['essay_annotation_draft'])==2 and all(a['status']=='pending' for a in body['essay_annotation_draft'])
    assert body['report']['writing_score'] is None and client.get(path,headers=auth).json()['essay_annotations']==[]
