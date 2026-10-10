from datetime import timedelta
import hashlib
from app.db import SessionLocal
from app.models import Student, LearningSession, CardProgress, ReviewEvent
from app.learning import now

ADMIN = {'X-Admin-Token':'test-admin'}
CARD = {'term':'searing pain','meaning':'жгучая боль','definition':'Intense burning pain.','synonyms':['burning pain']}

def admin(client):
    r = client.post('/learning/login/admin',json={'token':'test-admin'})
    assert r.status_code == 200
    return {'Authorization':'Bearer '+r.json()['access_token']}

def student(client, authentication, uid=11):
    auth = authentication(uid)
    reservation = client.post('/auth/telegram/pseudonym',json=auth).json()
    r = client.post('/auth/telegram/register',json={**auth,'pseudonym_token':reservation['token']})
    assert r.status_code == 201
    login = client.post('/learning/login/telegram',json={'telegram_data':auth['telegram_data']})
    assert login.status_code == 200
    return {'Authorization':'Bearer '+login.json()['access_token']},r.json(),auth

def deck(client,headers,gid,cards=None):
    r = client.post('/learning/decks',headers=headers,json={'title':'Synthetic list','group_id':gid,'cards':cards or [CARD]})
    assert r.status_code == 201,r.text
    return r.json()

def test_session_roles_expiry_hashing_and_logout(client,authentication):
    headers,profile,_ = student(client,authentication)
    token = headers['Authorization'][7:]
    assert client.get('/learning/me').status_code == 401
    assert client.post('/learning/login/admin',json={'token':'wrong'}).status_code == 403
    assert client.post('/learning/login/telegram',json={'telegram_data':{'id':'11'}}).status_code == 401
    assert client.post('/learning/login/telegram',json={'role':'admin'}).status_code == 422
    me = client.get('/learning/me',headers=headers)
    assert me.json() == {'role':'student','pseudonym':profile['pseudonym'],'group_id':profile['group_id'],'is_card_editor':False}
    assert me.headers['cache-control'] == 'no-store'
    assert client.get('/learning/groups',headers=headers).status_code == 403
    with SessionLocal() as session:
        record = session.get(LearningSession,hashlib.sha256(token.encode()).hexdigest())
        assert record and record.token_hash != token
        record.expires_at = now()-timedelta(seconds=1)
        session.commit()
    assert client.get('/learning/me',headers=headers).status_code == 401
    elevated = admin(client)
    assert client.post('/learning/logout',headers=elevated).status_code == 204
    assert client.get('/learning/me',headers=elevated).status_code == 401

def test_group_editor_replacement_revocation_and_moderation(client,authentication):
    elevated = admin(client)
    first,a,_ = student(client,authentication,11)
    second,b,_ = student(client,authentication,12)
    gid = a['group_id']; body = {'title':'Draft','group_id':gid,'cards':[CARD]}
    assert client.post('/learning/decks',headers=first,json=body).status_code == 403
    assert client.put(f'/learning/groups/{gid}/editor',headers=first,json={'student_id':a['public_id']}).status_code == 403
    assert client.put(f'/learning/groups/{gid}/editor',headers=elevated,json={'student_id':a['public_id']}).status_code == 200
    draft = deck(client,first,gid)
    assert draft['status'] == 'pending'
    assert client.get('/learning/study',headers=first).json()['total'] == 0
    assert client.get('/learning/decks',headers=second).json() == []
    assert client.post(f"/learning/decks/{draft['id']}/approve",headers=first).status_code == 403
    assert client.put(f'/learning/groups/{gid}/editor',headers=elevated,json={'student_id':b['public_id']}).status_code == 200
    assert client.get('/learning/me',headers=first).json()['is_card_editor'] is False
    assert client.get('/learning/me',headers=second).json()['is_card_editor'] is True
    assert client.post('/learning/decks',headers=first,json=body).status_code == 403
    assert client.post(f"/learning/decks/{draft['id']}/approve",headers=elevated).status_code == 200
    assert client.get('/learning/study',headers=second).json()['total'] == 1
    assert client.put(f'/learning/groups/{gid}/editor',headers=elevated,json={'student_id':None}).status_code == 200
    assert client.get('/learning/me',headers=second).json()['is_card_editor'] is False

