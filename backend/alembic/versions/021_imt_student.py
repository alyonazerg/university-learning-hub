from alembic import op
import sqlalchemy as sa
revision='021_imt_student'
down_revision='020_imt_idiom'
branch_labels=None
depends_on=None
def upgrade():
    op.add_column('imt_idiom_collections',sa.Column('student_id',sa.Integer(),nullable=True))
    op.create_index('ix_imt_idiom_collections_student_id','imt_idiom_collections',['student_id'])
    op.create_foreign_key('fk_imt_idiom_collections_student_id','imt_idiom_collections','students',['student_id'],['id'])
def downgrade():
    op.drop_constraint('fk_imt_idiom_collections_student_id','imt_idiom_collections',type_='foreignkey')
    op.drop_index('ix_imt_idiom_collections_student_id',table_name='imt_idiom_collections')
    op.drop_column('imt_idiom_collections','student_id')
