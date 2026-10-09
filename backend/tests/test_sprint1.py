from datetime import timedelta
import hashlib
import hmac
import json
import time
from urllib.parse import urlencode
import uuid

from app.main import now, settings
from app.db import SessionLocal
from app.models import GroupInvitation, IdentityRegistry, PseudonymReservation, Student
from app.pseudonyms import PSEUDONYMS, choose_pseudonym


def reserve(client, auth):
    response = client.post('/auth/telegram/pseudonym', json=auth)
    assert response.status_code == 200, response.text
    return response.json()


def test_registration_and_private_registry(client, authentication):
    auth = authentication()
    reservation = reserve(client, auth)
    r = client.post('/auth/telegram/register', json={**auth, 'pseudonym_token': reservation['token']})
    assert r.status_code == 201
    assert r.json()['pseudonym'] == reservation['pseudonym']
    assert len(r.json()['pseudonym'].split()) == 2
    uuid.UUID(r.json()['public_id'])
    assert set(r.json()) == {'public_id', 'pseudonym', 'group_id'}
    assert r.headers['cache-control'] == 'no-store'
    assert client.get('/admin/identity-registry').status_code == 403
    with SessionLocal() as session:
        student = session.query(Student).one()
        assert student.identity is None  # Registration never collects legal names.
        session.add(IdentityRegistry(student_id=student.id, legal_name='Synthetic legacy record'))
        session.commit()
    registry = client.get('/admin/identity-registry', headers={'X-Admin-Token': 'test-admin'})
    assert registry.status_code == 200
    assert registry.json() == [{'student_id': r.json()['public_id'], 'legal_name': 'Synthetic legacy record'}]
    assert client.post('/auth/telegram/register', json={**auth, 'pseudonym_token': reservation['token']}).status_code in (403, 409)


def test_unique_pseudonyms_and_reserved_teacher(client, authentication):
    a = authentication(11)
    b = authentication(12)
    first = reserve(client, a)
    second = reserve(client, b)
    third = reserve(client, a)
    assert len({first['pseudonym'], second['pseudonym'], third['pseudonym']}) == 3
    assert 'Lunar Thyme' not in PSEUDONYMS
    assert choose_pseudonym(set(PSEUDONYMS)) is None
    assert client.post('/auth/telegram/register', json={**a, 'pseudonym_token': first['token']}).status_code == 409


def test_no_client_identity_or_free_text(client, authentication):
    auth = authentication()
    reservation = reserve(client, auth)
    for key, value in [('legal_name', 'Synthetic'), ('telegram_user_id', 99), ('pseudonym', 'Chosen Name')]:
        assert client.post('/auth/telegram/register', json={**auth, 'pseudonym_token': reservation['token'], key: value}).status_code == 422


def test_authentication_required_and_bound_to_reservation(client, authentication, monkeypatch):
    auth = authentication()
    reservation = reserve(client, auth)
    other = authentication(22)
    assert client.post('/auth/telegram/register', json={**other, 'pseudonym_token': reservation['token']}).status_code == 409
    auth['telegram_data']['id'] = '22'
    assert client.post('/auth/telegram/pseudonym', json=auth).status_code == 401
    monkeypatch.setattr(settings, 'telegram_bot_token', None)
    assert client.post('/auth/telegram/pseudonym', json=other).status_code == 503


def test_expired_reservation_and_invitation(client, authentication):
    auth = authentication()
    reservation = reserve(client, auth)
    with SessionLocal() as session:
        session.get(PseudonymReservation, reservation['token']).expires_at = now()-timedelta(seconds=1)
        session.commit()
    assert client.post('/auth/telegram/register', json={**auth, 'pseudonym_token': reservation['token']}).status_code == 409
    with SessionLocal() as session:
        invitation = session.get(GroupInvitation, hashlib.sha256(auth['invitation_token'].encode()).hexdigest())
        invitation.expires_at = now()-timedelta(seconds=1)
        session.commit()
    assert client.post('/auth/telegram/pseudonym', json=auth).status_code == 403


def test_invitation_is_single_use_and_group_bound(client, authentication):
    a = authentication(11)
    b = authentication(22)
    b['invitation_token'] = a['invitation_token']
    first = reserve(client, a)
    second = reserve(client, b)
    registered = client.post('/auth/telegram/register', json={**a, 'pseudonym_token': first['token']})
    assert registered.status_code == 201
    assert client.post('/auth/telegram/register', json={**b, 'pseudonym_token': second['token']}).status_code == 403
    assert client.get('/admin/groups').status_code == 403
    groups = client.get('/admin/groups', headers={'X-Admin-Token': 'test-admin'}).json()
    students = [s for g in groups for s in g['students']]
    assert students == [{'id': registered.json()['public_id'], 'pseudonym': first['pseudonym']}]


def test_mini_app_and_timestamp_validation(client, authentication):
    auth = authentication()
    data = {'auth_date': str(int(time.time())), 'user': json.dumps({'id': 5555555555})}
    def sign():
        check = '\n'.join(f'{k}={data[k]}' for k in sorted(data))
        secret = hmac.new(b'WebAppData', b'synthetic-test-bot', hashlib.sha256).digest()
        return urlencode({**data, 'hash': hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()})
    payload = {'invitation_token': auth['invitation_token'], 'init_data': sign()}
    assert client.post('/auth/telegram/pseudonym', json=payload).status_code == 200
    assert client.post('/auth/telegram/pseudonym', json={**payload, 'init_data': payload['init_data']+'&user=bad'}).status_code == 401
    for date in [int(time.time())-301, int(time.time())+60]:
        data['auth_date'] = str(date)
        assert client.post('/auth/telegram/pseudonym', json={**payload, 'init_data': sign()}).status_code == 401
