from app.models import ImtIdiomCollection
from app.db import SessionLocal
from test_learning import admin

def create(client):
    key=admin(client)
    r=client.post('/learning/imt/collections',headers=key,json={'student_name':'Test Student','group':'215','coursebook':'Evolve 5','unit':'7'})
    assert r.status_code==200
    return key,r.json()

def test_private_collection_requires_approval_and_both_stages(client):
    key,created=create(client); token=created['token']; link=client.get('/imt/idiom?token='+token).json()
    assert link['status']=='draft' and link['entries']==[]
    entries=[{'expression':f'phrase {i}','meaning':'a meaning','example':f'An example for phrase {i}.','topic':'work'} for i in range(15)]
    submitted=client.put('/imt/idiom/collection?token='+token,json={'entries':entries});assert submitted.status_code==200
    assert client.post('/imt/idiom/start?token='+token).status_code==409
    approved=client.post('/learning/imt/collections/'+created['id']+'/review',headers=key,json={'status':'approved','comment':'Approved for pilot'});assert approved.status_code==200
    state=client.post('/imt/idiom/start?token='+token).json();assert state['attempt']['stage']=='retrieval'
    for _ in range(15):state=client.put('/imt/idiom/answer?token='+token,json={'response':'A relevant explanation and example.'}).json()
    assert state['attempt']['stage']=='context'
    for _ in range(15):state=client.put('/imt/idiom/answer?token='+token,json={'response':'This would fit a new realistic situation.'}).json()
    assert state['status']=='submitted';assert client.get('/imt/idiom?token='+token).json()['result']=={}
    graded=client.put('/learning/imt/collections/'+created['id']+'/grade',headers=key,json={'approved_grade':2,'reason':'Pilot teacher review','feedback':'Good recall; revise two examples.'})
    assert graded.status_code==200 and graded.json()['result']['approved_grade']==2

def test_materials_are_verified_only_when_present(client):
    key,created=create(client)
    assert created['material']['verified'] is True and 'fulfilment' in created['material']['vocabulary']
    future=client.post('/learning/imt/collections',headers=key,json={'student_name':'Future Student','group':'215','coursebook':'Evolve 5','unit':'8'}).json()
    assert future['material']['verified'] is False
