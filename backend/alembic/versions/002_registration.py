"""Group invitations, server-issued pseudonyms and stable student UUIDs."""
import uuid
from alembic import op
import sqlalchemy as sa

revision = '002_registration'
down_revision = '001_sprint1'


def upgrade():
    op.add_column('students', sa.Column('public_id', sa.String(36), nullable=True))
    students = sa.table('students', sa.column('id', sa.Integer), sa.column('public_id', sa.String(36)))
    connection = op.get_bind()
    for student_id in connection.execute(sa.select(students.c.id)).scalars():
        connection.execute(students.update().where(students.c.id == student_id).values(public_id=str(uuid.uuid4())))
    with op.batch_alter_table('students') as batch:
        batch.alter_column('public_id', existing_type=sa.String(36), nullable=False)
        batch.create_unique_constraint('uq_students_public_id', ['public_id'])
    op.create_table('pseudonym_reservations',
        sa.Column('token', sa.String(64), primary_key=True),
        sa.Column('telegram_user_id', sa.BigInteger, nullable=False, unique=True),
        sa.Column('pseudonym', sa.String(80), nullable=False, unique=True),
        sa.Column('expires_at', sa.DateTime, nullable=False))
    op.create_table('group_invitations',
        sa.Column('token_hash', sa.String(64), primary_key=True),
        sa.Column('group_id', sa.Integer, sa.ForeignKey('groups.id'), nullable=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('used', sa.Boolean, nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_table('group_invitations')
    op.drop_table('pseudonym_reservations')
    with op.batch_alter_table('students') as batch:
        batch.drop_constraint('uq_students_public_id', type_='unique')
        batch.drop_column('public_id')
