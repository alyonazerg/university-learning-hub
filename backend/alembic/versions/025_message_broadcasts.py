from alembic import op
import sqlalchemy as sa
revision='025_message_broadcasts'
down_revision='024_campus_messages'
branch_labels=None
depends_on=None
def upgrade():
    op.add_column('campus_messages',sa.Column('group_name',sa.String(120),nullable=False,server_default=''))
    op.create_table('message_broadcasts',sa.Column('id',sa.String(36),primary_key=True),sa.Column('body',sa.Text(),nullable=False),sa.Column('groups',sa.JSON(),nullable=False),sa.Column('recipients',sa.JSON(),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False))
def downgrade():
    op.drop_table('message_broadcasts')
    op.drop_column('campus_messages','group_name')
