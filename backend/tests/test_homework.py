from datetime import timedelta
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
from app.learning import now
from app.db import SessionLocal
from app.models import HomeworkSubmission, CompensationAccess, AttendanceMark
from test_learning import admin, student


def task(client, headers, gid, **changes):
    body = {'title': 'Synthetic task', 'description': 'Use moonlit in a sentence.', 'group_ids': [gid],
            'starts_at': (now()-timedelta(days=1)).isoformat()+'Z',
            'ends_at': (now()+timedelta(days=7)).isoformat()+'Z',
            'vocabulary': ['moonlit'], 'constructions': ['would ... like']}
    response = client.post('/learning/tasks', headers=headers, json={**body, **changes})
    assert response.status_code == 201, response.text
    return response.json()


def answer(client, headers, tid, **changes):
    return client.post(f'/learning/tasks/{tid}/submissions', headers=headers,
                       json={'kind': 'text', 'content': 'A moonlit night.', 'request_id': str(uuid4()), **changes})


def test_tasks_are_course_scoped_private_and_atomic(client, authentication):
    elevated = admin(client); first, profile, _ = student(client, authentication)
    gid = profile['group_id']; created = task(client, elevated, gid)
    other = client.post('/learning/groups', headers=elevated, json={'name': 'Grammar', 'course_id': 'grammar'}).json()['id']
    foreign = task(client, elevated, other)
    assert client.get('/learning/tasks').status_code == 401
    assert [item['id'] for item in client.get('/learning/tasks', headers=first).json()] == [created['id']]
    assert client.get(f"/learning/tasks/{foreign['id']}/submissions", headers=first).status_code == 404
    assert answer(client, first, foreign['id']).status_code == 404
    body = {key: created[key] for key in ['title', 'description', 'group_ids', 'starts_at', 'ends_at', 'kind']}
    assert client.post('/learning/tasks', headers=first, json=body).status_code == 403
    assert client.post('/learning/tasks', headers=elevated, json={**body, 'group_ids': [gid, other]}).status_code == 422
    assert client.post('/learning/tasks', headers=elevated, json={**body, 'starts_at': created['ends_at'], 'ends_at': created['starts_at']}).status_code == 422
    assert client.post('/learning/tasks', headers=elevated, json={**body, 'starts_at': '2026-10-10T10:00:00'}).status_code == 422
    assert len(client.get('/learning/tasks', headers=elevated).json()) == 2
    text = client.get('/learning/tasks', headers=first).text
    assert 'telegram_user_id' not in text and 'legal_name' not in text


def test_three_immutable_attempts_feedback_and_idempotent_retry(client, authentication):
    elevated = admin(client); first, profile, auth = student(client, authentication, 11)
    second, _, _ = student(client, authentication, 12)
    created = task(client, elevated, profile['group_id'])
    request_id = str(uuid4())
    first_work = answer(client, first, created['id'], request_id=request_id).json()
    retried = answer(client, first, created['id'], request_id=request_id)
    assert retried.status_code == 201 and retried.json()['id'] == first_work['id']
    assert answer(client, first, created['id'], request_id=request_id, content='Changed answer').status_code == 409
    assert answer(client, first, created['id'], content='Second').json()['attempt'] == 2
    assert answer(client, first, created['id'], kind='link', content='https://example.org/work').json()['attempt'] == 3
    assert answer(client, first, created['id']).status_code == 409
    path = f"/learning/submissions/{first_work['id']}/feedback"
    assert client.put(path, headers=first, json={'comment': 'Forgery'}).status_code == 403
    assert client.put(path, headers=elevated, json={'comment': 'Check tense.'}).status_code == 200
    assert client.get(f"/learning/tasks/{created['id']}/submissions", headers=second).json() == []
    assert client.post('/learning/logout', headers=first).status_code == 204
    login = client.post('/learning/login/telegram', json={'telegram_data': auth['telegram_data']}).json()
    renewed = {'Authorization': 'Bearer '+login['access_token']}
    saved = client.get(f"/learning/tasks/{created['id']}/submissions", headers=renewed).json()
    assert [item['attempt'] for item in saved] == [1, 2, 3]
    assert saved[0]['content'] == 'A moonlit night.' and saved[0]['feedback'] == 'Check tense.'
    with SessionLocal() as session:
        assert session.query(HomeworkSubmission).count() == 3


