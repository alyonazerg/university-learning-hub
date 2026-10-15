"""Run actual Alembic migrations against an isolated legacy SQLite database."""
import os
from pathlib import Path
import subprocess
import sys
from sqlalchemy import create_engine, inspect, text,MetaData,Table
from datetime import datetime


def test_learning_migration_preserves_legacy_records_and_roundtrips(tmp_path):
    directory = Path(__file__).resolve().parents[1]
    url = 'sqlite:///' + str(tmp_path / 'migration.db')
    env = {**os.environ, 'DATABASE_URL':url}
    def migrate(target, direction='upgrade'):
        result = subprocess.run([sys.executable,'-m','alembic',direction,target],cwd=directory,env=env,capture_output=True,text=True)
        assert result.returncode == 0,result.stderr
    migrate('002_registration')
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO groups (id,name,is_active) VALUES (1,'Synthetic legacy group',1)"))
        connection.execute(text("INSERT INTO students (id,public_id,telegram_user_id,pseudonym,group_id,is_active) VALUES (1,'00000000-0000-0000-0000-000000000001',11,'Legacy Fern',1,1)"))
    migrate('027_student_profiles')
    with engine.begin() as connection:
        metadata=MetaData()
        task=Table('homework_tasks',metadata,autoload_with=connection)
        work=Table('homework_submissions',metadata,autoload_with=connection)
        feedback=Table('homework_feedback',metadata,autoload_with=connection)
        connection.execute(task.insert().values(id='legacy-task',title='Legacy homework',description='Original instructions',course_id='speech',kind='regular',starts_at=datetime(2026,1,1),ends_at=datetime(2027,1,1),vocabulary=[],constructions=[],criteria='',created_at=datetime(2026,1,1)))
        connection.execute(work.insert().values(id='legacy-work',task_id='legacy-task',student_id=1,attempt=1,kind='text',content='Original saved answer',photos=[],request_id='legacy-request',created_at=datetime(2026,1,1),late=False))
        connection.execute(feedback.insert().values(submission_id='legacy-work',comment='Original teacher feedback',updated_at=datetime(2026,1,1)))
    migrate('head')
    with engine.connect() as connection:
        assert connection.execute(text('SELECT course_id FROM groups')).scalar_one() == 'speech'
        assert connection.execute(text('SELECT pseudonym FROM students')).scalar_one() == 'Legacy Fern'
        assert connection.execute(text('SELECT content,review_version FROM homework_submissions')).one()==('Original saved answer',0)
        assert connection.execute(text('SELECT comment FROM homework_feedback')).scalar_one()=='Original teacher feedback'
    tables = inspect(engine).get_table_names()
    assert 'lesson_plans' in tables
    assert {'learning_sessions','card_editors','vocabulary_decks','vocabulary_cards','card_progress','review_events'} <= set(tables)
    assert {'homework_tasks', 'homework_groups', 'compensation_access', 'homework_submissions',
            'homework_feedback', 'attendance_lessons', 'attendance_marks'} <= set(tables)
    migrate('002_registration', 'downgrade')
    assert 'vocabulary_decks' not in inspect(engine).get_table_names()
    with engine.connect() as connection:
        assert connection.execute(text('SELECT pseudonym FROM students')).scalar_one() == 'Legacy Fern'
    migrate('head')
    engine.dispose()
