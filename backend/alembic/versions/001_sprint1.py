from alembic import op
import sqlalchemy as sa
revision = "001_sprint1"
down_revision = None
def upgrade():
    op.create_table("groups", sa.Column("id", sa.Integer, primary_key=True), sa.Column("name", sa.String(120), nullable=False, unique=True), sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()))
    op.create_table("students", sa.Column("id", sa.Integer, primary_key=True), sa.Column("telegram_user_id", sa.BigInteger, nullable=False, unique=True), sa.Column("pseudonym", sa.String(80), nullable=False, unique=True), sa.Column("group_id", sa.Integer, sa.ForeignKey("groups.id")), sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()))
    op.create_table("identity_registry", sa.Column("id", sa.Integer, primary_key=True), sa.Column("student_id", sa.Integer, sa.ForeignKey("students.id"), nullable=False, unique=True), sa.Column("legal_name", sa.Text, nullable=False), sa.Column("created_at", sa.DateTime, nullable=False))
def downgrade():
    op.drop_table("identity_registry"); op.drop_table("students"); op.drop_table("groups")
