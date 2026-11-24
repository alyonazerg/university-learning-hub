import pytest
from app.paper_scoring import score_paper, aggregate_progress

@pytest.mark.parametrize("correct,points", [(0,0),(14,0),(15,1),(22,1),(23,2),(30,2)])
def test_thresholds(correct, points):
    result = score_paper("A"*30, "A"*correct+"B"*(30-correct), ["Pronouns"]*30)
    assert result["correct"] == correct
    assert result["points"] == points
    assert result["percent"] == 100*correct/30

def test_exact_75():
    assert score_paper("AAAA","AAAB",["T"]*4)["points"] == 1

@pytest.mark.parametrize("answers", ["?", "X", "AA"])
def test_invalid(answers):
    with pytest.raises(ValueError):
        score_paper("A", answers, ["T"])

def test_blank():
    assert score_paper("A","-",["T"])["correct"] == 0

def test_weighted_progress():
    a = score_paper("AAA","AAB",["Relative"]*3)
    b = score_paper("AAAAA","AAAAA",["Relative"]*5)
    assert aggregate_progress([a,b]) == [{"topic":"Relative","correct":7,"total":8,"percent":87.5}]
