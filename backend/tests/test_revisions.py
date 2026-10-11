import base64

from test_learning import admin

def setup(client):
    ADMIN=admin(client)
    for code,condition in [('213','experimental'),('214','control')]:
        response=client.put('/learning/revisions/groups/'+code,headers=ADMIN,json={'condition':condition,'expected_count':2,'roster':['Synthetic Learner'],'emergent':['heritage']})
        assert response.status_code==200,response.text
    items=[{'id':s,'section':s,'prompt':'Complete the word: ___','answers':['heritage'],'target_word':'heritage'} for s in ['vocabulary','collocation','grammar','emergent']]
    spec={'title':'Synthetic Unit 7','level':'C1','unit':'7','groups':['213','214'],'priming':['Sentence one.','Sentence two.','Sentence three.','Sentence four.'],'writing_prompt':'Write about family traditions.','items':items}
    response=client.post('/learning/revisions/tests',headers=ADMIN,json=spec)
    assert response.status_code==200,response.text
    identifier=response.json()['id']
    assert client.post('/learning/revisions/tests/'+identifier+'/publish',headers=ADMIN).status_code==200
    return identifier,ADMIN

def test_consent_privacy_persistence_and_exports(client):
    identifier,ADMIN=setup(client)
    assert client.get('/learning/revisions/groups').status_code in [401,403]
    public=client.get('/revision-tests/'+identifier).json()
    assert 'roster' not in str(public) and 'condition' not in public
    assert client.post('/revision-tests/'+identifier+'/start',json={'group':'213','student_name':'Synthetic Learner'}).status_code==422
    attempts=[];credentials={}
    for consent in [True,False]:
        response=client.post('/revision-tests/'+identifier+'/start',json={'group':'213','student_name':'Synthetic Learner','research_consent':consent})
        assert response.status_code==200,response.text
        row=response.json();credentials[row['attempt_id']]=row['token'];attempts.append(row['attempt_id']);path='/revision-attempts/'+row['attempt_id'];auth={'Authorization':'Bearer '+row['token']}
        assert bool(row['warmup'])==consent
        assert all('answers' not in item for item in row['items'])
        assert client.get(path).status_code==401
        assert not client.post(path+'/begin',headers=auth).json()['warmup']
        timing={'vocabulary':{'item_started_at':'2026-10-11T10:00:00Z','first_input_at':'2026-10-11T10:00:02Z','reaction_time_ms':2000}}
        body={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'Our heritage matters to our family.','timing':timing}
        assert client.put(path,headers=auth,json=body).status_code==200
        body['timing']['vocabulary']['reaction_time_ms']=9999
        assert client.put(path,headers=auth,json=body).status_code==200
        saved=client.get(path,headers=auth).json()['timing']
        assert (saved['vocabulary']['reaction_time_ms']==2000) if consent else saved=={}
        response=client.post(path+'/submit',headers=auth,json=body)
        assert response.status_code==200,response.text
        assert response.json()['controlled_score']==80
        assert client.post(path+'/submit',headers=auth,json=body).json()==response.json()
        assert client.put(path,headers=auth,json=body).status_code==409
    teacher=client.get('/learning/revisions/tests/'+identifier+'/attempts',headers=ADMIN).json()
    assert len(teacher)==2 and {r['research_consent'] for r in teacher}=={True,False}
    assert all(r['condition']=='experimental' for r in teacher)
    assert all(r['report']['total_score'] is None for r in teacher)
    response=client.put('/learning/revisions/attempts/'+attempts[0]+'/review',headers=ADMIN,json={'writing_score':17,'feedback':'Good','usage':{'heritage':'correct'}})
    assert response.json()['report']['total_score']==97
    research=client.get('/learning/revisions/tests/'+identifier+'/export',headers=ADMIN).json()
    text=base64.b64decode(research['files'][0]['content']).decode('utf-8-sig')
    assert text.count('Synthetic Learner')==1
    teaching=client.get('/learning/revisions/tests/'+identifier+'/export?research_only=false',headers=ADMIN).json()
    assert base64.b64decode(teaching['files'][0]['content']).decode('utf-8-sig').count('Synthetic Learner')==2
    xlsx=client.get('/learning/revisions/tests/'+identifier+'/export?format=xlsx',headers=ADMIN)
    assert xlsx.status_code==200
    withdrawn=attempts[0]
    from app.db import SessionLocal
    from app.models import RevisionAttempt
    # Capability is needed to withdraw; another student cannot change participation.
    assert client.post('/revision-attempts/'+withdrawn+'/withdraw-research').status_code==401
    with SessionLocal() as session:
        assert session.get(RevisionAttempt,withdrawn).research_consent is True

