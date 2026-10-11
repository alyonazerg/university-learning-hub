from sqlalchemy import select
from test_learning import admin,student
from app.db import SessionLocal
from app.models import Group,Student


def test_midcheck_context_uses_registered_alias_and_own_group(client,authentication):
    teacher=admin(client);learner,profile,_=student(client,authentication)
    gid=profile['group_id']
    with SessionLocal() as session:
        group=session.get(Group,gid);group.name='150';group.course_id='grammar';session.commit()
    assert client.get(f'/learning/midcheck/context?group_id={gid}').status_code==401
    result=client.get(f'/learning/midcheck/context?group_id={gid}',headers=learner)
    assert result.status_code==200 and result.json()=={'alias':profile['pseudonym'],'group':'150','preview':False}
    assert result.headers['cache-control']=='no-store'
    assert client.get(f'/learning/midcheck/context?group_id={gid+100}',headers=learner).status_code==403
    assert client.get(f'/learning/midcheck/context?group_id={gid}',headers=teacher).json()['preview'] is True
