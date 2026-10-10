(() => {
  'use strict';
  const kinds = {lesson:'Lesson',test:'Checkpoint / test',imt:'IMT',extra:'Extra task'};
  const n = (tag, text, cls) => {const element=document.createElement(tag); if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
  const format = value => new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  let selectedGroup = '';
  function input(form,label,id,type='text',value='',required=true) {
    const box=n('div',undefined,'form-field'), caption=n('label',label,'input-label');caption.htmlFor=id;
    const element=n(type==='textarea'?'textarea':'input');element.id=id;element.value=value;element.required=required;
    if(type==='textarea'){element.rows=3;element.maxLength=5000;}else{element.type=type;element.maxLength=200;}
    box.append(caption,element);form.append(box);return element;
  }
  function select(form,label,id,options,value) {
    const box=n('div',undefined,'form-field'),caption=n('label',label,'input-label');caption.htmlFor=id;
    const element=n('select');element.id=id;for(const [key,text]of options){const option=n('option',text);option.value=key;element.append(option);}if(value!==undefined)element.value=value;
    box.append(caption,element);form.append(box);return element;
  }
  function submit(form,text) {const btn=n('button',text,'primary');btn.type='submit';form.append(btn);return btn;}
  function button(text,action,run) {const btn=n('button',text,'secondary');btn.type='button';btn.addEventListener('click',()=>run(action));return btn;}
  function planBody(row) {const {id,attendance_lesson_id,...body}=row;return body;}
  const lines = text => text.split('\n').map(line=>line.trim()).filter(Boolean);
  function clear() {for(const id of ['connected-schedule','connected-planning'])document.getElementById(id)?.replaceChildren();}
  function render(plans,{profile,groups,request,run,refresh}) {
    const timetable=document.getElementById('connected-schedule'), planning=document.getElementById('connected-planning');
    timetable.replaceChildren(n('h2','Schedule'));planning.replaceChildren(n('h2','Teaching plan'));
    if(plans===null) {timetable.append(n('p',profile.role==='admin'?'Update the server to use this section. The rest of the hub remains available.':'The schedule is not available yet.','muted'));return;}
    const done=async message=>{await refresh();document.getElementById('account-status').textContent=message;};
    if(profile.role==='admin') {
      if(!groups.length){timetable.append(n('p','Create a group in Groups first.'));planning.append(n('p','Teaching plans belong to a group.'));return;}
      if(!groups.some(group=>String(group.id)===selectedGroup))selectedGroup=String(groups[0].id);
      const picker=n('div',undefined,'planning-toolbar');const group=select(picker,'Group','planning-group-filter',groups.map(item=>[item.id,item.name]),selectedGroup);
      group.addEventListener('change',()=>{selectedGroup=group.value;render(plans,{profile,groups,request,run,refresh});});timetable.append(picker);
      const planPicker=picker.cloneNode(true); const planSelect=planPicker.querySelector('select');planSelect.id='plan-group-filter';planPicker.querySelector('label').htmlFor=planSelect.id;planSelect.value=selectedGroup;planSelect.addEventListener('change',()=>{selectedGroup=planSelect.value;render(plans,{profile,groups,request,run,refresh});});planning.append(planPicker);
    } else selectedGroup=String(profile.group_id);
    const gid=Number(selectedGroup), rows=plans.filter(row=>row.group_id===gid), groupName=groups.find(group=>group.id===gid)?.name||'';
    timetable.append(n('p',(groupName?groupName+' · ':'')+'Lesson times use Moscow time.','muted'));
    const dated=rows.filter(row=>row.starts_at).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    if(!dated.length)timetable.append(n('p','No scheduled lessons yet.'));
    for(const row of dated){const article=n('article',undefined,'schedule-card');article.append(n('strong',format(row.starts_at)),n('p',row.topic),n('span',row.duration_minutes+' min'+(row.room?' · '+row.room:''),'muted'));timetable.append(article);}
    if(profile.role==='admin')renderWeekly(timetable,gid,rows,request,run,done);
    planning.append(n('p',(groupName?groupName+' · ':'')+'Prepare topics without dates, then assign them to lessons later.','muted'));
    if(profile.role==='admin'){
      const details=n('details');details.append(n('summary','Add topic'));details.append(editor(null,gid,rows,request,run,done));planning.append(details);
      const bulk=n('details');bulk.append(n('summary','Add topic list'));const form=n('form');
      const topics=input(form,'One topic per line · up to 120 topics','plan-bulk-topics','textarea');
      submit(form,'Save topic list');form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
        const values=lines(topics.value);if(!values.length||values.length>120||values.some(topic=>topic.length>200))throw new Error('Add 1–120 topics, up to 200 characters each.');
        const start=Math.max(0,...rows.map(row=>row.position));
        await request('/plans','POST',{lessons:values.map((topic,index)=>({group_id:gid,topic,position:start+index+1}))});await done('Topic list saved. You can add dates later.');
      });});bulk.append(form);planning.append(bulk);
    }
    if(!rows.length)planning.append(n('p','No topics yet.'));
    for(const row of rows.slice().sort((a,b)=>a.position-b.position||(a.starts_at||'').localeCompare(b.starts_at||''))){
      const article=n('article',undefined,'word-list-card');article.dataset.planId=row.id;
      article.append(n('h3',row.position+'. '+row.topic),n('p',kinds[row.kind]+' · '+(row.starts_at?format(row.starts_at):'Date not set')+' · '+row.duration_minutes+' min'+(row.completed?' · Taught':'')));
      if(row.objectives)article.append(n('p','Objectives: '+row.objectives,'coursework-text'));
      if(row.materials)article.append(n('p','Materials: '+row.materials,'coursework-text'));
      if(row.vocabulary.length)article.append(n('p','Vocabulary: '+row.vocabulary.join('; ')));
      if(row.constructions.length)article.append(n('p','Structures: '+row.constructions.join('; ')));
      if(profile.role==='admin'){
        const details=n('details');details.append(n('summary','Edit topic'));details.append(editor(row,gid,rows,request,run,done));article.append(details);
        article.append(button(row.completed?'Mark as not taught':'Mark as taught',async()=>{await request('/plans/'+row.id,'PUT',{...planBody(row),completed:!row.completed});await done('Teaching plan updated.');},run));
        if(row.starts_at)article.append(button(row.attendance_lesson_id?'Open attendance':'Create attendance register',async()=>{const result=await request('/plans/'+row.id+'/attendance','POST');await done('Attendance register ready.');window.MoonCabinet?.show('connected-attendance');document.querySelector('[data-lesson-id="'+result.lesson_id+'"]')?.scrollIntoView({behavior:'smooth',block:'start'});},run));
      }
      planning.append(article);
    }
  }
  function renderWeekly(area,gid,rows,request,run,done) {
    const details=n('details');details.append(n('summary','Add weekly schedule'));const form=n('form');form.id='weekly-schedule-form';
    const weekday=select(form,'Weekday','weekly-day',[[1,'Monday'],[2,'Tuesday'],[3,'Wednesday'],[4,'Thursday'],[5,'Friday'],[6,'Saturday'],[0,'Sunday']]);
    const time=input(form,'Start time · Moscow','weekly-time','time','09:00');
    const today=MoonPlanningModel.localInput(new Date().toISOString()).slice(0,10);
    const from=input(form,'From','weekly-from','date',today),until=input(form,'Until','weekly-until','date',today);
    const duration=input(form,'Duration · minutes','weekly-duration','number','90');duration.min=1;duration.max=480;
    const room=input(form,'Room / location (optional)','weekly-room','text','',false);
    form.append(n('p','Lessons will be created for the selected weekday. Add topics and materials in the teaching plan. Add a separate schedule for another weekday.','muted'));
    submit(form,'Add schedule');form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
      const dates=MoonPlanningModel.weeklyDates(from.value,until.value,Number(weekday.value),time.value);
      const start=Math.max(0,...rows.map(row=>row.position));
      await request('/plans','POST',{lessons:dates.map((date,index)=>({group_id:gid,position:start+index+1,topic:'Lesson',starts_at:date,duration_minutes:Number(duration.value),room:room.value.trim()}))});await done('Schedule saved. Topics are available in the teaching plan.');
    });});details.append(form);area.append(details);
  }
  function editor(row,gid,rows,request,run,done) {
    const suffix=row?.id||'new',form=n('form');form.dataset.planEditor=suffix;
    const position=input(form,'Topic number','plan-position-'+suffix,'number',row?.position||Math.max(0,...rows.map(item=>item.position))+1);position.min=1;position.max=10000;
    const topic=input(form,'Lesson topic','plan-topic-'+suffix,'text',row?.topic||'');
    const kind=select(form,'Type','plan-kind-'+suffix,Object.entries(kinds),row?.kind||'lesson');
    const date=input(form,'Date and time · Moscow (can be added later)','plan-date-'+suffix,'datetime-local',MoonPlanningModel.localInput(row?.starts_at),false);
    if(row?.attendance_lesson_id){date.readOnly=true;topic.readOnly=true;form.append(n('p','The date and topic are linked to the attendance register.','muted'));}
    const duration=input(form,'Duration · minutes','plan-duration-'+suffix,'number',row?.duration_minutes||90);duration.min=1;duration.max=480;
    const room=input(form,'Room / location','plan-room-'+suffix,'text',row?.room||'',false);
    const objectives=input(form,'Objectives and content','plan-objectives-'+suffix,'textarea',row?.objectives||'',false);
    const materials=input(form,'Materials / links','plan-materials-'+suffix,'textarea',row?.materials||'',false);
    const vocabulary=input(form,'Target vocabulary · one expression per line','plan-vocabulary-'+suffix,'textarea',row?.vocabulary.join('\n')||'',false);
    const constructions=input(form,'Target structures · one per line','plan-constructions-'+suffix,'textarea',row?.constructions.join('\n')||'',false);
    submit(form,row?'Save topic changes':'Save topic');
    form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
      const body={group_id:gid,position:Number(position.value),topic:topic.value.trim(),kind:kind.value,starts_at:date.value?new Date(date.value+':00+03:00').toISOString():null,duration_minutes:Number(duration.value),room:room.value.trim(),objectives:objectives.value.trim(),materials:materials.value.trim(),vocabulary:lines(vocabulary.value),constructions:lines(constructions.value),completed:row?.completed||false};
      await request(row?'/plans/'+row.id:'/plans',row?'PUT':'POST',row?body:{lessons:[body]});await done('Topic saved.');
    });});return form;
  }
  window.MoonPlanning=Object.freeze({render,clear});
})();
