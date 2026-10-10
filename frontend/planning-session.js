(() => {
  'use strict';
  const kinds = {lesson:'Занятие',test:'Срез / тест',imt:'IMT',extra:'Extra task'};
  const n = (tag, text, cls) => {const element=document.createElement(tag); if(text!==undefined)element.textContent=text;if(cls)element.className=cls;return element;};
  const format = value => new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
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
    timetable.replaceChildren(n('h2','Расписание'));planning.replaceChildren(n('h2','Календарно-тематический план'));
    if(plans===null) {timetable.append(n('p',profile.role==='admin'?'Новый раздел требует обновления сервера. Остальной кабинет продолжает работать.':'Расписание пока недоступно.','muted'));return;}
    const done=async message=>{await refresh();document.getElementById('account-status').textContent=message;};
    if(profile.role==='admin') {
      if(!groups.length){timetable.append(n('p','Сначала создай группу в разделе «Группы».'));planning.append(n('p','План составляется для конкретной группы.'));return;}
      if(!groups.some(group=>String(group.id)===selectedGroup))selectedGroup=String(groups[0].id);
      const picker=n('div',undefined,'planning-toolbar');const group=select(picker,'Группа','planning-group-filter',groups.map(item=>[item.id,item.name]),selectedGroup);
      group.addEventListener('change',()=>{selectedGroup=group.value;render(plans,{profile,groups,request,run,refresh});});timetable.append(picker);
      const planPicker=picker.cloneNode(true); const planSelect=planPicker.querySelector('select');planSelect.id='plan-group-filter';planPicker.querySelector('label').htmlFor=planSelect.id;planSelect.value=selectedGroup;planSelect.addEventListener('change',()=>{selectedGroup=planSelect.value;render(plans,{profile,groups,request,run,refresh});});planning.append(planPicker);
    } else selectedGroup=String(profile.group_id);
    const gid=Number(selectedGroup), rows=plans.filter(row=>row.group_id===gid), groupName=groups.find(group=>group.id===gid)?.name||'';
    timetable.append(n('p',(groupName?groupName+' · ':'')+'Время занятий — по Москве.','muted'));
    const dated=rows.filter(row=>row.starts_at).sort((a,b)=>new Date(a.starts_at)-new Date(b.starts_at));
    if(!dated.length)timetable.append(n('p','Занятия с датами пока не добавлены.'));
    for(const row of dated){const article=n('article',undefined,'schedule-card');article.append(n('strong',format(row.starts_at)),n('p',row.topic),n('span',row.duration_minutes+' мин.'+(row.room?' · '+row.room:''),'muted'));timetable.append(article);}
    if(profile.role==='admin')renderWeekly(timetable,gid,rows,request,run,done);
    planning.append(n('p',(groupName?groupName+' · ':'')+'Темы можно подготовить заранее без дат и распределить по занятиям позже.','muted'));
    if(profile.role==='admin'){
      const details=n('details');details.append(n('summary','Добавить тему в план'));details.append(editor(null,gid,rows,request,run,done));planning.append(details);
      const bulk=n('details');bulk.append(n('summary','Добавить список тем'));const form=n('form');
      const topics=input(form,'По одной теме на строку · до 120 тем','plan-bulk-topics','textarea');
      submit(form,'Сохранить список тем');form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
        const values=lines(topics.value);if(!values.length||values.length>120||values.some(topic=>topic.length>200))throw new Error('Добавь от 1 до 120 тем, каждая до 200 символов.');
        const start=Math.max(0,...rows.map(row=>row.position));
        await request('/plans','POST',{lessons:values.map((topic,index)=>({group_id:gid,topic,position:start+index+1}))});await done('Список тем сохранён. Даты можно назначить позже.');
      });});bulk.append(form);planning.append(bulk);
    }
    if(!rows.length)planning.append(n('p','Темы пока не добавлены.'));
    for(const row of rows.slice().sort((a,b)=>a.position-b.position||(a.starts_at||'').localeCompare(b.starts_at||''))){
      const article=n('article',undefined,'word-list-card');article.dataset.planId=row.id;
      article.append(n('h3',row.position+'. '+row.topic),n('p',kinds[row.kind]+' · '+(row.starts_at?format(row.starts_at):'Дата не назначена')+' · '+row.duration_minutes+' мин.'+(row.completed?' · Проведено':'')));
      if(row.objectives)article.append(n('p','Цели: '+row.objectives,'coursework-text'));
      if(row.materials)article.append(n('p','Материалы: '+row.materials,'coursework-text'));
      if(row.vocabulary.length)article.append(n('p','Лексика: '+row.vocabulary.join('; ')));
      if(row.constructions.length)article.append(n('p','Конструкции: '+row.constructions.join('; ')));
      if(profile.role==='admin'){
        const details=n('details');details.append(n('summary','Редактировать тему'));details.append(editor(row,gid,rows,request,run,done));article.append(details);
        article.append(button(row.completed?'Вернуть в план':'Отметить проведённым',async()=>{await request('/plans/'+row.id,'PUT',{...planBody(row),completed:!row.completed});await done('План обновлён.');},run));
        if(row.starts_at)article.append(button(row.attendance_lesson_id?'Открыть посещаемость':'Создать журнал посещаемости',async()=>{const result=await request('/plans/'+row.id+'/attendance','POST');await done('Журнал занятия готов.');window.MoonCabinet?.show('connected-attendance');document.querySelector('[data-lesson-id="'+result.lesson_id+'"]')?.scrollIntoView({behavior:'smooth',block:'start'});},run));
      }
      planning.append(article);
    }
  }
  function renderWeekly(area,gid,rows,request,run,done) {
    const details=n('details');details.append(n('summary','Добавить регулярное расписание'));const form=n('form');form.id='weekly-schedule-form';
    const weekday=select(form,'День недели','weekly-day',[[1,'Понедельник'],[2,'Вторник'],[3,'Среда'],[4,'Четверг'],[5,'Пятница'],[6,'Суббота'],[0,'Воскресенье']]);
    const time=input(form,'Начало · Москва','weekly-time','time','09:00');
    const today=MoonPlanningModel.localInput(new Date().toISOString()).slice(0,10);
    const from=input(form,'С какой даты','weekly-from','date',today),until=input(form,'По какую дату','weekly-until','date',today);
    const duration=input(form,'Длительность · минуты','weekly-duration','number','90');duration.min=1;duration.max=480;
    const room=input(form,'Аудитория / место (необязательно)','weekly-room','text','',false);
    form.append(n('p','Будут созданы занятия на выбранный день недели. Темы и материалы можно заполнить в плане. Для другого дня недели добавь отдельное расписание.','muted'));
    submit(form,'Добавить расписание');form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
      const dates=MoonPlanningModel.weeklyDates(from.value,until.value,Number(weekday.value),time.value);
      const start=Math.max(0,...rows.map(row=>row.position));
      await request('/plans','POST',{lessons:dates.map((date,index)=>({group_id:gid,position:start+index+1,topic:'Занятие',starts_at:date,duration_minutes:Number(duration.value),room:room.value.trim()}))});await done('Расписание сохранено. Темы доступны в плане.');
    });});details.append(form);area.append(details);
  }
  function editor(row,gid,rows,request,run,done) {
    const suffix=row?.id||'new',form=n('form');form.dataset.planEditor=suffix;
    const position=input(form,'Номер темы','plan-position-'+suffix,'number',row?.position||Math.max(0,...rows.map(item=>item.position))+1);position.min=1;position.max=10000;
    const topic=input(form,'Тема занятия','plan-topic-'+suffix,'text',row?.topic||'');
    const kind=select(form,'Тип','plan-kind-'+suffix,Object.entries(kinds),row?.kind||'lesson');
    const date=input(form,'Дата и время · Москва (можно заполнить позже)','plan-date-'+suffix,'datetime-local',MoonPlanningModel.localInput(row?.starts_at),false);
    if(row?.attendance_lesson_id){date.readOnly=true;topic.readOnly=true;form.append(n('p','Дата и тема связаны с созданным журналом посещаемости.','muted'));}
    const duration=input(form,'Длительность · минуты','plan-duration-'+suffix,'number',row?.duration_minutes||90);duration.min=1;duration.max=480;
    const room=input(form,'Аудитория / место','plan-room-'+suffix,'text',row?.room||'',false);
    const objectives=input(form,'Цели и содержание','plan-objectives-'+suffix,'textarea',row?.objectives||'',false);
    const materials=input(form,'Материалы / ссылки','plan-materials-'+suffix,'textarea',row?.materials||'',false);
    const vocabulary=input(form,'Целевая лексика · по одному выражению на строку','plan-vocabulary-'+suffix,'textarea',row?.vocabulary.join('\n')||'',false);
    const constructions=input(form,'Целевые конструкции · по одной на строку','plan-constructions-'+suffix,'textarea',row?.constructions.join('\n')||'',false);
    submit(form,row?'Сохранить изменения темы':'Сохранить тему');
    form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{
      const body={group_id:gid,position:Number(position.value),topic:topic.value.trim(),kind:kind.value,starts_at:date.value?new Date(date.value+':00+03:00').toISOString():null,duration_minutes:Number(duration.value),room:room.value.trim(),objectives:objectives.value.trim(),materials:materials.value.trim(),vocabulary:lines(vocabulary.value),constructions:lines(constructions.value),completed:row?.completed||false};
      await request(row?'/plans/'+row.id:'/plans',row?'PUT':'POST',row?body:{lessons:[body]});await done('Тема сохранена.');
    });});return form;
  }
  window.MoonPlanning=Object.freeze({render,clear});
})();
