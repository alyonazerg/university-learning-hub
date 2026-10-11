"""Persistent public revision attempts and private experiment metadata."""
from alembic import op
import sqlalchemy as sa
import json
from pathlib import Path
from datetime import datetime
revision='007_public_revisions'
down_revision='006_test_links'
def upgrade():
    op.create_table('revision_groups',sa.Column('code',sa.String(3),primary_key=True),sa.Column('condition',sa.String(16)),sa.Column('roster',sa.JSON,nullable=False),sa.Column('emergent',sa.JSON,nullable=False),sa.Column('expected_count',sa.Integer,nullable=False),sa.Column('inactive_count',sa.Integer,nullable=False),sa.Column('allocation_seed',sa.String(40),nullable=False))
    op.create_table('revision_tests',sa.Column('id',sa.String(36),primary_key=True),sa.Column('definition',sa.JSON,nullable=False),sa.Column('published',sa.Boolean,nullable=False),sa.Column('created_at',sa.DateTime,nullable=False))
    op.create_table('revision_attempts',sa.Column('id',sa.String(36),primary_key=True),sa.Column('test_id',sa.String(36),sa.ForeignKey('revision_tests.id'),nullable=False),sa.Column('oral',sa.JSON,nullable=False),sa.Column('research_consent',sa.Boolean,nullable=False),sa.Column('consent_version',sa.String(40),nullable=False),sa.Column('token_hash',sa.String(64),nullable=False),sa.Column('student_id',sa.String(36),nullable=False),sa.Column('student_name',sa.String(100),nullable=False),sa.Column('group_code',sa.String(3),nullable=False),sa.Column('condition',sa.String(16),nullable=False),sa.Column('snapshot',sa.JSON,nullable=False),sa.Column('answers',sa.JSON,nullable=False),sa.Column('timing',sa.JSON,nullable=False),sa.Column('writing',sa.Text,nullable=False),sa.Column('report',sa.JSON,nullable=False),sa.Column('started_at',sa.DateTime,nullable=False),sa.Column('begun_at',sa.DateTime),sa.Column('submitted_at',sa.DateTime),sa.Column('teacher_status',sa.String(16),nullable=False))
    op.create_index('ix_revision_attempts_test_id','revision_attempts',['test_id'])
    table=sa.table('revision_groups',sa.column('code'),sa.column('condition'),sa.column('roster',sa.JSON),sa.column('emergent',sa.JSON),sa.column('allocation_seed'),sa.column('expected_count'),sa.column('inactive_count'))
    op.bulk_insert(table,[{'code': '213', 'condition': 'experimental', 'roster': [], 'emergent': [], 'allocation_seed': '1265438754', 'expected_count': 14, 'inactive_count': 0}, {'code': '214', 'condition': 'control', 'roster': [], 'emergent': [], 'allocation_seed': '1265438754', 'expected_count': 11, 'inactive_count': 0}, {'code': '215', 'condition': 'experimental', 'roster': [], 'emergent': [], 'allocation_seed': '1265438754', 'expected_count': 16, 'inactive_count': 0}, {'code': '216', 'condition': 'control', 'roster': [], 'emergent': [], 'allocation_seed': '1265438754', 'expected_count': 13, 'inactive_count': 1}, {'code': '217', 'condition': 'control', 'roster': [], 'emergent': [], 'allocation_seed': '1265438754', 'expected_count': 14, 'inactive_count': 0}])
    tests=sa.table('revision_tests',sa.column('id'),sa.column('definition',sa.JSON),sa.column('published',sa.Boolean),sa.column('created_at',sa.DateTime))
    folder=Path(__file__).resolve().parents[2]/'revision_materials'
    op.bulk_insert(tests,[{'id':identifier,'definition':json.loads((folder/name).read_text()),'published':False,'created_at':datetime.utcnow()} for identifier,name in [('53cc2eae-9888-469d-bc40-b9f648b58775','unit7-b2.json'),('a90c0f9c-a40c-40e4-95bb-c22c4bfb36a8','unit7-c1.json')]])
    for code in ['213','214','215','216','217']:
        content=(folder/('group-'+code+'.txt')).read_text().split('Emergent vocabulary')[1]
        import re
        words=[re.sub(r'^\d+\.\s*','',line.strip()) for line in content.splitlines() if re.match(r'^\d+\.',line.strip())]
        op.execute(table.update().where(table.c.code==code).values(emergent=words))
def downgrade():
    op.drop_table('revision_attempts');op.drop_table('revision_tests');op.drop_table('revision_groups')
