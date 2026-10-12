"""Private durable speaking audio and attribution; external processing disabled by default."""
from alembic import op
import sqlalchemy as sa
revision='019_revision_audio'
down_revision='018_material_audit'
branch_labels=None
depends_on=None

def upgrade():
    op.create_table('revision_audio',sa.Column('id',sa.String(36),primary_key=True),sa.Column('owner_id',sa.String(36),sa.ForeignKey('revision_attempts.id'),nullable=False),sa.Column('part',sa.String(12),nullable=False),sa.Column('participants',sa.JSON,nullable=False),sa.Column('first_speaker',sa.String(36),nullable=False),sa.Column('mime',sa.String(80),nullable=False),sa.Column('audio',sa.LargeBinary,nullable=False),sa.Column('byte_count',sa.Integer,nullable=False),sa.Column('status',sa.String(20),nullable=False),sa.Column('transcript',sa.JSON,nullable=False),sa.Column('confirmations',sa.JSON,nullable=False),sa.Column('analysis',sa.JSON,nullable=False),sa.Column('suggestions',sa.JSON,nullable=False),sa.Column('version',sa.Integer,nullable=False),sa.Column('created_at',sa.DateTime,nullable=False),sa.Column('updated_at',sa.DateTime,nullable=False),sa.UniqueConstraint('owner_id','part',name='uq_revision_audio_part'))
    op.create_index('ix_revision_audio_owner_id','revision_audio',['owner_id'])

def downgrade():op.drop_table('revision_audio')
