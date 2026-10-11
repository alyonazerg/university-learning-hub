"""Repair copied default previews and attempts not yet begun."""
from pathlib import Path
import importlib.util,json
from alembic import op
import sqlalchemy as sa
revision='013_repair_reading_previews'
down_revision='012_revision_semester_plan'
branch_labels=None
depends_on=None

def upgrade():
    folder=Path(__file__).resolve().parent
    spec=importlib.util.spec_from_file_location('old_preview',folder/'009_reading_previews.py')
    previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
    replacements={level:json.loads((folder.parents[1]/'revision_materials'/f'unit7-{level}.json').read_text())['priming'] for level in ['b2','c1']}
    connection=op.get_bind()
    for name,column in [('revision_tests','definition'),('revision_attempts','snapshot')]:
        table=sa.table(name,sa.column('id'),sa.column(column,sa.JSON),sa.column('begun_at',sa.DateTime),sa.column('submitted_at',sa.DateTime))
        query=sa.select(table.c.id,table.c[column])
        if name=='revision_attempts':query=query.where(table.c.begun_at.is_(None),table.c.submitted_at.is_(None))
        for identifier,definition in connection.execute(query).all():
            level=str(definition.get('level','')).lower()
            if level in previous.OLD and definition.get('priming')==previous.OLD[level]:
                connection.execute(table.update().where(table.c.id==identifier).values({column:{**definition,'priming':replacements[level]}}))

def downgrade():
    pass
