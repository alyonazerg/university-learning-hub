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


@pytest.mark.parametrize('level',['b2','c1'])
def test_contextual_tasks_preserve_question_edits_and_started_attempts(level,monkeypatch):
    folder=Path(__file__).parents[1]
    spec=importlib.util.spec_from_file_location('context_migration',folder/'alembic/versions/010_contextual_vocabulary.py')
    migration=importlib.util.module_from_spec(spec);spec.loader.exec_module(migration)
    identifier='53cc2eae-9888-469d-bc40-b9f648b58775' if level=='b2' else 'a90c0f9c-a40c-40e4-95bb-c22c4bfb36a8'
    template=json.loads((folder/'revision_materials'/f'unit7-{level}.json').read_text())
    previous=json.loads(json.dumps(template))
    for item in previous['items']:
        if item['id'] in migration.OLD[level]:item.update(migration.OLD[level][item['id']])
    previous['items'][0]['prompt']='Teacher-edited context.'
    previous['items'][1]['answers']=['Teacher-added answer']
    with SessionLocal() as session:
        session.add(RevisionTest(id=identifier,definition=previous,published=True));session.commit()
        attempt=RevisionAttempt(test_id=identifier,snapshot=previous,research_consent=True,consent_version='synthetic',token_hash='synthetic',student_id='synthetic',student_name='Synthetic Learner',group_code='213' if level=='c1' else '215',condition='experimental',answers={'v1':'Saved answer'},writing='Saved essay')
        session.add(attempt);session.commit();attempt_id=attempt.id
    with engine.begin() as connection:
        monkeypatch.setattr(migration.op,'get_bind',lambda:connection);migration.upgrade();migration.upgrade()
    with SessionLocal() as session:
        updated=session.get(RevisionTest,identifier)
        assert updated.published and len(updated.definition['items'])==len(template['items'])
        assert updated.definition['items'][0]['prompt']=='Teacher-edited context.'
        assert updated.definition['items'][1]['answers']==['Teacher-added answer']
        assert updated.definition['items'][2]==template['items'][2]
        assert session.get(RevisionAttempt,attempt_id).snapshot==previous

@pytest.mark.parametrize('level',['b2','c1'])
def test_repair_copied_previews_only_before_begin(level,monkeypatch):
    from datetime import datetime
    folder=Path(__file__).parents[1]
    def module(name):
        spec=importlib.util.spec_from_file_location(name,folder/'alembic/versions'/name)
        result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result
    old=module('009_reading_previews.py');repair=module('013_repair_reading_previews.py')
    current=json.loads((folder/'revision_materials'/f'unit7-{level}.json').read_text())
    previous={**current,'priming':old.OLD[level]}
    with SessionLocal() as session:
        session.add(RevisionTest(id='copied',definition=previous,published=True))
        rows=[]
        for begun in [None,datetime.utcnow()]:
            row=RevisionAttempt(test_id='copied',snapshot=previous,research_consent=True,consent_version='synthetic',token_hash='synthetic',student_id='synthetic',student_name='Synthetic Learner',group_code='213' if level=='c1' else '215',condition='experimental',begun_at=begun)
            session.add(row);rows.append(row)
        session.commit();ids=[row.id for row in rows]
    with engine.begin() as connection:
        monkeypatch.setattr(repair.op,'get_bind',lambda:connection);repair.upgrade();repair.upgrade()
    with SessionLocal() as session:
        assert session.get(RevisionTest,'copied').definition==current
        assert session.get(RevisionAttempt,ids[0]).snapshot==current
        assert session.get(RevisionAttempt,ids[1]).snapshot==previous
