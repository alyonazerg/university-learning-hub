from uuid import uuid4
from app.db import SessionLocal
from app.models import Student, Group, StudentProfile, ImtIdiomCollection, StudentXpEvent
from app.learning import issue_session
from test_messages import students
from test_learning import admin

def body(**changes):
    return dict(bio='Moon gazer and book lover.', avatar_seed=873, avatar_theme='starfox', share_profile=False, share_rating=False, **changes)

def test_private_default_group_scope_and_opt_out(client):
    first, second, first_id, second_id = students()
    assert client.get('/learning/profile').status_code == 401
    assert client.get('/learning/profile', headers=admin(client)).status_code == 403
    assert not client.get('/learning/profile', headers=first).json()['share_profile']
    assert client.get('/learning/profile/group', headers=second).json()['profiles'] == []
    data = body(); data.update(share_profile=True, share_rating=True)
    assert client.put('/learning/profile', headers=first, json=data).status_code == 200
    shared = client.get('/learning/profile/group', headers=second).json()
    assert len(shared['profiles']) == 1 and shared['leaderboard'][0]['xp'] == 0
    assert set(shared['profiles'][0]) == {'alias','bio','avatar_seed','avatar_theme','xp','achievements'}
    with SessionLocal() as session:
        group = Group(name='Another constellation');session.add(group);session.flush()
        outsider = Student(pseudonym='Outside Fern', group_id=group.id);session.add(outsider);session.flush()
        session.add(StudentProfile(student_id=outsider.id, bio='Outside', share_profile=True, share_rating=True));session.commit()
    assert len(client.get('/learning/profile/group', headers=second).json()['profiles']) == 1
    data['share_profile']=False
    saved=client.put('/learning/profile', headers=first, json=data).json()
    assert not saved['share_rating']
    assert client.get('/learning/profile/group', headers=second).json()['profiles'] == []

def test_bio_validation_and_only_safe_avatar_parameters(client):
    first, _, _, _ = students()
    for bio in ['Привет', 'Contact me @test', 'https://example.test', '+7 (123) 456-78-90']:
        data=body();data['bio']=bio
        assert client.put('/learning/profile', headers=first, json=data).status_code == 422
    data=body();data['avatar_theme']='<svg onload=alert(1)>'
    assert client.put('/learning/profile', headers=first, json=data).status_code == 422
    data=body();data['bio']='I love books ✨'
    assert client.put('/learning/profile', headers=first, json=data).json()['bio']==data['bio']

def test_xp_milestones_are_verified_and_cannot_be_farmed(client):
    first, _, first_id, _ = students()
    with SessionLocal() as session:
        student=session.query(Student).filter_by(public_id=first_id).one()
        collection=ImtIdiomCollection(student_id=student.id,student_name='Synthetic alias',token_hash=uuid4().hex,status='submitted',entries=[{'expression':'Learn the ropes'}],attempt={'recall_count':1,'index':2,'questions':[{},{}],'responses':{'0':{'correct':True},'1':{'correct':False}}})
        session.add(collection);session.commit();identifier=collection.id
    for _ in range(3):
        result=client.get('/learning/profile',headers=first).json()
        assert result['xp']==60 and len(result['achievements'])==3
    with SessionLocal() as session:
        row=session.get(ImtIdiomCollection,identifier);row.status='draft';row.attempt={};session.commit()
        assert session.query(StudentXpEvent).count()==3
    # Earned achievements survive resets; academic grades are never used for XP.
    assert client.get('/learning/profile',headers=first).json()['xp']==60

def test_profile_migration_preserves_existing_messages_and_runs_round_trip():
    import importlib.util
    from pathlib import Path
    import sqlalchemy as sa
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path=Path(__file__).parents[1]/'alembic/versions/027_student_profiles.py'
    spec=importlib.util.spec_from_file_location('profile_migration',path)
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    engine=sa.create_engine('sqlite://')
    with engine.begin() as connection:
        connection.execute(sa.text('CREATE TABLE students (id INTEGER PRIMARY KEY)'))
        connection.execute(sa.text('CREATE TABLE campus_messages (id INTEGER PRIMARY KEY, body TEXT)'))
        connection.execute(sa.text("INSERT INTO campus_messages VALUES (1, 'Synthetic saved message')"))
        migration.op=Operations(MigrationContext.configure(connection))
        migration.upgrade()
        assert connection.execute(sa.text('SELECT body,telegram_error FROM campus_messages')).one()==('Synthetic saved message','')
        migration.downgrade();migration.upgrade()
        assert connection.execute(sa.text('SELECT body FROM campus_messages')).scalar()=='Synthetic saved message'
    engine.dispose()