def test_other_group_is_inaccessible_and_registry_fields_are_absent(client,authentication):
    elevated = admin(client)
    first,a,_ = student(client,authentication)
    foreign = client.post('/groups',headers=ADMIN,json={'name':'Other synthetic group','course_id':'grammar'}).json()
    other = deck(client,elevated,foreign['id'])
    assert client.get('/learning/decks',headers=first).json() == []
    assert client.post('/learning/decks',headers=first,json={'title':'Wrong','group_id':foreign['id'],'cards':[CARD]}).status_code == 404
    assert client.post(f"/learning/cards/{other['cards'][0]['id']}/review",headers=first,json={'rating':'easy'}).status_code == 404
    assert client.put(f"/learning/groups/{foreign['id']}/editor",headers=elevated,json={'student_id':a['public_id']}).status_code == 404
    text = client.get('/learning/groups',headers=elevated).text
    assert 'telegram_user_id' not in text and 'legal_name' not in text

def test_progress_persists_after_relogin_and_belongs_to_student(client,authentication):
    elevated = admin(client)
    first,a,auth = student(client,authentication,11)
    second,_,_ = student(client,authentication,12)
    card_id = deck(client,elevated,a['group_id'])['cards'][0]['id']
    assert client.post(f'/learning/cards/{card_id}/review',headers=first,json={'rating':'good'}).status_code == 200
    assert client.post(f'/learning/cards/{card_id}/review',headers=first,json={'rating':'easy'}).status_code == 409
    with SessionLocal() as session:
        uid = session.query(Student).filter_by(telegram_user_id=11).one().id
        progress = session.get(CardProgress,(uid,card_id))
        assert progress.level == 1 and progress.interval_days == 3
        assert session.query(ReviewEvent).count() == 1
    assert client.post('/learning/logout',headers=first).status_code == 204
    login = client.post('/learning/login/telegram',json={'telegram_data':auth['telegram_data']}).json()
    refreshed = {'Authorization':'Bearer '+login['access_token']}
    own = client.get('/learning/study',headers=refreshed).json()
    other = client.get('/learning/study',headers=second).json()
    assert own['xp'] == own['streak'] == 1 and own['due'] == []
    assert other['xp'] == other['streak'] == 0 and len(other['due']) == 1
    assert client.get('/learning/study',headers=elevated).status_code == 403

def test_daily_xp_and_streak_use_server_clock(client,authentication,monkeypatch):
    from app import learning
    elevated = admin(client); first,a,_ = student(client,authentication)
    card_id = deck(client,elevated,a['group_id'])['cards'][0]['id']
    current = now().replace(hour=12,minute=0,second=0,microsecond=0)
    monkeypatch.setattr(learning,'now',lambda:current)
    assert client.post(f'/learning/cards/{card_id}/review',headers=first,json={'rating':'again','student_id':22}).status_code == 422
    assert client.post(f'/learning/cards/{card_id}/review',headers=first,json={'rating':'again'}).status_code == 200
    current += timedelta(minutes=10)
    assert client.post(f'/learning/cards/{card_id}/review',headers=first,json={'rating':'hard'}).status_code == 200
    assert client.get('/learning/study',headers=first).json()['xp'] == 1
    current += timedelta(days=1)
    # Keep the synthetic fixture session valid while testing the review clock.
    with SessionLocal() as session:
        session.query(LearningSession).filter_by(role='student').update({'expires_at':current+timedelta(hours=8)})
        session.commit()
    assert client.post(f'/learning/cards/{card_id}/review',headers=first,json={'rating':'easy'}).status_code == 200
    assert client.get('/learning/study',headers=first).json()['streak'] == 2
    current += timedelta(days=2)
    with SessionLocal() as session:
        session.query(LearningSession).filter_by(role='student').update({'expires_at':current+timedelta(hours=8)})
        session.commit()
    assert client.get('/learning/study',headers=first).json()['streak'] == 0

