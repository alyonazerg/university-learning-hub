"""Group courses, sessions, vocabulary and private review progress."""
from alembic import op
import sqlalchemy as sa

revision = '003_learning'
down_revision = '002_registration'


def upgrade():
    op.add_column('groups', sa.Column('course_id', sa.String(16), nullable=False, server_default='speech'))
    op.create_table('card_editors',
        sa.Column('group_id', sa.Integer, sa.ForeignKey('groups.id'), primary_key=True),
        sa.Column('student_id', sa.Integer, sa.ForeignKey('students.id'), nullable=False))
    op.create_table('learning_sessions',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('role', sa.String(16), nullable=False),
        sa.Column('student_id', sa.Integer, sa.ForeignKey('students.id'), nullable=True),
        sa.Column('expires_at', sa.DateTime, nullable=False))
    op.create_table('vocabulary_decks',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('group_id', sa.Integer, sa.ForeignKey('groups.id'), nullable=False),
        sa.Column('author_student_id', sa.Integer, sa.ForeignKey('students.id'), nullable=True),
        sa.Column('title', sa.String(120), nullable=False),
        sa.Column('source', sa.String(150), nullable=False),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False))
    op.create_table('vocabulary_cards',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('deck_id', sa.String(36), sa.ForeignKey('vocabulary_decks.id'), nullable=False),
        sa.Column('position', sa.Integer, nullable=False),
        sa.Column('content', sa.JSON, nullable=False))
    op.create_table('card_progress',
        sa.Column('student_id', sa.Integer, sa.ForeignKey('students.id'), primary_key=True),
        sa.Column('card_id', sa.String(36), sa.ForeignKey('vocabulary_cards.id'), primary_key=True),
        sa.Column('level', sa.Integer, nullable=False),
        sa.Column('interval_days', sa.Integer, nullable=False),
        sa.Column('due_at', sa.DateTime, nullable=False),
        sa.Column('version', sa.Integer, nullable=False))
    op.create_table('review_events',
        sa.Column('student_id', sa.Integer, sa.ForeignKey('students.id'), primary_key=True),
        sa.Column('card_id', sa.String(36), sa.ForeignKey('vocabulary_cards.id'), primary_key=True),
        sa.Column('day', sa.String(10), primary_key=True),
        sa.Column('created_at', sa.DateTime, nullable=False))


def downgrade():
    for name in ['review_events', 'card_progress', 'vocabulary_cards', 'vocabulary_decks', 'learning_sessions', 'card_editors']:
        op.drop_table(name)
    with op.batch_alter_table('groups') as batch:
        batch.drop_column('course_id')
