from app.db import SessionLocal
from app.models import Student,Group,ImtIdiomCollection
from test_learning import admin

def test_completed_practice_shows_results_without_final_grade(client):
    headers=admin(client)
    with SessionLocal() as session:
        group=Group(name='215 · Evolve 5',course_id='speech');session.add(group);session.flush()
        student=Student(pseudonym='Result Test',group_id=group.id);session.add(student);session.flush()
        row=ImtIdiomCollection(student_id=student.id,student_name=student.pseudonym,token_hash='result-test',status='submitted',entries=[{'expression':'Learn the ropes'}],result={},attempt={'version':'adaptive_mcq_1','questions':[{'stage':'recall','entry_index':0,'type':'multiple_choice','prompt':'Situation'},{'stage':'reuse','entry_index':0,'prompt':'Comment'}],'responses':{'0':{'response':'Learn the ropes','correct':True},'1':{'response':'A contextual comment.','correct':True}}})
        session.add(row);session.commit()
    response=client.get('/learning/imt/collections',headers=headers);assert response.status_code==200
    row=response.json()[0]
    assert row['practice_complete'] and row['group']=='215 · Evolve 5'
    assert row['result']['practice_report']['recall_successful']==1
    assert row['result']['practice_report']['reuse_successful']==1
    assert 'approved_grade' not in row['result']
