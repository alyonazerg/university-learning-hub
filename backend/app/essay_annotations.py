"""Validated code-point anchors and teacher-only publication of essay annotations."""
import hashlib
CATEGORIES={'grammar','vocabulary','style'}
INTENTS={'correction','improvement','praise'}
def digest(text):return hashlib.sha256(text.encode()).hexdigest()
def normalize(text,items,submission_id,legacy=False):
    if not isinstance(items,list):return []
    output=[];seen=set()
    for item in items[:24]:
        if not isinstance(item,dict):continue
        original=item.get('original');category=item.get('category','grammar' if legacy else None);intent=item.get('intent','correction' if legacy else None)
        if legacy and category in ['spelling','punctuation']:category='grammar'
        if not isinstance(original,str) or not original or len(original)>600 or category not in CATEGORIES or intent not in INTENTS:continue
        start=item.get('start');end=item.get('end')
        if type(start) is not int or type(end) is not int or start<0 or end<=start or end>len(text) or text[start:end]!=original:
            # Repeated quotations need a reliable position, not an arbitrary first match.
            if text.count(original)!=1:continue
            start=text.index(original);end=start+len(original)
        replacement=item.get('replacement',item.get('correction'));explanation=item.get('explanation')
        if replacement is not None and (not isinstance(replacement,str) or len(replacement)>600):continue
        if intent!='praise' and (replacement is None or replacement==original):continue
        if not isinstance(explanation,str) or not explanation.strip() or len(explanation)>800:continue
        key=(start,end,category,intent)
        if key in seen:continue
        seen.add(key);identifier=hashlib.sha256(f'{submission_id}:{digest(text)}:{start}:{end}:{category}:{intent}'.encode()).hexdigest()[:24]
        output.append({'id':identifier,'submission_id':submission_id,'source_hash':digest(text),'category':category,'intent':intent,'original':original,'start':start,'end':end,'replacement':replacement,'explanation':explanation.strip(),'status':'pending'})
    return output

def draft(row):
    report=row.report or {}
    return report.get('essay_annotation_draft',normalize(row.writing,report.get('ai_language_errors',[]),row.id,True))
def public(row):
    published=(row.report or {}).get('essay_feedback_publication',{})
    if published.get('source_hash')!=digest(row.writing):return []
    return [a for a in published.get('annotations',[]) if a.get('status')=='approved' and row.writing[a['start']:a['end']]==a['original']]
