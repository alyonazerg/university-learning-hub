(() => {
  const n=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
  const states={teacher_review:'Awaiting teacher review',ai_queued:'AI check queued',ai_running:'AI checking',ai_failed:'AI check failed · work saved',graded:'Graded',revision_requested:'Revision requested',not_selected:'Optional · not selected',not_submitted:'Not submitted',not_assigned:'Not assigned'};
  function label(text,input){const l=n('label',text);l.append(input);return l}
  function button(text,action){const b=n('button',text,'secondary');b.type='button';b.onclick=action;return b}
  function status(work){return n('p',states[work.state]||work.state,'coursework-state')}
  function savedWork(cell,request,download){const box=n('details');box.append(n('summary','View work'));const body=n('div');box.append(body);let loaded=false;box.ontoggle=async()=>{if(!box.open||loaded)return;body.textContent='Loading…';try{const work=await request('/coursework/submissions/'+cell.submission_id);body.replaceChildren(n('strong',work.title),n('p',work.content,'coursework-text'));if(window.MoonPhotos)body.append(MoonPhotos.gallery(work.photos));for(const file of work.attachments||[])body.append(button('Download '+file.name,()=>download(file)));assessmentHistory(body,work,request);loaded=true}catch(error){body.textContent=error.message}};return box}
  function assessmentHistory(area,work,request){const box=n('details');box.append(n('summary','Assessment history'));const records=n('div');box.append(records);box.ontoggle=async()=>{if(!box.open)return;records.textContent='Loading…';try{const rows=await request(`/coursework/submissions/${work.id}/history`);records.replaceChildren();if(!rows.length)records.append(n('p','No teacher assessment yet.'));for(const r of rows)records.append(n('p',`Version ${r.version} · ${r.points===null?'Revision requested':r.points+' points'} · ${r.comment}`))}catch(error){records.textContent=error.message}};area.append(box)}
  function reviewForm(area,work,config,{request,onSaved,download}){
    const stateLabel=status(work);area.append(stateLabel);
    if(work.ai){const ai=n('section',undefined,'coursework-ai');ai.append(n('h4','AI suggestion · teacher only'));
      if(work.ai.status==='done'){ai.append(n('p',work.ai.result.feedback||''));for(const c of work.ai.result.criteria||[])ai.append(n('p',`${config.rubric.find(r=>r.key===c.key)?.label||'Criterion'}: ${c.suggested??'Teacher observation needed'} — ${c.feedback}`));for(const check of work.ai.result.manual_checks||[])ai.append(n('p',check))}
      else ai.append(n('p',work.ai.error||'Status: '+work.ai.status));
      if(work.ai.status==='failed'&&work.ai.attempts<3)ai.append(button('Retry AI check',async()=>{try{await request(`/coursework/submissions/${work.id}/retry-ai`,'POST',{});ai.append(n('p','Queued. You can still grade manually.'));window.dispatchEvent(new Event('moon-coursework-changed'))}catch(error){ai.append(n('p',error.message))}}));
      area.append(ai);
    }
    if(config.requires_live_check)area.append(n('p','Check the live/oral performance yourself before awarding its points. AI cannot observe it.','muted'));
    const form=n('form',undefined,'coursework-grade-form'),fields={};
    for(const r of config.rubric){const input=n('input');input.type='number';input.min='0';input.max=String(r.max);input.step='.01';input.inputMode='decimal';input.value=work.review?.scores?.[r.key]??'';input.setAttribute('aria-label',r.label);input.addEventListener('wheel',e=>e.preventDefault(),{passive:false});fields[r.key]=input;form.append(label(`${r.label} · 0–${r.max}`,input))}
    const comment=n('textarea');comment.rows=3;comment.maxLength=10000;comment.required=true;comment.value=work.review?.comment||work.feedback||'';form.append(label('Feedback to student',comment));if(window.MoonEmojiPicker)form.append(MoonEmojiPicker.create(comment));
    const decision=n('select');for(const [v,t] of [['graded','Confirm grade'],['revision_requested','Request revision']]){const o=n('option',t);o.value=v;decision.append(o)}form.append(label('Decision',decision));
    const mode=()=>Object.values(fields).forEach(f=>{f.required=decision.value==='graded';f.disabled=decision.value!=='graded'});decision.onchange=mode;mode();
    const actions=n('div',undefined,'coursework-grade-actions'),save=n('button','Save assessment','primary'),notice=n('span');save.type='submit';notice.setAttribute('role','status');actions.append(save,notice);form.append(actions);area.append(form);
    let requestId=null;form.addEventListener('input',()=>{requestId=null;notice.textContent='Unsaved changes';form.dataset.dirty='true'});
    if(work.ai?.status==='done')form.prepend(button('Use AI suggestion as a draft',()=>{for(const c of work.ai.result.criteria||[])if(c.suggested!==null&&fields[c.key])fields[c.key].value=c.suggested;if(!comment.value)comment.value=work.ai.result.feedback||'';requestId=null;form.dataset.dirty='true';notice.textContent='Draft only · check every criterion before saving'}));
    form.onsubmit=async e=>{e.preventDefault();save.disabled=true;notice.textContent='Saving…';requestId=requestId||crypto.randomUUID();try{
      const scores=decision.value==='graded'?Object.fromEntries(Object.entries(fields).map(([k,f])=>[k,Number(f.value)])):{};
      const result=await request(`/coursework/submissions/${work.id}/review`,'PUT',{request_id:requestId,expected_version:work.review_version,decision:decision.value,scores,comment:comment.value});
      work.review_version=result.review_version;work.review=result.review;work.state=result.state;stateLabel.textContent=states[result.state]||result.state;form.dataset.dirty='false';requestId=null;notice.textContent=decision.value==='graded'?`✓ Saved · ${result.review.points} / ${config.max_points} points`:'✓ Revision requested';onSaved?.();window.dispatchEvent(new Event('moon-coursework-changed'));
    }catch(error){notice.textContent=error.message+' Your input is still here.'}finally{save.disabled=false}};
    assessmentHistory(area,work,request);return form;
  }
  function taskFields(form,{course,kind,title,description,criteria,catalog}){
    const box=n('fieldset',undefined,'assignment-policy');box.append(n('legend','Assessment and journal'));
    const template=n('select'),max=n('input'),semester=n('input'),period=n('select'),category=n('select'),xp=n('input'),ai=n('input');
    max.type='number';max.min='.01';max.max='100';max.step='.01';max.value='3';semester.value='2026-2027-1';semester.pattern='[0-9]{4}-[0-9]{4}-[12]';semester.required=true;
    for(let i=1;i<=3;i++){const o=n('option','Period / topic '+i);o.value=i;period.append(o)}
    const cats={homework:'Homework',glossary:'Terminology glossary',dictation:'Terminology dictation',imt:'IMT',extra:'Extra tasks',test:'Topic / unit test',classwork:'Class work / vocabulary / homework',credit_test:'Credit test',credit_oral:'Credit oral response'};
    for(const [key,text] of Object.entries(cats)){const o=n('option',text);o.value=key;category.append(o)}
    xp.type='number';xp.min='0';xp.max='100';xp.step='1';xp.value='10';ai.type='checkbox';ai.checked=true;
    box.append(label('Task template',template),label('Maximum points',max),label('Semester',semester),label('Period / topic',period),label('Rating category',category),label('XP for positively graded work · once per assignment',xp),label('Queue preliminary AI check of text, documents and photos',ai),n('small','AI suggestions stay private until your assessment. Audio/video is saved for teacher review and is not sent for external transcription. IMT and extra are optional; not choosing them creates no debt.'));
    form.append(box);
    function options(){template.replaceChildren();const custom=n('option','Custom assignment');custom.value='';template.append(custom);for(const t of catalog.filter(t=>t.course_id===course.value&&t.kind===kind.value)){const o=n('option',`${t.title} · ${t.max_points} pts`);o.value=t.id;template.append(o)}category.value=kind.value==='imt'||kind.value==='extra'?kind.value:kind.value==='checkpoint'?'test':course.value==='speech'?'classwork':'homework';max.readOnly=false;for(const o of period.options)o.disabled=course.value==='speech'&&o.value==='3';if(course.value==='speech'&&period.value==='3')period.value='2'}
    course.addEventListener('change',options);kind.addEventListener('change',options);options();
    template.onchange=()=>{const t=catalog.find(t=>t.id===template.value);max.readOnly=!!t;if(t){title.value=t.title;description.value=t.description;criteria.value=t.rubric.map(r=>`${r.label}: ${r.max}`).join('\n');max.value=t.max_points;category.value=t.kind}};
    return ()=>({template_id:template.value,max_points:Number(max.value),semester:semester.value,period:Number(period.value),category:category.value,xp:Number(xp.value),ai_enabled:ai.checked});
  }
  function mount({profile,groups,request,audioRequest}){
    for(const [id,title] of [['connected-review-queue','Review queue'],['connected-journal',profile.role==='admin'?'Journal':'My points']]){
      if(id==='connected-review-queue'&&profile.role!=='admin'){document.getElementById(id)?._courseworkCleanup?.();document.getElementById(id)?.remove();document.querySelector(`.dashboard-links a[href="#${id}"]`)?.remove();continue}
      let area=document.getElementById(id);area?._courseworkCleanup?.();if(!area){area=n('section',undefined,'members-panel cabinet-inactive');area.id=id;document.getElementById('workspace').append(area)}area.replaceChildren(n('h2',title));
      if(!document.querySelector(`.dashboard-links a[href="#${id}"]`)){const link=n('a',title);link.href='#'+id;link.onclick=e=>{e.preventDefault();history.replaceState(null,'',link.hash);window.MoonCabinet.show(id)};document.querySelector('.dashboard-links').append(link)}
      document.querySelector(`.dashboard-links a[href="#${id}"]`).textContent=title;
      let selected='',disposed=false,busy=false,records=[];const tools=n('div',undefined,'coursework-toolbar'),notice=n('p');notice.setAttribute('role','status');const content=n('div');area.append(tools,notice,content);
      const download=async file=>{try{const blob=await audioRequest('/coursework/attachments/'+file.id,{blob:true}),url=URL.createObjectURL(blob),a=n('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(error){notice.textContent=error.message}};
      const semester=n('input');semester.value='2026-2027-1';semester.setAttribute('aria-label','Semester');const group=n('select');group.setAttribute('aria-label','Group');groups.forEach(g=>{const o=n('option',g.name);o.value=g.id;group.append(o)});
      const picker=n('select');picker.setAttribute('aria-label','Submission to review');const filter=n('select');for(const [v,t] of [['pending','Pending review'],['all','All submissions'],['graded','Graded'],['revision_requested','Revision requested']]){const o=n('option',t);o.value=v;filter.append(o)}
      const showWork=()=>{content.dataset.savedAt='0';const work=records.find(r=>r.id===picker.value);content.replaceChildren();if(!work){content.append(n('p','No submissions match this view.'));return}selected=work.id;content.append(n('h3',`${work.pseudonym} · ${work.title}`),n('p',`Attempt ${work.attempt}${work.late?' · late submission':''}`),n('p',work.content,'coursework-text'));if(window.MoonPhotos)content.append(MoonPhotos.gallery(work.photos));for(const file of work.attachments||[])content.append(button('Download '+file.name,()=>download(file)));reviewForm(content,work,work.assessment,{request,onSaved:()=>{content.dataset.savedAt=String(Date.now())},download});};
      async function load(auto=false){if(disposed||busy)return;busy=true;try{
        if(id==='connected-review-queue'){
          const rows=await request('/coursework/queue');if(disposed)return;records=rows;
          const matches=rows.filter(w=>w.latest_attempt&&(filter.value==='all'||filter.value==='pending'&&!['graded','revision_requested'].includes(w.state)||w.state===filter.value));
          picker.replaceChildren();for(const w of matches){const o=n('option',`${w.pseudonym} · ${w.title} · ${states[w.state]||w.state}`);o.value=w.id;picker.append(o)}if(matches.some(w=>w.id===selected))picker.value=selected;
          notice.textContent=`${matches.length} submissions · AI suggestions require your approval`;
          if(!auto||!content.querySelector('form[data-dirty="true"]')&&Date.now()-Number(content.dataset.savedAt||0)>15000)showWork();
        }else{
          if(profile.role==='admin'&&!group.value){content.replaceChildren(n('p','Create a group first.'));return}
          const data=await request('/coursework/journal?semester='+encodeURIComponent(semester.value)+(profile.role==='admin'?'&group_id='+group.value:''));if(disposed)return;
          content.replaceChildren(n('p',data.scope,'muted'));const wrap=n('div',undefined,'coursework-journal-scroll'),table=n('table',undefined,'coursework-journal'),head=n('tr');head.append(n('th','Student'));for(const t of data.tasks)head.append(n('th',`${t.title} · ${t.assessment.max_points} pts${t.optional?' · optional':''}`));head.append(n('th','Credited total'),n('th','XP'));table.append(head);
          for(const student of data.students){const tr=n('tr');tr.append(n('th',student.alias));for(const cell of student.cells){const td=n('td');td.append(n('strong',cell.points===null?'—':String(cell.points)),n('small',states[cell.state]||cell.state));if(cell.previous_confirmed)td.append(n('small','Previous confirmed points retained'));if(cell.review)td.append(n('p',cell.review.comment));if(cell.submission_id)td.append(savedWork(cell,request,download));tr.append(td)}tr.append(n('td',String(student.total)),n('td',String(student.xp)));table.append(tr);
            const breakdown=n('details');breakdown.append(n('summary',student.alias+' · rating breakdown'));for(const c of student.categories)breakdown.append(n('p',`${c.period?'Period '+c.period+' · ':''}${c.category}: ${c.credited}${c.cap!==null?' / '+c.cap:''} credited (${c.raw} from work)`));for(const warning of student.warnings)breakdown.append(n('p',warning));content.append(breakdown)}wrap.append(table);content.prepend(wrap);notice.textContent='Updated · confirmed points only. Attendance has no points.';
        }
      }catch(error){notice.textContent=error.message}finally{busy=false}}
      if(id==='connected-review-queue'){tools.append(filter,picker);picker.onchange=showWork;filter.onchange=()=>load()}else{if(profile.role==='admin')tools.append(group);tools.append(semester);group.onchange=()=>load();semester.onchange=()=>load()}
      tools.append(button('Refresh',()=>load()));let wasVisible=false;const visible=()=>!area.classList.contains('cabinet-inactive')&&!document.hidden;
      const observer=new MutationObserver(()=>{const active=!area.classList.contains('cabinet-inactive');if(active&&!wasVisible)load(true);wasVisible=active});observer.observe(area,{attributes:true,attributeFilter:['class']});const interval=setInterval(()=>{if(visible())load(true)},8000);const changed=()=>{if(visible())load(true)};window.addEventListener('moon-coursework-changed',changed);document.addEventListener('visibilitychange',changed);
      area._courseworkCleanup=()=>{disposed=true;observer.disconnect();clearInterval(interval);window.removeEventListener('moon-coursework-changed',changed);document.removeEventListener('visibilitychange',changed)};if(visible())load();
    }
  }
  window.MoonCourseworkReview={taskFields,reviewForm,status,history:assessmentHistory,mount};
})();
