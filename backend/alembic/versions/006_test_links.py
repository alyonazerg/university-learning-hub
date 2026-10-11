"""Optional hosted-test links on lesson plans."""
from alembic import op
import sqlalchemy as sa
revision='006_test_links'
down_revision='005_lesson_planning'

def upgrade():
    op.add_column('lesson_plans',sa.Column('test_url',sa.String(2048),nullable=False,server_default=''))

def downgrade():
    op.drop_column('lesson_plans','test_url')
