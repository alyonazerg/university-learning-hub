"""Use whole essay and speaking totals without rewriting criterion evidence."""
from alembic import op
import sqlalchemy as sa
revision='016_whole_marks'
down_revision='015_familiar_options_full_grammar'
branch_labels=None
depends_on=None

def upgrade():
    connection=op.get_bind()
    table=sa.table('revision_attempts',sa.column('id',sa.String),sa.column('report',sa.JSON),sa.column('oral',sa.JSON))
    for row in connection.execute(sa.select(table)).mappings():
        report=dict(row['report'] or {});oral=dict(row['oral'] or {})
        for key in ['writing_score','writing_score_provisional']:
            if report.get(key) is not None:report[key]=int(float(report[key])+0.5)
        if report.get('writing_score') is not None and report.get('controlled_score') is not None:
            report['total_score']=round(report['controlled_score']+report['writing_score'],2)
        if oral.get('score') is not None:oral['score']=int(float(oral['score'])+0.5)
        connection.execute(table.update().where(table.c.id==row['id']).values(report=report,oral=oral))

def downgrade():
    pass  # Original fractional totals cannot be recovered reliably.
