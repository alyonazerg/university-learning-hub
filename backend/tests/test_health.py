from fastapi.testclient import TestClient
from app.main import app


def test_health():
    response = TestClient(app).get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'
    assert response.json()['version'] == '0.1.0'


def test_browser_can_preflight_delete_but_unknown_origins_cannot():
    client=TestClient(app)
    headers={'Origin':'https://mooncampus.ru','Access-Control-Request-Method':'DELETE','Access-Control-Request-Headers':'authorization'}
    response=client.options('/learning/revisions/attempts/synthetic',headers=headers)
    assert response.status_code==200
    assert response.headers['access-control-allow-origin']=='https://mooncampus.ru'
    assert 'DELETE' in response.headers['access-control-allow-methods']
    assert client.delete('/learning/revisions/attempts/synthetic').status_code==401
    assert client.options('/learning/revisions/attempts/synthetic',headers={**headers,'Origin':'https://untrusted.invalid'}).status_code==400
