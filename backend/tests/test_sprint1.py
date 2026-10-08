import os
os.environ["ADMIN_TOKEN"] = "test-admin"
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
def test_registration_and_private_registry():
    r = client.post('/auth/telegram/register', json={'telegram_user_id': 11, 'pseudonym': 'LunarFox', 'legal_name': 'Test Student'})
    assert r.status_code == 201 and r.json()['pseudonym'] == 'LunarFox'
    assert client.get('/admin/identity-registry').status_code == 403
    registry = client.get('/admin/identity-registry', headers={'X-Admin-Token': 'test-admin'})
    assert registry.status_code == 200 and registry.json()[0]['legal_name'] == 'Test Student'
def test_duplicate_pseudonym_rejected():
    r = client.post('/auth/telegram/register', json={'telegram_user_id': 12, 'pseudonym': 'LunarFox', 'legal_name': 'Other'})
    assert r.status_code == 409
