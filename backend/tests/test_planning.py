from test_learning import admin, student


def plan(gid, **changes):
    return {'group_id':gid,'position':1,'topic':'Narrative tenses','starts_at':'2026-10-12T10:00:00+03:00',
            'duration_minutes':90,'objectives':'Tell a story','materials':'Unit 2',
            'vocabulary':['moonlit'],'constructions':['would ... like'],**changes}


def test_plan_privacy_atomic_schedule_validation_and_revision(client, authentication):
    elevated=admin(client); learner, profile, _=student(client, authentication)
    gid=profile['group_id']; body=plan(gid)
    assert client.get('/learning/plans').status_code==401
    assert client.post('/learning/plans',headers=learner,json={'lessons':[body]}).status_code==403
    created=client.post('/learning/plans',headers=elevated,json={'lessons':[body]})
    assert created.status_code==201,created.text
    pid=created.json()[0]['id']
    other=client.post('/learning/groups',headers=elevated,json={'name':'Other planning group','course_id':'grammar'}).json()['id']
    assert client.post('/learning/plans',headers=elevated,json={'lessons':[plan(other)]}).status_code==201
    own=client.get('/learning/plans',headers=learner)
    assert len(own.json())==1 and own.json()[0]['topic']=='Narrative tenses'
    assert own.headers['cache-control']=='no-store'
    assert client.put('/learning/plans/'+pid,headers=learner,json={**body,'topic':'Forgery'}).status_code==403
    assert client.put('/learning/plans/'+pid,headers=elevated,json={**body,'completed':True}).json()['completed'] is True
    assert client.put('/learning/plans/'+pid,headers=elevated,json={**body,'group_id':other}).status_code==422
    batch=[plan(gid,position=2,starts_at='2026-10-13T10:00:00+03:00'),plan(gid,position=3,starts_at='2026-10-12T10:30:00+03:00')]
    assert client.post('/learning/plans',headers=elevated,json={'lessons':batch}).status_code==409
    assert len(client.get('/learning/plans',headers=learner).json())==1
    assert client.post('/learning/plans',headers=elevated,json={'lessons':[plan(gid,starts_at='2026-10-12T11:30:00+03:00')]}).status_code==201
    assert client.post('/learning/plans',headers=elevated,json={'lessons':[plan(gid,starts_at=None,topic='Undated topic')]}).status_code==201
    assert client.post('/learning/plans',headers=elevated,json={'lessons':[plan(gid,starts_at='2026-10-15T12:00:00')]}).status_code==422


def test_plan_to_attendance_is_idempotent_and_preserves_the_journal(client, authentication):
    elevated=admin(client); learner,profile,_=student(client,authentication)
    body=plan(profile['group_id'])
    pid=client.post('/learning/plans',headers=elevated,json={'lessons':[body]}).json()[0]['id']
    path='/learning/plans/'+pid+'/attendance'
    assert client.post(path,headers=learner).status_code==403
    first=client.post(path,headers=elevated)
    assert first.status_code==200,first.text
    assert client.post(path,headers=elevated).json()==first.json()
    journal=client.get('/learning/attendance',headers=elevated).json()
    assert len(journal)==1 and journal[0]['title']=='Narrative tenses'
    assert client.put('/learning/plans/'+pid,headers=elevated,json={**body,'topic':'Different title'}).status_code==409
    assert client.put('/learning/plans/'+pid,headers=elevated,json={**body,'materials':'New handout'}).status_code==200
    undated=client.post('/learning/plans',headers=elevated,json={'lessons':[plan(profile['group_id'],starts_at=None)]}).json()[0]['id']
    assert client.post('/learning/plans/'+undated+'/attendance',headers=elevated).status_code==422
