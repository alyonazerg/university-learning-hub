from unittest.mock import patch
import pytest
from fastapi import HTTPException
from app.imt_ai import review,recognize

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
