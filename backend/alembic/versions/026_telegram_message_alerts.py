from alembic import op
import sqlalchemy as sa
revision='026_telegram_message_alerts'
down_revision='025_message_broadcasts'
branch_labels=None
depends_on=None
def upgrade():
    op.add_column('students',sa.Column('telegram_messages_enabled',sa.Boolean(),nullable=False,server_default=sa.false()))
    op.add_column('campus_messages',sa.Column('telegram_status',sa.String(16),nullable=False,server_default='pending'))
    op.create_table('teacher_telegram_alerts',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('chat_id',sa.BigInteger(),nullable=False),sa.Column('enabled',sa.Boolean(),nullable=False))
def downgrade():
    op.drop_table('teacher_telegram_alerts');op.drop_column('students','telegram_messages_enabled');op.drop_column('campus_messages','telegram_status')
