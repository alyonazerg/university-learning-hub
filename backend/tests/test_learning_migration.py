"""Run actual Alembic migrations against an isolated legacy SQLite database."""
import os
from pathlib import Path
import subprocess
import sys
from sqlalchemy import create_engine, inspect, text


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
    migrate('head')
    with engine.connect() as connection:
        assert connection.execute(text('SELECT course_id FROM groups')).scalar_one() == 'speech'
        assert connection.execute(text('SELECT pseudonym FROM students')).scalar_one() == 'Legacy Fern'
    tables = inspect(engine).get_table_names()
    assert {'learning_sessions','card_editors','vocabulary_decks','vocabulary_cards','card_progress','review_events'} <= set(tables)
    assert {'homework_tasks', 'homework_groups', 'compensation_access', 'homework_submissions',
            'homework_feedback', 'attendance_lessons', 'attendance_marks'} <= set(tables)
    migrate('002_registration', 'downgrade')
    assert 'vocabulary_decks' not in inspect(engine).get_table_names()
    with engine.connect() as connection:
        assert connection.execute(text('SELECT pseudonym FROM students')).scalar_one() == 'Legacy Fern'
    migrate('head')
    engine.dispose()
