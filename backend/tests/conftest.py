import hashlib
import hmac
import os
import tempfile
import time

import pytest

# Never point tests at development or production records, even if DATABASE_URL is injected.
_test_directory = tempfile.TemporaryDirectory(prefix='ulh-pytest-')
os.environ['DATABASE_URL'] = f'sqlite:///{_test_directory.name}/tests.db'
from app.main import app, settings
from app.db import Base, engine
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def isolated_database(monkeypatch):
    monkeypatch.setattr(settings, 'admin_token', 'test-admin')
    monkeypatch.setattr(settings, 'telegram_bot_token', 'synthetic-test-bot')
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def client():
    with TestClient(app) as client:
        yield client


@pytest.fixture
def authentication(client):
    group = client.post('/groups', json={'name': 'Synthetic group'}, headers={'X-Admin-Token': 'test-admin'}).json()
    def make(user_id=11):
        invitation = client.post(f"/admin/groups/{group['id']}/invitations", headers={'X-Admin-Token': 'test-admin'}).json()['invitation_token']
        data = {'id': str(user_id), 'auth_date': str(int(time.time()))}
        check = '\n'.join(f'{key}={data[key]}' for key in sorted(data))
        data['hash'] = hmac.new(hashlib.sha256(b'synthetic-test-bot').digest(), check.encode(), hashlib.sha256).hexdigest()
        return {'telegram_data': data, 'invitation_token': invitation}
    return make
