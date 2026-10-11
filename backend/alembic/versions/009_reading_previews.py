"""Replace disconnected default warm-ups with coherent Unit 7 reading previews."""
from pathlib import Path
import json
from alembic import op
import sqlalchemy as sa
revision='009_reading_previews'
down_revision='008_speaking_cards'
OLD={'c1': ['An ancestor may leave a relic that connects us to our heritage.', 'Genealogy helps us explore ancestry without reducing identity to ethnicity.', 'A feast can reinvigorate a tradition, and its significance may become a beacon for younger generations.', 'Adoptive families also build shared traditions, even when disagreements cause friction.'], 'b2': ['Finding fulfilment at work can feel like discovering a calling.', 'An entrepreneurial person may enjoy shadowing a business owner before launching a company.', 'An impulsive purchase is often encouraged by scarcity, while an unobtrusive nudge can influence a choice.', 'Our aspirations need a sensible yardstick, especially when a decision becomes a conundrum.']}

def upgrade():
    connection=op.get_bind()
    tests=sa.table('revision_tests',sa.column('id'),sa.column('definition',sa.JSON))
    for identifier,level in [('53cc2eae-9888-469d-bc40-b9f648b58775','b2'),('a90c0f9c-a40c-40e4-95bb-c22c4bfb36a8','c1')]:
        definition=connection.execute(sa.select(tests.c.definition).where(tests.c.id==identifier)).scalar_one_or_none()
        if definition is None or definition.get('priming')!=OLD[level]:continue
        template=json.loads((Path(__file__).resolve().parents[2]/'revision_materials'/('unit7-'+level+'.json')).read_text())
        connection.execute(tests.update().where(tests.c.id==identifier).values(definition={**definition,'priming':template['priming']}))

def downgrade():
    # Preview content is teacher data; don't undo edits or alter assessment snapshots.
    pass
