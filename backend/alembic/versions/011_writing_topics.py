"""Offer four essay topics in the supplied Unit 7 tests."""
from pathlib import Path
import json
from alembic import op
import sqlalchemy as sa
revision='011_writing_topics'
down_revision='010_contextual_vocabulary'

def upgrade():
    connection=op.get_bind()
    tests=sa.table('revision_tests',sa.column('id'),sa.column('definition',sa.JSON))
    for identifier,level in [('53cc2eae-9888-469d-bc40-b9f648b58775','b2'),('a90c0f9c-a40c-40e4-95bb-c22c4bfb36a8','c1')]:
        definition=connection.execute(sa.select(tests.c.definition).where(tests.c.id==identifier)).scalar_one_or_none()
        if definition is None or definition.get('writing_topics'):continue
        template=json.loads((Path(__file__).resolve().parents[2]/'revision_materials'/('unit7-'+level+'.json')).read_text())
        if definition.get('writing_prompt')!=template['writing_prompt']:continue
        connection.execute(tests.update().where(tests.c.id==identifier).values(definition={**definition,'writing_topics':template['writing_topics']}))

def downgrade():
    pass
