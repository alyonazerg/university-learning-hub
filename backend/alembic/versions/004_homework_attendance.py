"""Persistent assignments, private submissions, compensation access and attendance."""
from alembic import op
import sqlalchemy as sa

revision = '004_homework_attendance'
down_revision = '003_learning'


def upgrade():
    op.create_table('homework_tasks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=False),
        sa.Column('course_id', sa.String(16), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('starts_at', sa.DateTime, nullable=False),
        sa.Column('ends_at', sa.DateTime, nullable=False),
        sa.Column('test_at', sa.DateTime, nullable=True),
        sa.Column('checkpoint_id', sa.String(36), sa.ForeignKey('homework_tasks.id'), nullable=True),
        sa.Column('vocabulary', sa.JSON, nullable=False),
        sa.Column('constructions', sa.JSON, nullable=False),
        sa.Column('criteria', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False))
    op.create_table('homework_groups',
        sa.Column('task_id', sa.String(36), sa.ForeignKey('homework_tasks.id'), primary_key=True),
        sa.Column('group_id', sa.Integer, sa.ForeignKey('groups.id'), primary_key=True))
    op.create_table('compensation_access',
        sa.Column('checkpoint_id', sa.String(36), sa.ForeignKey('homework_tasks.id'), primary_key=True),
        sa.Column('student_id', sa.Integer, sa.ForeignKey('students.id'), primary_key=True),
        sa.Column('certificate_checked', sa.Boolean, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False))
    op.create_table('homework_submissions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('task_id', sa.String(36), sa.ForeignKey('homework_tasks.id'), nullable=False),
        sa.Column('student_id', sa.Integer, sa.ForeignKey('students.id'), nullable=False),
        sa.Column('attempt', sa.Integer, nullable=False),
        sa.Column('kind', sa.String(16), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('photos', sa.JSON, nullable=False),
        sa.Column('request_id', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False),
        sa.Column('late', sa.Boolean, nullable=False),
        sa.UniqueConstraint('task_id', 'student_id', 'attempt', name='uq_homework_attempt'),
        sa.UniqueConstraint('student_id', 'request_id', name='uq_homework_request'),
        sa.CheckConstraint('attempt BETWEEN 1 AND 3', name='ck_homework_attempt'))
    op.create_index('ix_homework_submissions_task_id', 'homework_submissions', ['task_id'])
    op.create_index('ix_homework_submissions_student_id', 'homework_submissions', ['student_id'])
    op.create_table('homework_feedback',
        sa.Column('submission_id', sa.String(36), sa.ForeignKey('homework_submissions.id'), primary_key=True),
        sa.Column('comment', sa.Text, nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False))
    op.create_table('attendance_lessons',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('group_id', sa.Integer, sa.ForeignKey('groups.id'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('starts_at', sa.DateTime, nullable=False),
        sa.UniqueConstraint('group_id', 'starts_at', name='uq_attendance_lesson'))
    op.create_index('ix_attendance_lessons_group_id', 'attendance_lessons', ['group_id'])
    op.create_table('attendance_marks',
        sa.Column('lesson_id', sa.String(36), sa.ForeignKey('attendance_lessons.id'), primary_key=True),
        sa.Column('student_id', sa.Integer, sa.ForeignKey('students.id'), primary_key=True),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('updated_at', sa.DateTime, nullable=False))


def downgrade():
    for table in ['attendance_marks', 'attendance_lessons', 'homework_feedback',
                  'homework_submissions', 'compensation_access', 'homework_groups', 'homework_tasks']:
        op.drop_table(table)
