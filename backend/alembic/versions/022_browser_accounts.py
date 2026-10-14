from alembic import op
import sqlalchemy as sa
revision='022_browser_accounts'
down_revision='021_imt_student'
branch_labels=None
depends_on=None
def upgrade():
    op.alter_column('students','telegram_user_id',existing_type=sa.BigInteger(),nullable=True)
    op.create_table('browser_accounts',sa.Column('student_id',sa.Integer(),sa.ForeignKey('students.id'),primary_key=True),sa.Column('email',sa.String(254),unique=True,nullable=False),sa.Column('password_hash',sa.String(256),nullable=False))
    op.create_table('browser_invitations',sa.Column('id',sa.String(36),primary_key=True),sa.Column('token_hash',sa.String(64),unique=True,nullable=False),sa.Column('group_id',sa.Integer(),sa.ForeignKey('groups.id'),nullable=False),sa.Column('label',sa.String(100),nullable=False),sa.Column('student_id',sa.Integer(),sa.ForeignKey('students.id'),nullable=True),sa.Column('expires_at',sa.DateTime(),nullable=False))
def downgrade():
    op.drop_table('browser_invitations')
    op.drop_table('browser_accounts')
