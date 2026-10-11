(() => {
  'use strict';
  // Reviewed from visible worksheets only. 2026-08-31 is ABOVE in the supplied PDF.
  // [weekday (Monday=0), start time, group, week type, duration in minutes]
  const rules = [
    [0,'09:00','214','above',90],[0,'09:00','217','below',90],
    [0,'10:40','214','above',90],[0,'10:40','213','below',90],
    [0,'12:40','213','above',90],[0,'12:40','151','below',90],
    [0,'14:20','213','above',100],[0,'14:20','150','below',100],
    [0,'16:00','217','above',90],[0,'16:00','154','below',90],
    [2,'09:00','216','above',90],[2,'09:00','216','below',90],
    [2,'10:40','216','above',90],[2,'10:40','216','below',90],
    [2,'12:40','215','above',90],[2,'12:40','214','below',90],
    [2,'14:20','215','above',100],[2,'14:20','213','below',100],
    [2,'16:00','154','above',90],
    [4,'09:00','215','below',90],[4,'10:40','150','above',90],
    [4,'10:40','215','below',90],[4,'12:40','217','above',90],
    [4,'12:40','214','below',90],[4,'14:20','151','above',100],
    [4,'14:20','217','below',100]
  ];
  const dayMs = 86400000;
  const node = (tag,text) => {const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  const course = name => ['150','151','154'].includes(name) ? 'grammar' : 'speech';
  function weeks(from,until) {
    const start=new Date(from+'T12:00:00Z'),end=new Date(until+'T12:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(until)||!Number.isFinite(+start)||!Number.isFinite(+end)||end<start||end-start>366*dayMs)throw new Error('Choose a period of up to one year.');
    const monday=new Date(+start-((start.getUTCDay()+6)%7)*dayMs),anchor=new Date('2026-08-31T12:00:00Z');
    const result=[];
    for(let date=monday;date<=end;date=new Date(+date+7*dayMs))result.push({date:date.toISOString().slice(0,10),type:Math.abs(Math.round((date-anchor)/(7*dayMs)))%2?'below':'above'});
    return result;
  }
  function build(from,until,calendar) {
    const groups=new Map();
    for(const week of calendar)for(const [day,time,name,type,duration]of rules) {
      if(week.type!==type)continue;
      const date=new Date(new Date(week.date+'T12:00:00Z').getTime()+day*dayMs).toISOString().slice(0,10);
      if(date<from||date>until)continue;
      if(!groups.has(name))groups.set(name,{name,course_id:course(name),lessons:[]});
      groups.get(name).lessons.push({topic:course(name)==='grammar'?'Grammar lesson':'Speaking practice',starts_at:new Date(date+'T'+time+':00+03:00').toISOString(),duration_minutes:duration});
    }
    if(!groups.size)throw new Error('No lessons in this period.');
    return {groups:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name))};
  }
  function render(area,{request,run,refresh}) {
    const details=node('details');details.className='semester-import';details.append(node('summary','Import reviewed autumn 2026 schedule'));
    details.append(node('p','Confirmed schedule for groups 150, 151, 154 and 213–217. Above / below weeks follow your PDF. Edit individual weeks before previewing. Holidays are not inferred.'));
    const form=node('form');
    function field(label,id,value) {const wrap=node('div');wrap.className='form-field';const caption=node('label',label);caption.htmlFor=id;caption.className='input-label';const input=node('input');input.id=id;input.type='date';input.value=value;input.required=true;wrap.append(caption,input);form.append(wrap);return input;}
    const from=field('From','semester-from','2026-10-12'),until=field('Until (inclusive)','semester-until','2026-12-29');
    const weekArea=node('div');weekArea.className='semester-weeks';const output=node('div');output.setAttribute('aria-live','polite');
    let calendar=[],pending=null;
    const preview=node('button','Preview groups and lessons');preview.type='submit';preview.className='secondary';
    const save=node('button','Confirm import');save.type='button';save.className='primary';save.hidden=true;
    function reset(){pending=null;save.hidden=true;output.replaceChildren();}
    function calendarView(){reset();weekArea.replaceChildren();try{calendar=weeks(from.value,until.value);}catch(error){output.textContent=error.message;return;}
      for(const week of calendar){const row=node('div');row.className='form-field';const label=node('label','Week of '+week.date);const select=node('select');select.id='week-'+week.date;label.htmlFor=select.id;label.className='input-label';
        for(const [value,text]of [['above','Above · НАД'],['below','Below · ПОД'],['break','No lessons / holiday']]){const option=node('option',text);option.value=value;select.append(option);}select.value=week.type;select.addEventListener('change',()=>{week.type=select.value;reset();});row.append(label,select);weekArea.append(row);}}
    const calendarDetails=node('details');calendarDetails.append(node('summary','Review week calendar'),weekArea);form.append(calendarDetails,preview,output,save);details.append(form);area.append(details);
    from.addEventListener('change',calendarView);until.addEventListener('change',calendarView);calendarView();
    form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{reset();const body=build(from.value,until.value,calendar);const result=await request('/schedule-import/preview','POST',body);
      output.append(node('p',result.add+' lessons to add · '+result.keep+' existing lessons kept.'));
      for(const group of result.groups)output.append(node('p',group.name+' · '+(group.course_id==='grammar'?'Grammar':'Speaking practice')+' · '+group.add+' new lessons'+(group.new_group?' · new group':' · existing group')));
      pending=body;save.hidden=false;
    });});
    save.addEventListener('click',()=>run(async()=>{if(!pending)return;const result=await request('/schedule-import/apply','POST',pending);await refresh();document.getElementById('account-status').textContent='Schedule imported: '+result.add+' lessons added, '+result.keep+' kept.';}));
  }
  window.MoonSemesterSchedule={render,build,weeks};
})();
