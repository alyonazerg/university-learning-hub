from alembic import op
import sqlalchemy as sa
revision='024_campus_messages'
down_revision='023_bug_reports'
branch_labels=None
depends_on=None
def upgrade():
    op.create_table('campus_messages',sa.Column('id',sa.Integer(),primary_key=True),sa.Column('student_id',sa.Integer(),sa.ForeignKey('students.id'),nullable=False),sa.Column('sender_role',sa.String(16),nullable=False),sa.Column('body',sa.Text(),nullable=False),sa.Column('request_id',sa.String(36),nullable=False,unique=True),sa.Column('created_at',sa.DateTime(),nullable=False),sa.Column('read_at',sa.DateTime(),nullable=True))
    op.create_index('ix_campus_messages_student_id','campus_messages',['student_id'])
def downgrade():op.drop_table('campus_messages')
