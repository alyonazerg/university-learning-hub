"""Teacher supplied task menu. Publication creates an immutable assignment copy."""
def item(key,course,kind,title,instruction,parts,live=False):
    return dict(id=key,course_id=course,kind=kind,title=title,description=instruction,
                max_points=sum(p[1] for p in parts),rubric=[{'key':str(i),'label':p[0],'max':p[1]} for i,p in enumerate(parts)],requires_live_check=live)

CATALOG=[
    item('grammar-mindmap','grammar','imt','Grammar mind maps','Create a collection of mind maps covering the studied grammar topic. If AI helped create an infographic, attach the exact prompt.',[('Accuracy and coverage',1),('Organisation and explanation',1)]),
    item('grammar-expressions','grammar','imt','Grammar in proverbs and idioms','Find at least 20 proverbs, sayings or idioms. Identify and explain the studied grammatical phenomena in each. This is a grammar analysis, not a vocabulary recall test.',[('Relevant examples',1),('Grammar analysis',2)]),
    item('grammar-quiz','grammar','imt','Grammar revision quiz or game','Prepare and conduct a revision game, up to 15 minutes. May be prepared in pairs; specify who prepared each part. Upload materials. Live delivery is assessed by your teacher.',[('Materials and content',1),('Live facilitation — teacher observation',2)],True),
    item('grammar-extra-1.1','grammar','extra','Noun classification','Analyse the teacher-provided noun examples using the studied classification.',[('Accuracy and explanation',2)]),
    item('grammar-extra-1.2','grammar','extra','Singularia and pluralia dialogue','Write a dialogue with 10 singularia tantum and 10 pluralia tantum examples. Submit a highlighted script and a recording or perform it without reading.',[('Script and grammar',1),('Performance — teacher observation',2)],True),
    item('grammar-extra-2.1','grammar','extra','Dialogue and grammar analysis','Create a one-page original dialogue using Topics 1–2 in two columns: dialogue / article and pronoun analysis. Times New Roman 14, line spacing 1.5. No memorisation required.',[('Dialogue and analysis',5)]),
    item('grammar-extra-3.1','grammar','extra','Your story, your voice','Write an original story of about 1000 words and record it. Demonstrate nouns, articles, numerals, adjectives, pronouns and adverbs.',[('Written grammar',1),('Recorded delivery — teacher observation',2)],True),
    item('grammar-extra-3.2','grammar','extra','Spontaneous video description','Choose a 5–7 minute video, then record a spontaneous description demonstrating adjectives and adverbs. Ask your teacher for the specific requirements.',[('Grammar and spontaneous delivery — teacher observation',2)],True),
    item('speech-shadowing','speech','imt','Shadowing Your Favorite Actor','Choose a 2–4 minute clip, practise shadowing and submit both the source and your final recording.',[('Accuracy — teacher listening',1),('Delivery — teacher listening',2)],True),
    item('speech-mindmap','speech','imt','Vocabulary Mind Map','Organise the studied period’s vocabulary by unit or topic. Include forms, collocations and example sentences.',[('Coverage and accuracy',1),('Organisation and design',1)]),
    item('speech-idioms','speech','imt','15 Proverbs / Idioms / Sayings','Submit 15 topic-relevant expressions not introduced in the course, with meanings and examples. Agree the list with your teacher before learning it; prepare for an oral check.',[('Relevance and accuracy',1),('Recall — teacher oral check',2)],True),
    item('speech-podcast','speech','imt','Podcast/Vlog Review','Prepare a spoken summary and opinion, up to 5 minutes. Agree a presentation date; upload notes, outline or slides.',[('Content',1),('Delivery — teacher observation',2)],True),
    item('speech-wild','speech','imt','Vocabulary in the Wild','Collect 10 authentic examples of studied vocabulary from varied sources. Include screenshots and written usage/context explanations.',[('Relevance',1),('Analysis',1)]),
    item('speech-essay','speech','imt','Opinion Essay + Oral Defense','Write an approximately 250-word opinion essay and defend it in a 2-minute Q&A on an agreed date.',[('Written argument',1),('Oral defense — teacher observation',2)],True),
    item('speech-extra-quiz','speech','extra','Group Quiz/Game','Design and run a multi-round vocabulary game, up to 15 minutes. One team per period, subject to teacher agreement. Attach materials and individual contributions.',[('Content',2),('Facilitation — teacher observation',3)],True),
    item('speech-extra-course','speech','extra','Mini-Course','Agree an unfamiliar language/culture topic with your teacher. Upload teaching materials and practice activities, including individual contributions. Agree duration and an available slot.',[('Content',2),('Delivery and practice — teacher observation',3)],True),
    item('speech-extra-video','speech','extra','Group Podcast/Video Project','Create a course-related 5–7 minute podcast/video using target vocabulary. Attach script/subtitles and specify individual contributions.',[('Content and vocabulary',2),('Production and delivery — teacher observation',3)],True),
    item('speech-extra-debate','speech','extra','Class Debate Event','Agree a topic and slot with your teacher; prepare questions and moderate a debate of up to 35 minutes. Upload the plan and individual contributions.',[('Preparation',2),('Facilitation — teacher observation',3)],True),
]
# Only supplied criterion splits are authoritative. Grammar splits were not supplied:
# retain a single teacher-assessed overall criterion rather than inventing a rubric.
for entry in CATALOG:
    if entry['course_id']=='grammar':entry['rubric']=[{'key':'overall','label':'Accuracy and fulfilment of the stated requirements','max':entry['max_points']}]

CAPS={'grammar':{'1':{'homework':11,'glossary':2,'dictation':3,'imt':5,'test':7},'2':{'homework':4,'glossary':2,'dictation':2,'imt':2,'test':5},'3':{'homework':5,'glossary':2,'dictation':3,'imt':5,'test':7}},
      'speech':{'1':{'classwork':14,'imt':8,'test':6},'2':{'classwork':14,'imt':8,'test':6,'revision':9}}}
