"""Replace preposition recognition with contextual idiom meaning."""
import json
from pathlib import Path
from alembic import op
import sqlalchemy as sa
revision='017_chord_meaning'
down_revision='016_whole_marks'
branch_labels=None
depends_on=None
OLD={'id': 'c1', 'section': 'collocation', 'prompt': 'Which expression is natural in English?', 'answers': ['struck a chord with'], 'choices': ['struck a chord on', 'struck a chord at', 'struck a chord with', 'struck a chord for', 'struck a chord to'], 'target_word': 'chord', 'target_variants': [], 'groups': []}

def upgrade():
    connection=op.get_bind();current=next(item for item in json.loads((Path(__file__).resolve().parents[2]/'revision_materials/unit7-c1.json').read_text())['items'] if item['id']=='c1')
    for name,column in [('revision_tests','definition'),('revision_attempts','snapshot')]:
        table=sa.table(name,sa.column('id'),sa.column(column,sa.JSON),sa.column('begun_at',sa.DateTime),sa.column('submitted_at',sa.DateTime))
        query=sa.select(table.c.id,table.c[column])
        if name=='revision_attempts':query=query.where(table.c.begun_at.is_(None),table.c.submitted_at.is_(None))
        for identifier,spec in connection.execute(query).all():
            if spec.get('level')!='C1':continue
            changed=False;items=[]
            for item in spec.get('items',[]):
                if item.get('id')=='c1' and all(item.get(key)==OLD.get(key) for key in ['prompt','answers','choices','groups']):item=current;changed=True
                items.append(item)
            if changed:connection.execute(table.update().where(table.c.id==identifier).values({column:{**spec,'items':items}}))
def downgrade():
    pass
