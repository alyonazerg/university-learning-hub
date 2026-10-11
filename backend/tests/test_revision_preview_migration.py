import importlib.util
import json
from pathlib import Path

import pytest
from app.db import SessionLocal,engine
from app.models import RevisionTest,RevisionAttempt


@pytest.mark.parametrize('level',['b2','c1'])
def test_preview_migration_updates_defaults_and_preserves_teacher_edits_and_attempts(level,monkeypatch):
    folder=Path(__file__).parents[1]
    spec=importlib.util.spec_from_file_location('preview_migration',folder/'alembic/versions/009_reading_previews.py')
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    identifiers={'b2':'53cc2eae-9888-469d-bc40-b9f648b58775','c1':'a90c0f9c-a40c-40e4-95bb-c22c4bfb36a8'}
    definitions={l:json.loads((folder/'revision_materials'/f'unit7-{l}.json').read_text()) for l in identifiers}
    previous={**definitions[level],'priming':migration.OLD[level]}
    other='c1' if level=='b2' else 'b2';edited={**definitions[other],'priming':['Teacher-written story.']*4}
    with SessionLocal() as session:
        session.add_all([RevisionTest(id=identifiers[level],definition=previous,published=True),RevisionTest(id=identifiers[other],definition=edited,published=False),RevisionTest(id='custom',definition=previous,published=True)])
        session.commit()
        attempt=RevisionAttempt(test_id=identifiers[level],snapshot=previous,research_consent=True,consent_version='synthetic',token_hash='synthetic',student_id='synthetic',student_name='Synthetic Learner',group_code='213' if level=='c1' else '215',condition='experimental',answers={'v1':'Saved answer'},writing='Saved essay')
        session.add(attempt);session.commit();attempt_id=attempt.id
    with engine.begin() as connection:
        monkeypatch.setattr(migration.op,'get_bind',lambda:connection)
        migration.upgrade();migration.upgrade()
    with SessionLocal() as session:
        updated=session.get(RevisionTest,identifiers[level])
        assert updated.published is True
        assert updated.definition==definitions[level]
        assert session.get(RevisionTest,identifiers[other]).definition==edited
        assert session.get(RevisionTest,'custom').definition==previous
        attempt=session.get(RevisionAttempt,attempt_id)
        assert attempt.snapshot==previous and attempt.answers=={'v1':'Saved answer'} and attempt.writing=='Saved essay'
