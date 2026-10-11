import hashlib
from test_learning import admin, student
from app.db import SessionLocal
from app.models import GroupInvitation


def test_session_invitation_registers_once_and_is_admin_only(client, authentication):
    teacher = admin(client)
    learner, profile, _ = student(client, authentication)
    path = f"/learning/groups/{profile['group_id']}/invitations"
    assert client.post(path).status_code == 401
    assert client.post(path, headers=learner).status_code == 403
    response = client.post(path, headers=teacher)
    assert response.status_code == 201
    assert response.headers['cache-control'] == 'no-store'
    token = response.json()['invitation_token']
    with SessionLocal() as db:
        assert db.get(GroupInvitation, hashlib.sha256(token.encode()).hexdigest())
        assert not db.get(GroupInvitation, token)
    auth = {**authentication(99), 'invitation_token': token}
    reservation = client.post('/auth/telegram/pseudonym', json=auth).json()
    registered = client.post('/auth/telegram/register', json={**auth, 'pseudonym_token': reservation['token']})
    assert registered.status_code == 201
    assert registered.json()['group_id'] == profile['group_id']
    assert client.post('/auth/telegram/pseudonym', json={**authentication(100), 'invitation_token': token}).status_code == 403
    assert client.post('/learning/groups/9999/invitations', headers=teacher).status_code == 404
