from unittest.mock import patch
import pytest
from fastapi import HTTPException
from app.imt_ai import review,recognize
from app.imt_ai import recall_situations,practice_report

def test_situations_do_not_disclose_idiom():
    entries=[{'expression':'Learn the ropes','example':'First day at work.'}]
    with patch('app.imt_ai.completion',return_value={'situations':[{'index':0,'prompt':'A new colleague needs help with unfamiliar procedures. What would you say?'}]}):
        task=recall_situations(entries,stage='reuse')[0]
        assert task['stage']=='reuse' and task['expression']==''
    with patch('app.imt_ai.completion',return_value={'situations':[{'index':0,'prompt':'Tell them to learn the ropes.'}]}):
        with pytest.raises(HTTPException):recall_situations(entries)

def test_report_quotes_only_actual_student_errors():
    attempt={'questions':[{'stage':'reuse','entry_index':0,'prompt':'Describe a new employee.'}],'responses':{'0':{'response':'She learned the ropes quickly.'}}}
    with patch('app.imt_ai.completion',return_value={'summary':'Well done.','strengths':['Natural use'],'next_steps':[],'items':[{'index':0,'successful':True,'feedback':'Clear context.','original':'invented error','correction':'invented correction'}]}):
        report=practice_report([{'expression':'Learn the ropes'}],attempt)
        assert report['reuse_successful']==1 and report['items'][0]['correction']==''

def test_ai_review_validates_grade_and_tasks():
    with patch('app.imt_ai.completion',return_value={'suggested_grade':2,'feedback':'Good examples.','items':[{'index':0,'feedback':'Revise tense','correction':'went bust'}],'tasks':[{'entry_index':0,'prompt':'Describe a different situation.'},{'entry_index':999,'prompt':'invalid'}]}):
        result=review([{'expression':'go bust'}],{})
    assert result['provisional'] and len(result['tasks'])==1
    with patch('app.imt_ai.completion',return_value={'suggested_grade':9}):
        with pytest.raises(HTTPException):review([{'expression':'go bust'}],{})

def test_image_recognition_keeps_original_wording():
    with patch('app.imt_ai.completion',return_value={'rows':[{'expression':'go bust','example':'He go bust.'}]}):
        rows=recognize(b'\xff\xd8test','.jpg')
    assert rows[0]['example']=='He go bust.'
    with pytest.raises(HTTPException):recognize(b'not an image','.jpg')