def test_checkpoint_specific_certificate_access_and_revocation(client, authentication):
    elevated = admin(client); first, profile, _ = student(client, authentication)
    second, other, _ = student(client, authentication, 12)
    checkpoint = task(client, elevated, profile['group_id'], kind='checkpoint')
    another = task(client, elevated, profile['group_id'], kind='checkpoint', title='Another period')
    compensation = task(client, elevated, profile['group_id'], kind='compensation', checkpoint_id=checkpoint['id'])
    assert answer(client, first, compensation['id']).status_code == 403
    view = next(item for item in client.get('/learning/tasks', headers=first).json() if item['id'] == compensation['id'])
    assert not view['allowed'] and not view['description'] and not view['vocabulary']
    access_path = f"/learning/tasks/{checkpoint['id']}/access"
    body = {'student_id': profile['public_id'], 'certificate_checked': True}
    assert client.put(access_path, headers=first, json=body).status_code == 403
    assert client.put(f"/learning/tasks/{another['id']}/access", headers=elevated, json=body).status_code == 200
    assert answer(client, first, compensation['id']).status_code == 403
    assert client.put(access_path, headers=elevated, json=body).status_code == 200
    assert answer(client, second, compensation['id']).status_code == 403
    assert answer(client, first, compensation['id']).status_code == 201
    assert client.put(access_path, headers=elevated, json={**body, 'certificate_checked': False}).status_code == 200
    assert answer(client, first, compensation['id']).status_code == 403
    # Revocation closes future attempts; it preserves the student's already submitted history.
    assert len(client.get(f"/learning/tasks/{compensation['id']}/submissions", headers=first).json()) == 1
    assert client.get(access_path, headers=first).status_code == 403


def test_server_timing_validation_photos_and_concurrent_attempts(client, authentication):
    elevated = admin(client); first, profile, _ = student(client, authentication)
    future = task(client, elevated, profile['group_id'], starts_at=(now()+timedelta(days=1)).isoformat()+'Z')
    assert answer(client, first, future['id']).status_code == 409
    expired = task(client, elevated, profile['group_id'], ends_at=(now()-timedelta(hours=1)).isoformat()+'Z')
    assert answer(client, first, expired['id']).json()['late'] is True
    for changes in [{'kind': 'link', 'content': 'javascript:alert(1)'}, {'kind': 'link', 'content': 'https://user:pass@example.org'},
                    {'student_id': profile['public_id']}, {'attempt': 1}, {'created_at': '2026-01-01'},
                    {'photos': [{'name': 'photo', 'src': 'data:image/svg+xml;base64,xxx'}]}]:
        assert answer(client, first, expired['id'], **changes).status_code == 422
    created = task(client, elevated, profile['group_id'])
    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(lambda _: answer(client, first, created['id']), range(2)))
    assert all(response.status_code in [201, 409] for response in responses)
    with SessionLocal() as session:
        works = session.query(HomeworkSubmission).filter_by(task_id=created['id']).all()
        assert len({work.attempt for work in works}) == len(works)


def test_attendance_uses_aliases_is_private_and_never_grants_compensation(client, authentication):
    elevated = admin(client); first, profile, _ = student(client, authentication, 11)
    second, other, _ = student(client, authentication, 12)
    lesson_body = {'group_id': profile['group_id'], 'title': 'Speech practice', 'starts_at': '2026-10-10T10:00:00+03:00'}
    assert client.post('/learning/attendance', headers=first, json=lesson_body).status_code == 403
    lesson = client.post('/learning/attendance', headers=elevated, json=lesson_body)
    assert lesson.status_code == 201
    lesson = lesson.json(); path = '/learning/attendance/'+lesson['id']
    assert all(mark['status'] == 'unmarked' for mark in lesson['marks'])
    assert client.post('/learning/attendance', headers=elevated, json=lesson_body).status_code == 409
    marks = {'marks': [{'student_id': profile['public_id'], 'status': 'excused'}, {'student_id': other['public_id'], 'status': 'late'}]}
    assert client.put(path, headers=first, json=marks).status_code == 403
    assert client.put(path, headers=elevated, json=marks).status_code == 200
    own = client.get('/learning/attendance', headers=first)
    assert own.headers['cache-control'] == 'no-store'
    assert own.json()[0]['marks'] == [{'student_id': profile['public_id'], 'pseudonym': profile['pseudonym'], 'status': 'excused'}]
    assert client.get('/learning/attendance', headers=second).json()[0]['marks'][0]['status'] == 'late'
    assert 'telegram_user_id' not in own.text and 'legal_name' not in own.text and other['public_id'] not in own.text
    with SessionLocal() as session:
        assert session.query(CompensationAccess).count() == 0
    # Mixed invalid batches cannot partially rewrite valid marks.
    invalid = {'marks': [{'student_id': profile['public_id'], 'status': 'absent'}, {'student_id': str(uuid4()), 'status': 'present'}]}
    assert client.put(path, headers=elevated, json=invalid).status_code == 404
    assert client.get('/learning/attendance', headers=first).json()[0]['marks'][0]['status'] == 'excused'
    foreign_group = client.post('/learning/groups', headers=elevated, json={'name': 'Other', 'course_id': 'grammar'}).json()['id']
    foreign = client.post('/learning/attendance', headers=elevated, json={**lesson_body, 'group_id': foreign_group}).json()
    assert len(client.get('/learning/attendance', headers=first).json()) == 1