def test_control_skips_preview_and_roster_is_private(client):
    identifier,ADMIN=setup(client)
    assert client.post('/revision-tests/'+identifier+'/start',json={'group':'214','student_name':'Unknown Person','research_consent':True}).status_code==422
    row=client.post('/revision-tests/'+identifier+'/start',json={'group':'214','student_name':'Synthetic Learner','research_consent':True}).json()
    assert row['warmup']==[]
    assert 'condition' not in row and 'research_consent' not in row

    assert client.post('/revision-attempts/'+row['attempt_id']+'/withdraw-research',headers={'Authorization':'Bearer '+row['token']}).status_code==200


def test_speaking_pairs_follow_readiness_and_stay_within_group(client):
    identifier,ADMIN=setup(client)
    spec=client.get('/learning/revisions/tests',headers=ADMIN).json()[0]['definition']
    spec.update(oral_individual=['What shapes identity?'],oral_dialogue=['Discuss a cultural celebration.'])
    client.put('/learning/revisions/tests/'+identifier,headers=ADMIN,json=spec)
    client.post('/learning/revisions/tests/'+identifier+'/publish',headers=ADMIN)
    credentials=[]
    for group in ['213','214','213']:
        row=client.post('/revision-tests/'+identifier+'/start',json={'group':group,'student_name':'Synthetic Learner','research_consent':True}).json()
        path='/revision-attempts/'+row['attempt_id'];auth={'Authorization':'Bearer '+row['token']};credentials.append((path,auth))
        client.post(path+'/begin',headers=auth)
        body={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'Our heritage matters.'}
        assert client.post(path+'/submit',headers=auth,json=body).status_code==200
    first,other,last=credentials
    assert client.post(first[0]+'/oral-ready',headers=first[1]).json()['status']=='waiting'
    assert client.post(other[0]+'/oral-ready',headers=other[1]).json()['status']=='waiting'
    paired=client.post(last[0]+'/oral-ready',headers=last[1]).json()
    assert paired['status']=='paired' and paired['preparation_seconds']==60 and paired['role']=='B'
    first_state=client.get(first[0]+'/oral',headers=first[1]).json()
    assert first_state['paired_at']==paired['paired_at'] and first_state['role']=='A'
    assert client.get(other[0]+'/oral',headers=other[1]).json()['status']=='waiting'
    assert client.post(last[0]+'/oral-ready',headers=last[1]).json()==paired
    other_id=other[0].split('/')[-1]
    assert client.post('/learning/revisions/attempts/'+other_id+'/oral-with-teacher',headers=ADMIN).status_code==200
    assert client.get(other[0]+'/oral',headers=other[1]).json()['partner_name']=='Teacher'
    assert client.put('/learning/revisions/attempts/'+other_id+'/oral-review',headers=ADMIN,json={'score':15,'feedback':'Clear response'}).json()['oral']['score']==15
    assert client.post(first[0]+'/withdraw-research',headers=first[1]).status_code==200
    report=client.get('/learning/revisions/tests/'+identifier+'/attempts',headers=ADMIN).json()
    withdrawn=next(r for r in report if r['id']==first[0].split('/')[-1]);assert withdrawn['research_consent'] is False
    assert withdrawn['report']['mean_reaction_time_ms'] is None


