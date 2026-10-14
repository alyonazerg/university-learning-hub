from alembic import op
import sqlalchemy as sa
revision='020_imt_idiom'
down_revision='019_revision_audio'
branch_labels=None
depends_on=None
def upgrade():
    op.create_table('imt_idiom_collections',sa.Column('id',sa.String(36),primary_key=True),sa.Column('student_name',sa.String(100),nullable=False),sa.Column('group_code',sa.String(3),nullable=False),sa.Column('coursebook',sa.String(30),nullable=False),sa.Column('unit',sa.String(20),nullable=False),sa.Column('token_hash',sa.String(64),nullable=False,unique=True),sa.Column('status',sa.String(20),nullable=False),sa.Column('entries',sa.JSON,nullable=False),sa.Column('material_snapshot',sa.JSON,nullable=False),sa.Column('attempt',sa.JSON,nullable=False),sa.Column('result',sa.JSON,nullable=False),sa.Column('created_at',sa.DateTime,nullable=False),sa.Column('updated_at',sa.DateTime,nullable=False))
    op.create_index('ix_imt_idiom_collections_token_hash','imt_idiom_collections',['token_hash'])
def downgrade():
    op.drop_table('imt_idiom_collections')
