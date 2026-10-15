from decimal import Decimal
from typing import Literal
from fastapi import HTTPException
from pydantic import Field
from .learning import StrictModel
from .coursework_catalog import CATALOG

class AssessmentConfig(StrictModel):
    template_id: str = Field(default='',max_length=80)
    semester: str = Field(pattern=r'^\d{4}-\d{4}-[12]$')
    period: int = Field(ge=1,le=3)
    category: Literal['homework','glossary','dictation','imt','extra','test','classwork','credit_test','credit_oral']
    max_points: Decimal = Field(gt=0,le=100,decimal_places=2)
    xp: int = Field(default=10,ge=0,le=100)
    ai_enabled: bool = False

def hundredths(value):return int(Decimal(str(value))*100)

def configuration(body,course,kind):
    if body is None:return {}
    data=body.model_dump(mode='json');data['max_points']=float(body.max_points)
    if course=='speech' and body.period==3:raise HTTPException(422,'Speaking Practice has two rating periods')
    if course=='speech' and data['category']=='homework':data['category']='classwork'
    if course=='grammar' and data['category']=='classwork':raise HTTPException(422,'A separate grammar participation scoring policy has not been agreed')
    if course=='speech' and data['category'] in ('glossary','dictation','credit_test'):raise HTTPException(422,'Choose a rating category for Speaking Practice')
    if kind in ('imt','extra') and data['category']!=kind:raise HTTPException(422,'Optional work must use its matching IMT or extra category')
    if data['category'] in ('imt','extra') and kind!=data['category']:raise HTTPException(422,'Choose the matching assignment type')
    template=next((t for t in CATALOG if t['id']==data['template_id']),None)
    if data['template_id'] and (not template or template['course_id']!=course or template['kind']!=kind):raise HTTPException(422,'Choose a template for this course and assignment type')
    if template and hundredths(template['max_points'])!=hundredths(data['max_points']):raise HTTPException(422,'Template maximum must match its rubric')
    data['rubric']=template['rubric'] if template else [{'key':'overall','label':'Overall assessment','max':data['max_points']}]
    data['requires_live_check']=bool(template and template['requires_live_check'])
    if data['category']=='credit_oral':
        data['requires_live_check']=True;data['rubric']=[{'key':'overall','label':'Oral response — teacher observation','max':data['max_points']}]
    data['optional']=kind in ('imt','extra');data['policy_version']='coursework-v1'
    return data
