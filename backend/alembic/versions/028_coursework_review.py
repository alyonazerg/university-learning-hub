from alembic import op
import sqlalchemy as sa
revision='028_coursework_review'
down_revision='027_student_profiles'
branch_labels=depends_on=None

def upgrade():
    op.add_column('homework_tasks',sa.Column('assessment_config',sa.JSON(),nullable=False,server_default='{}'))
    op.add_column('homework_submissions',sa.Column('snapshot',sa.JSON(),nullable=False,server_default='{}'))
    op.add_column('homework_submissions',sa.Column('review_version',sa.Integer(),nullable=False,server_default='0'))
    op.create_table('coursework_ai_jobs',sa.Column('submission_id',sa.String(36),sa.ForeignKey('homework_submissions.id'),primary_key=True),sa.Column('status',sa.String(20),nullable=False),sa.Column('attempts',sa.Integer(),nullable=False),sa.Column('lease',sa.String(36),nullable=False),sa.Column('updated_at',sa.DateTime(),nullable=False),sa.Column('result',sa.JSON(),nullable=False),sa.Column('error',sa.String(300),nullable=False))
    op.create_index('ix_coursework_ai_jobs_status','coursework_ai_jobs',['status'])
    op.create_table('coursework_reviews',sa.Column('id',sa.String(36),primary_key=True),sa.Column('submission_id',sa.String(36),sa.ForeignKey('homework_submissions.id'),nullable=False,index=True),sa.Column('version',sa.Integer(),nullable=False),sa.Column('decision',sa.String(24),nullable=False),sa.Column('points',sa.Integer(),nullable=True),sa.Column('comment',sa.Text(),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False),sa.UniqueConstraint('submission_id','version',name='uq_coursework_review_version'))
    op.add_column('coursework_reviews',sa.Column('scores',sa.JSON(),nullable=False,server_default='{}'))
    op.create_table('coursework_credits',sa.Column('task_id',sa.String(36),sa.ForeignKey('homework_tasks.id'),primary_key=True),sa.Column('student_id',sa.Integer(),sa.ForeignKey('students.id'),primary_key=True),sa.Column('submission_id',sa.String(36),sa.ForeignKey('homework_submissions.id'),nullable=False),sa.Column('review_id',sa.String(36),sa.ForeignKey('coursework_reviews.id'),nullable=False),sa.Column('points',sa.Integer(),nullable=False),sa.Column('xp',sa.Integer(),nullable=False))
    op.create_table('coursework_attachments',sa.Column('id',sa.String(36),primary_key=True),sa.Column('student_id',sa.Integer(),sa.ForeignKey('students.id'),nullable=False),sa.Column('task_id',sa.String(36),sa.ForeignKey('homework_tasks.id'),nullable=False),sa.Column('submission_id',sa.String(36),sa.ForeignKey('homework_submissions.id'),nullable=True,index=True),sa.Column('name',sa.String(160),nullable=False),sa.Column('mime',sa.String(100),nullable=False),sa.Column('data',sa.LargeBinary(),nullable=False),sa.Column('created_at',sa.DateTime(),nullable=False))

def downgrade():
    for table in ['coursework_attachments','coursework_credits','coursework_reviews','coursework_ai_jobs']:op.drop_table(table)
    op.drop_column('homework_submissions','review_version');op.drop_column('homework_submissions','snapshot');op.drop_column('homework_tasks','assessment_config')
