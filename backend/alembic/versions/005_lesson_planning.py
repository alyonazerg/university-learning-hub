"""Group schedules and calendar thematic planning; existing records are preserved."""
from alembic import op
import sqlalchemy as sa

revision = '005_lesson_planning'
down_revision = '004_homework_attendance'


def upgrade():
    op.create_table('lesson_plans',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('group_id', sa.Integer, sa.ForeignKey('groups.id'), nullable=False),
        sa.Column('position', sa.Integer, nullable=False),
        sa.Column('topic', sa.String(200), nullable=False),
        sa.Column('starts_at', sa.DateTime, nullable=True),
        sa.Column('duration_minutes', sa.Integer, nullable=False),
        sa.Column('room', sa.String(200), nullable=False),
        sa.Column('kind', sa.String(16), nullable=False),
        sa.Column('objectives', sa.Text, nullable=False),
        sa.Column('materials', sa.Text, nullable=False),
        sa.Column('vocabulary', sa.JSON, nullable=False),
        sa.Column('constructions', sa.JSON, nullable=False),
        sa.Column('completed', sa.Boolean, nullable=False),
        sa.Column('attendance_lesson_id', sa.String(36), sa.ForeignKey('attendance_lessons.id'), nullable=True),
        sa.UniqueConstraint('group_id', 'starts_at', name='uq_plan_group_time'))
    op.create_index('ix_lesson_plans_group_id', 'lesson_plans', ['group_id'])


def downgrade():
    op.drop_table('lesson_plans')
