from test_learning import admin

def submit(client,**kwargs):
    data={'title':'Broken IMT button','description':'The continue button does not respond.','page':'https://mooncampus.ru/student-account.html?secret=bad#invite=private','environment':'{"browser":"test","viewport":"390 × 844"}'}
    data.update(kwargs)
    return client.post('/learning/bugs',data=data)

def test_guest_submission_private_queue_and_receipt(client):
    response=submit(client);assert response.status_code==201
    ticket=response.json();assert ticket['key']=='MC-0001'
    assert client.get('/learning/bugs').status_code==401
    receipt=client.get('/learning/bugs/receipt/'+ticket['receipt']).json();assert receipt['status']=='new' and 'description' not in receipt
    headers=admin(client);row=client.get('/learning/bugs',headers=headers).json()[0]
    assert row['page']=='/student-account.html'
    updated=client.put('/learning/bugs/'+str(row['id']),headers=headers,json={'status':'in_progress','priority':'high','assignee':'Teacher','comment':'Reproduced on mobile.'})
    assert updated.status_code==200 and updated.json()['history'][-1]['comment']=='Reproduced on mobile.'
    assert client.get('/learning/bugs/receipt/'+ticket['receipt']).json()['status']=='in_progress'

def test_attachment_validation_and_access(client):
    bad=client.post('/learning/bugs',data={'title':'Test image','description':'Screenshot attachment'},files={'screenshot':('image.svg',b'<svg/>','image/svg+xml')});assert bad.status_code==422
    response=client.post('/learning/bugs',data={'title':'Test image','description':'Screenshot attachment'},files={'screenshot':('image.png',b'\x89PNG\r\n\x1a\nimage','image/png')});assert response.status_code==201
    identifier=response.json()['id']
    assert client.get(f'/learning/bugs/{identifier}/screenshot').status_code==401
    assert client.get(f'/learning/bugs/{identifier}/screenshot',headers=admin(client)).headers['content-type']=='image/png'