def test_withdrawing_during_test_keeps_answers_and_excludes_research(client):
    identifier,ADMIN=setup(client)
    row=client.post('/revision-tests/'+identifier+'/start',json={'group':'213','student_name':'Synthetic Learner','research_consent':True}).json()
    path='/revision-attempts/'+row['attempt_id'];auth={'Authorization':'Bearer '+row['token']}
    client.post(path+'/begin',headers=auth)
    body={'answers':{'vocabulary':'heritage'},'writing':'Draft essay.', 'timing':{'vocabulary':{'item_started_at':'2026-10-11T10:00:00Z','first_input_at':'2026-10-11T10:00:02Z','reaction_time_ms':2000}}}
    assert client.put(path,headers=auth,json=body).status_code==200
    assert client.post(path+'/withdraw-research',headers=auth).status_code==200
    saved=client.get(path,headers=auth).json()
    assert saved['answers']==body['answers'] and saved['writing']==body['writing']
    assert saved['collect_response_times'] is False and saved['timing']=={} and saved['warmup']==[]
    # Even a stale queued save cannot restore response-time collection.
    assert client.put(path,headers=auth,json=body).status_code==200
    assert client.get(path,headers=auth).json()['timing']=={}
    body['answers']={s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']}
    submitted=client.post(path+'/submit',headers=auth,json=body).json()
    assert submitted['controlled_score']==80 and submitted['collect_response_times'] is False
    teacher=client.get('/learning/revisions/tests/'+identifier+'/attempts',headers=ADMIN).json()
    assert len(teacher)==1 and teacher[0]['condition']=='experimental' and teacher[0]['research_consent'] is False
    export=client.get('/learning/revisions/tests/'+identifier+'/export',headers=ADMIN).json()
    assert 'Synthetic Learner' not in base64.b64decode(export['files'][0]['content']).decode('utf-8-sig')


def test_unit7_emergent_items_are_unique_to_each_group(client):
    import json
    from pathlib import Path
    ADMIN=admin(client)
    for level in ['b2','c1']:
        spec=json.loads((Path(__file__).parents[1]/'revision_materials'/('unit7-'+level+'.json')).read_text())
        for group in spec['groups']:
            assert client.put('/learning/revisions/groups/'+group,headers=ADMIN,json={'condition':'control','expected_count':1,'roster':['Synthetic Learner'],'emergent':[]}).status_code==200
        test=client.post('/learning/revisions/tests',headers=ADMIN,json=spec).json()['id']
        assert client.post('/learning/revisions/tests/'+test+'/publish',headers=ADMIN).status_code==200
        itemsets=[]
        for group in spec['groups']:
            row=client.post('/revision-tests/'+test+'/start',json={'group':group,'student_name':'Synthetic Learner','research_consent':False}).json()
            expected={i['id'] for i in spec['items'] if i['section']=='emergent' and group in i.get('groups',[])}
            actual={i['id'] for i in row['items'] if i['section']=='emergent'}
            assert actual==expected and len(actual)==6
            assert len(row['items'])==34
            itemsets.append(actual)
        assert all(not a.intersection(b) for i,a in enumerate(itemsets) for b in itemsets[i+1:])


def test_common_student_link_lists_only_published_tests_without_private_data(client):
    identifier,ADMIN=setup(client)
    spec=client.get('/learning/revisions/tests',headers=ADMIN).json()[0]['definition']
    draft=client.post('/learning/revisions/tests',headers=ADMIN,json={**spec,'title':'Private draft'}).json()['id']
    public=client.get('/revision-tests')
    assert public.status_code==200
    assert public.json()==[{'id':identifier,'title':spec['title'],'unit':'7','groups':['213','214']}]
    assert draft not in str(public.json()) and 'Synthetic Learner' not in str(public.json()) and 'answers' not in str(public.json())
    client.put('/learning/revisions/tests/'+identifier,headers=ADMIN,json=spec)
    assert client.get('/revision-tests').json()==[]


def test_essay_topic_is_saved_validated_and_exported(client):
    identifier,ADMIN=setup(client)
    spec=client.get('/learning/revisions/tests',headers=ADMIN).json()[0]['definition']
    spec['writing_topics']=['Traditions should change. Discuss.','Ancestry does not determine identity. Discuss.']
    assert client.put('/learning/revisions/tests/'+identifier,headers=ADMIN,json=spec).status_code==200
    client.post('/learning/revisions/tests/'+identifier+'/publish',headers=ADMIN)
    row=client.post('/revision-tests/'+identifier+'/start',json={'group':'213','student_name':'Synthetic Learner','research_consent':False}).json()
    path='/revision-attempts/'+row['attempt_id'];auth={'Authorization':'Bearer '+row['token']};client.post(path+'/begin',headers=auth)
    body={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'Our heritage influences us, but we make our own choices.'}
    assert row['writing_topics']==spec['writing_topics']
    assert client.post(path+'/submit',headers=auth,json=body).status_code==422
    assert client.put(path,headers=auth,json={**body,'writing_topic':'Not an available topic'}).status_code==422
    body['writing_topic']=spec['writing_topics'][1]
    assert client.put(path,headers=auth,json=body).status_code==200
    assert client.get(path,headers=auth).json()['writing_topic']==body['writing_topic']
    assert client.post(path+'/submit',headers=auth,json=body).status_code==200
    rows=client.get('/learning/revisions/tests/'+identifier+'/attempts',headers=ADMIN).json()
    assert rows[0]['report']['writing_topic']==body['writing_topic']
    reviewed=client.put('/learning/revisions/attempts/'+row['attempt_id']+'/review',headers=ADMIN,json={'writing_score':18}).json()
    assert reviewed['report']['writing_topic']==body['writing_topic'] and reviewed['report']['total_score']==98
    export=client.get('/learning/revisions/tests/'+identifier+'/export?research_only=false',headers=ADMIN).json()
    assert body['writing_topic'] in base64.b64decode(export['files'][0]['content']).decode('utf-8-sig')

def test_private_result_updates_and_rating_waits_for_both_reviews(client):
    identifier,ADMIN=setup(client)
    started=client.post('/revision-tests/'+identifier+'/start',json={'group':'214','student_name':'Synthetic Learner','research_consent':False}).json()
    path='/revision-attempts/'+started['attempt_id'];auth={'Authorization':'Bearer '+started['token']}
    assert client.post(path+'/begin',headers=auth).status_code==200
    body={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'A family tradition.'}
    result=client.post(path+'/submit',headers=auth,json=body).json()
    assert result['rating_score'] is None and result['rating_pending']
    assert client.get(path).status_code==401
    assert client.get(path,headers={'Authorization':'Bearer wrong'}).status_code in [401,403]
    client.put('/learning/revisions/attempts/'+started['attempt_id']+'/review',headers=ADMIN,json={'writing_score':16,'feedback':'Develop your example.','usage':{}})
    assert client.get(path,headers=auth).json()['rating_score'] is None
    client.put('/learning/revisions/attempts/'+started['attempt_id']+'/oral-review',headers=ADMIN,json={'score':12,'feedback':'Clear, but pause less.'})
    result=client.get(path,headers=auth).json()
    assert result['rating_score']==2.7 and result['rating_max']==3 and not result['rating_pending']
    assert result['essay_feedback']=='Develop your example.' and result['oral_feedback']=='Clear, but pause less.'
    assert 'answers' not in result and 'items' not in result
    client.put('/learning/revisions/attempts/'+started['attempt_id']+'/oral-review',headers=ADMIN,json={'score':20,'feedback':'Updated.'})
    assert client.get(path,headers=auth).json()['rating_score']==2.9

def test_criterion_marks_are_validated_and_summed(client):
    identifier,ADMIN=setup(client)
    started=client.post('/revision-tests/'+identifier+'/start',json={'group':'214','student_name':'Synthetic Learner','research_consent':False}).json()
    path='/revision-attempts/'+started['attempt_id'];auth={'Authorization':'Bearer '+started['token']}
    client.post(path+'/begin',headers=auth)
    client.post(path+'/submit',headers=auth,json={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'An essay.'})
    review='/learning/revisions/attempts/'+started['attempt_id']
    essay={'content':4,'organisation':3,'grammar':5,'vocabulary':4}
    response=client.put(review+'/review',headers=ADMIN,json={'writing_score':0,'breakdown':essay})
    assert response.status_code==200 and response.json()['report']['writing_score']==16
    oral={'task':3,'fluency':2,'vocabulary':4,'grammar':3,'pronunciation':4}
    response=client.put(review+'/oral-review',headers=ADMIN,json={'score':0,'breakdown':oral})
    assert response.status_code==200 and response.json()['oral']['score']==16
    public=client.get(path,headers=auth).json()
    assert public['essay_breakdown']==essay and public['oral_breakdown']==oral
    assert client.put(review+'/review',headers=ADMIN,json={'writing_score':20,'breakdown':{'content':6}}).status_code==422

def test_teacher_can_withdraw_consent_without_removing_academic_result(client):
    identifier,ADMIN=setup(client)
    started=client.post('/revision-tests/'+identifier+'/start',json={'group':'213','student_name':'Synthetic Learner','research_consent':True}).json()
    path='/revision-attempts/'+started['attempt_id'];auth={'Authorization':'Bearer '+started['token']}
    client.post(path+'/begin',headers=auth)
    client.post(path+'/submit',headers=auth,json={'answers':{s:'heritage' for s in ['vocabulary','collocation','grammar','emergent']},'writing':'Our heritage matters.'})
    withdraw='/learning/revisions/attempts/'+started['attempt_id']+'/withdraw-research'
    assert client.post(withdraw).status_code in [401,403]
    assert client.post(withdraw,headers=auth).status_code in [401,403]
    response=client.post(withdraw,headers=ADMIN)
    assert response.status_code==200,response.text
    result=response.json()
    assert not result['research_consent'] and result['submitted_at']
    assert result['writing']=='Our heritage matters.' and result['report']['controlled_score']==80
    assert result['report']['research_metrics']=={}
    assert client.get(path,headers=auth).json()['submitted']
