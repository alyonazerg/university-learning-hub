from uuid import uuid4
from app.db import SessionLocal
from app.learning import issue_session
from app.models import Group, Student, CardEditor, ImtIdiomCollection
from test_messages import students
from test_learning import admin

def test_group_details_can_be_changed_only_by_teacher(client):
    first,_,first_id,_=students();teacher=admin(client)
    group=client.get('/learning/groups',headers=teacher).json()[0];gid=group['id']
    path=f'/learning/groups/{gid}'
    assert client.put(path,headers=first,json={'name':'Updated group','course_id':'grammar'}).status_code==403
    assert client.put(path,headers=teacher,json={'name':'Updated group','course_id':'grammar'}).status_code==200
    updated=client.get('/learning/groups',headers=teacher).json()[0]
    assert updated['name']=='Updated group' and updated['course_id']=='grammar'
    assert updated['students']==group['students']
    assert client.put(path,headers=teacher,json={'name':'','course_id':'speech'}).status_code==422
    assert client.put(path,headers=teacher,json={'name':'X','course_id':'unknown'}).status_code==422
    other=client.post('/learning/groups',headers=teacher,json={'name':'Other group','course_id':'speech'}).json()
    assert client.put(path,headers=teacher,json={'name':other['name'],'course_id':'speech'}).status_code==409
    assert client.get('/learning/groups',headers=teacher).json()[0]['name']=='Updated group'

def test_move_pause_restore_preserves_work_and_revokes_old_sessions_and_editor(client):
    first,second,first_id,_=students();teacher=admin(client)
    with SessionLocal() as session:
        student=session.query(Student).filter_by(public_id=first_id).one();source=student.group_id;sid=student.id
        target=Group(name='Destination',course_id='grammar');session.add(target);session.flush();destination=target.id
        session.add(CardEditor(group_id=source,student_id=sid))
        work=ImtIdiomCollection(student_id=sid,student_name='Synthetic alias',token_hash=uuid4().hex,result={'approved_grade':3},status='submitted',entries=[{'expression':'Learn the ropes'}]);session.add(work);session.commit();work_id=work.id
    path=f'/learning/groups/{source}/students/{first_id}'
    change={'group_id':destination,'is_active':True}
    assert client.put(path,headers=second,json=change).status_code==403
    assert client.put(path,headers=teacher,json=change).status_code==200
    assert client.get('/learning/me',headers=first).status_code==401
    assert client.put(path,headers=teacher,json=change).status_code==409
    with SessionLocal() as session:
        assert session.get(Student,sid).group_id==destination
        assert session.get(CardEditor,source) is None
        assert session.get(ImtIdiomCollection,work_id).result['approved_grade']==3
        token=issue_session('student',sid,session)['access_token']
    path=f'/learning/groups/{destination}/students/{first_id}'
    assert client.put(path,headers=teacher,json={**change,'is_active':False}).status_code==200
    assert client.get('/learning/me',headers={'Authorization':'Bearer '+token}).status_code==401
    groups=client.get('/learning/groups',headers=teacher).json();group=next(g for g in groups if g['id']==destination)
    assert not group['students'] and group['inactive_students'][0]['id']==first_id
    assert client.put(path,headers=teacher,json=change).status_code==200
    with SessionLocal() as session:
        token=issue_session('student',sid,session)['access_token']
        assert session.get(ImtIdiomCollection,work_id).result['approved_grade']==3
    assert client.get('/learning/me',headers={'Authorization':'Bearer '+token}).json()['group_id']==destination
