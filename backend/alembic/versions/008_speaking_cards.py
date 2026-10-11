"""Use expanded questions and explicit A/B role cards in untouched Unit 7 drafts."""
from pathlib import Path
import json
from alembic import op
import sqlalchemy as sa
revision='008_speaking_cards'
down_revision='007_public_revisions'

def upgrade():
    connection=op.get_bind()
    tests=sa.table('revision_tests',sa.column('id'),sa.column('definition',sa.JSON),sa.column('published',sa.Boolean))
    attempts=sa.table('revision_attempts',sa.column('test_id'))
    defaults=[('53cc2eae-9888-469d-bc40-b9f648b58775','b2','What makes an experience worthwhile? Give an example and explain your priorities.'),('a90c0f9c-a40c-40e4-95bb-c22c4bfb36a8','c1','Would you want to take a DNA ancestry test? Explain the possible benefits and concerns.')]
    for identifier,level,previous in defaults:
        row=connection.execute(sa.select(tests.c.definition,tests.c.published).where(tests.c.id==identifier)).first()
        if row is None or row.published:continue
        count=connection.execute(sa.select(sa.func.count()).select_from(attempts).where(attempts.c.test_id==identifier)).scalar()
        definition=row.definition
        if count or (definition.get('oral_individual') or [None])[0]!=previous:continue
        template=json.loads((Path(__file__).resolve().parents[2]/'revision_materials'/('unit7-'+level+'.json')).read_text())
        definition={**definition,'oral_individual':template['oral_individual'],'oral_dialogue':template['oral_dialogue']}
        connection.execute(tests.update().where(tests.c.id==identifier).values(definition=definition))

def downgrade():
    # Assessment content is user data; keep teacher edits and original attempt snapshots.
    pass
