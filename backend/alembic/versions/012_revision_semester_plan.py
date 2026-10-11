"""Label default Unit 7 tests as RT1 without changing existing attempts."""
from alembic import op
import sqlalchemy as sa
revision='012_revision_semester_plan'
down_revision='011_writing_topics'
branch_labels=None
depends_on=None

def upgrade():
    table=sa.table('revision_tests',sa.column('id',sa.String),sa.column('definition',sa.JSON))
    connection=op.get_bind()
    for identifier,book in [('53cc2eae-9888-469d-bc40-b9f648b58775','Evolve 5'),('a90c0f9c-a40c-40e4-95bb-c22c4bfb36a8','Evolve 6')]:
        row=connection.execute(sa.select(table.c.definition).where(table.c.id==identifier)).first()
        if not row:continue
        definition=dict(row.definition)
        if definition.get('title') in [f'{book} · Unit 7 · Revision Test',f'{book} · RT1 · Unit 7']:
            definition.update(title=f'{book} · RT1 · Unit 7',semester_stage='RT1')
            connection.execute(table.update().where(table.c.id==identifier).values(definition=definition))

def downgrade():
    pass
