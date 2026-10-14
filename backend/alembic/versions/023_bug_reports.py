from alembic import op
import sqlalchemy as sa
revision='023_bug_reports'
down_revision='022_browser_accounts'
branch_labels=None
depends_on=None
def upgrade():
    op.create_table('bug_reports',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('title',sa.String(160),nullable=False),sa.Column('description',sa.Text(),nullable=False),sa.Column('steps',sa.Text(),nullable=False),sa.Column('expected',sa.Text(),nullable=False),sa.Column('page',sa.String(500),nullable=False),sa.Column('environment',sa.JSON(),nullable=False),sa.Column('status',sa.String(24),nullable=False),sa.Column('priority',sa.String(16),nullable=False),sa.Column('assignee',sa.String(100),nullable=False),sa.Column('reporter',sa.String(100),nullable=False),sa.Column('receipt_hash',sa.String(64),nullable=False,unique=True),sa.Column('submitter_hash',sa.String(64),nullable=False),sa.Column('screenshot',sa.LargeBinary(),nullable=True),sa.Column('screenshot_mime',sa.String(30),nullable=False),sa.Column('history',sa.JSON(),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False),sa.Column('updated_at',sa.DateTime(),nullable=False))
    op.create_index('ix_bug_reports_submitter_hash','bug_reports',['submitter_hash'])
def downgrade():op.drop_table('bug_reports')
