"""Private-by-default profiles, milestone XP and Telegram diagnostics."""
from alembic import op
import sqlalchemy as sa
revision = '027_student_profiles'
down_revision = '026_telegram_message_alerts'
branch_labels = depends_on = None

def upgrade():
    op.create_table('student_profiles',
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), primary_key=True),
        sa.Column('bio', sa.String(160), nullable=False, server_default=''),
        sa.Column('avatar_seed', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('avatar_theme', sa.String(20), nullable=False, server_default='mooncat'),
        sa.Column('share_profile', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('share_rating', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table('student_xp_events',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('students.id'), nullable=False, index=True),
        sa.Column('milestone', sa.String(30), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False),
        sa.Column('policy_version', sa.String(20), nullable=False),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('student_id', 'milestone', name='uq_student_milestone'))
    op.add_column('campus_messages', sa.Column('telegram_error', sa.String(200), nullable=False, server_default=''))

def downgrade():
    op.drop_column('campus_messages', 'telegram_error')
    op.drop_table('student_xp_events')
    op.drop_table('student_profiles')
