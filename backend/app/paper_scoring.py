"""Pure scoring helpers for confirmed paper assessments."""
from collections import defaultdict

def score_paper(key: str, answers: str, topics: list[str]) -> dict:
    key = key.upper()
    answers = answers.upper()
    if not key or len(key) != len(answers) or len(key) != len(topics):
        raise ValueError("Key, answers and topics must have equal nonzero lengths")
    if any(c not in "ABCDE" for c in key) or any(c not in "ABCDE-" for c in answers):
        raise ValueError("Unresolved or invalid answer")
    if any(not t.strip() for t in topics):
        raise ValueError("Every question needs a topic")
    counts = defaultdict(lambda: [0, 0])
    correct = 0
    for k, a, topic in zip(key, answers, topics, strict=True):
        hit = int(k == a)
        correct += hit
        counts[topic.strip()][0] += hit
        counts[topic.strip()][1] += 1
    total = len(key)
    return {
        "correct": correct, "total": total, "percent": 100 * correct / total,
        "points": 2 if 4 * correct > 3 * total else 1 if 2 * correct >= total else 0,
        "topics": [{"topic": t, "correct": c, "total": n, "percent": 100*c/n}
                   for t, (c, n) in sorted(counts.items())],
    }

def aggregate_progress(results: list[dict]) -> list[dict]:
    """Pass only latest confirmed result per assessment and student."""
    counts = defaultdict(lambda: [0, 0])
    for result in results:
        for item in result["topics"]:
            c, n = counts[item["topic"]]
            counts[item["topic"]] = [c + item["correct"], n + item["total"]]
    return [{"topic": t, "correct": c, "total": n, "percent": 100*c/n}
            for t, (c, n) in sorted(counts.items()) if n]
