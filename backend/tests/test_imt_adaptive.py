from types import SimpleNamespace
from unittest.mock import patch
import pytest
from app.models import Student,ImtIdiomCollection
from app.db import SessionLocal
from app.imt_idiom import start_my,answer_my,AnswerBody,continue_after_feedback

@pytest.fixture(autouse=True)
def context_questions(monkeypatch):
    monkeypatch.setattr('app.imt_idiom.make_context_practice',lambda entries,indices:[{'stage':'reuse','type':'production','entry_index':i,'expression':entries[i]['expression'],'prompt':'A friend regrets an expensive purchase. Comment in 2–3 sentences.'} for i in indices])

def test_mcq_mistakes_select_only_failed_expressions(client):
    with SessionLocal() as session:
        student=Student(pseudonym='Adaptive Test');session.add(student);session.flush()
        entries=[{'expression':f'Expression {i}'} for i in range(6)]
        row=ImtIdiomCollection(student_id=student.id,student_name='Test',token_hash='adaptive',status='submitted',entries=entries,result={'ai_review':{}},attempt={})
        row.result={'ai_review':{'feedback':'Ready'}};session.add(row);session.commit()
        actor=SimpleNamespace(role='student',student_id=student.id)
        with patch('app.imt_ai.recall_situations',return_value=[{'stage':'recall','expression':'','entry_index':i,'prompt':f'Situation {i}'} for i in range(6)]):state=start_my(actor,session)
        order=[q['entry_index'] for q in state['attempt']['questions']]
        assert order!=list(range(6))
        assert all('answer' not in q and len(q['options'])==4 for q in state['attempt']['questions'])
        failed=order[0]
        for index in range(6):
            question=row.attempt['questions'][index]
            response=next(x for x in question['options'] if x!=question['answer']) if index==0 else question['answer']
            state=answer_my(AnswerBody(response=response),actor,session)
            assert state['attempt']['last_feedback']['correct']==(index!=0)
            continue_after_feedback(actor,session)
        assert state['attempt']['stage']=='reuse'
        assert [q['entry_index'] for q in state['attempt']['questions'][6:]]==[failed]

def test_perfect_mcq_selects_five_for_sentence_practice(client):
    with SessionLocal() as session:
        student=Student(pseudonym='Perfect Test');session.add(student);session.flush()
        entries=[{'expression':f'Expression {i}'} for i in range(7)]
        questions=[{'stage':'recall','type':'multiple_choice','entry_index':i,'options':[f'Expression {i}','other'],'answer':f'Expression {i}','prompt':'Situation'} for i in range(7)]
        row=ImtIdiomCollection(student_id=student.id,student_name='Test',token_hash='perfect',status='assessment',entries=entries,result={},attempt={'version':'adaptive_mcq_1','index':0,'recall_count':7,'stage':'recall','responses':{},'questions':questions})
        session.add(row);session.commit();actor=SimpleNamespace(role='student',student_id=student.id)
        for i in range(7):
            state=answer_my(AnswerBody(response=f'Expression {i}'),actor,session)
            continue_after_feedback(actor,session)
        assert len(state['attempt']['questions'][7:])==5
        assert state['attempt']['practice_reason']=='all_correct'