def test_simple_proposals_need_approval_and_invalid_batches_are_atomic(client,authentication):
    first,a,_ = student(client,authentication)
    created = deck(client,first,a['group_id'],[{'term':'moonlit','meaning':'лунный','example':'A garden.'}])
    assert created['status'] == 'pending'
    assert client.get('/learning/study',headers=first).json()['total'] == 0
    for cards in [[CARD,{**CARD,'term':'SEARING PAIN'}],[{**CARD,'meaning':' '}],[{**CARD,'synonyms':['x'*151]}],[{**CARD,'definition':'x'*501}]]:
        assert client.post('/learning/decks',headers=first,json={'title':'Invalid','group_id':a['group_id'],'cards':cards}).status_code == 422
    assert len(client.get('/learning/decks',headers=first).json()) == 1

def test_deactivation_revokes_existing_student_session(client,authentication):
    first,_,_ = student(client,authentication)
    with SessionLocal() as session:
        session.query(Student).filter_by(telegram_user_id=11).one().is_active = False
        session.commit()
    assert client.get('/learning/decks',headers=first).status_code == 403

def test_cors_authorization_and_editor_put(client):
    response = client.options('/learning/groups/1/editor',headers={'Origin':'https://mooncampus.ru','Access-Control-Request-Method':'PUT','Access-Control-Request-Headers':'Authorization, Content-Type'})
    assert response.status_code == 200
    assert response.headers['access-control-allow-origin'] == 'https://mooncampus.ru'

def test_authenticated_group_creation_has_one_course_and_requires_admin(client,authentication):
    elevated = admin(client); first,_,_ = student(client,authentication)
    body = {'name':'Grammar evening','course_id':'grammar'}
    assert client.post('/learning/groups',headers=first,json=body).status_code == 403
    result = client.post('/learning/groups',headers=elevated,json=body)
    assert result.status_code == 201 and result.json()['course_id'] == 'grammar'
    assert client.post('/learning/groups',headers=elevated,json=body).status_code == 409
    assert client.post('/learning/groups',headers=elevated,json={**body,'course_id':'unknown'}).status_code == 422


def test_concurrent_reviews_commit_once(client,authentication):
    from concurrent.futures import ThreadPoolExecutor
    elevated = admin(client); first,a,_ = student(client,authentication)
    card_id = deck(client,elevated,a['group_id'])['cards'][0]['id']
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(client.post,f'/learning/cards/{card_id}/review',headers=first,json={'rating':'good'}) for _ in range(2)]
        statuses = [future.result().status_code for future in futures]
    assert sorted(statuses) == [200,409]
    assert client.get('/learning/study',headers=first).json()['xp'] == 1
    with SessionLocal() as session:
        assert session.query(CardProgress).one().version == 1
        assert session.query(ReviewEvent).count() == 1

def test_teacher_corrects_pending_draft_and_cannot_reset_published_progress(client,authentication):
    elevated = admin(client); first,a,_ = student(client,authentication)
    draft = deck(client,first,a['group_id'],[{'term':'moonlit','meaning':'лунный'}])
    corrected = {'title':'Checked draft','group_id':a['group_id'],'cards':[{'term':'moonlit','meaning':'освещённый луной','definition':'Lit by the moon.'}]}
    assert client.put(f"/learning/decks/{draft['id']}",headers=first,json=corrected).status_code == 403
    response = client.put(f"/learning/decks/{draft['id']}",headers=elevated,json=corrected)
    assert response.status_code == 200
    assert response.json()['status'] == 'pending'
    assert response.json()['cards'][0]['meaning'] == 'освещённый луной'
    assert client.post(f"/learning/decks/{draft['id']}/approve",headers=elevated).status_code == 200
    assert client.put(f"/learning/decks/{draft['id']}",headers=elevated,json=corrected).status_code == 409
    assert client.get('/learning/study',headers=first).json()['due'][0]['definition'] == 'Lit by the moon.'
