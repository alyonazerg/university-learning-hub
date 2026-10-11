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
  function grammarDetails(name,date) {
    const days=[];
    for(const week of weeks('2026-09-16','2026-12-29'))for(const [day,,group,type] of rules) {
      const value=new Date(new Date(week.date+'T12:00:00Z').getTime()+day*dayMs).toISOString().slice(0,10);
      if(group===name&&week.type===type&&value>='2026-09-16'&&value<='2026-12-29')days.push(value);
    }
    const number=days.sort().indexOf(date)+3;
    const checkpoints={8:['Assessment Test 1','Parts of Speech; Noun; Articles.'],13:['Assessment Test 2','Pronoun (including relative clauses); Numeral.'],17:['Assessment Test 3','Adjective; Adverb; comprehensive review.'],18:['Final credit','Pass/fail credit on the eighteenth and final class.']};
    const checkpoint=checkpoints[number];
    return {topic:'Lesson '+number+' · '+(checkpoint?checkpoint[0]:'Grammar'),kind:checkpoint?'test':'lesson',objectives:checkpoint?checkpoint[1]:(number<8?'Parts of Speech; Noun; Articles.':number<13?'Pronoun (including relative clauses); Numeral.':'Adjective; Adverb; comprehensive review.'),position:number};
  }
  function build(from,until,calendar) {
    const groups=new Map();
    for(const week of calendar)for(const [day,time,name,type,duration]of rules) {
      if(week.type!==type)continue;
      const date=new Date(new Date(week.date+'T12:00:00Z').getTime()+day*dayMs).toISOString().slice(0,10);
      if(date<from||date>until||(course(name)==='grammar'&&date<'2026-09-16'))continue;
      if(!groups.has(name))groups.set(name,{name,course_id:course(name),lessons:[]});
      groups.get(name).lessons.push({topic:course(name)==='grammar'?'Grammar lesson':'Speaking practice',starts_at:new Date(date+'T'+time+':00+03:00').toISOString(),duration_minutes:course(name)==='grammar'&&grammarDetails(name,date).kind==='test'?90:duration,...(course(name)==='grammar'?grammarDetails(name,date):{})});
    }
    if(from<='2026-09-12'&&until>='2026-09-12')for(const name of ['150','151','154']) {
      if(!groups.has(name))groups.set(name,{name,course_id:'grammar',lessons:[]});
      for(const [index,time]of ['12:00','13:30'].entries())groups.get(name).lessons.unshift({topic:'Lesson '+(index+1)+' · Grammar',starts_at:new Date('2026-09-12T'+time+':00+03:00').toISOString(),duration_minutes:90,kind:'lesson',position:index+1,objectives:'Parts of Speech; Noun; Articles. Shared introductory block for groups 150, 151 and 154, 12:00–15:00 Moscow time; divided into two plan entries.'});
    }
    if(!groups.size)throw new Error('No lessons in this period.');
    return {groups:[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name))};
  }
  function ical(from,until,calendar) {
    const payload=build(from,until,calendar), stamp=value=>value.replace(/[-:]/g,'').replace('.000','');
    const escape=value=>String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,'\\$&');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Moon Campus//Teacher timetable//EN','CALSCALE:GREGORIAN','X-WR-CALNAME:Moon Campus · Autumn 2026','X-WR-TIMEZONE:Europe/Moscow'];
    const event=(uid,lesson,extra=[])=>['BEGIN:VEVENT','UID:'+uid+'@mooncampus.ru','DTSTAMP:20261011T000000Z',...extra,'DTSTART:'+stamp(lesson.starts_at),'DTEND:'+stamp(new Date(new Date(lesson.starts_at).getTime()+lesson.duration_minutes*60000).toISOString()),'SUMMARY:'+escape(lesson.topic),'DESCRIPTION:'+escape(lesson.objectives||''),'END:VEVENT'];
    for(const [index,[day,time,name,type,duration]]of rules.entries()) {
      const planned=weeks(from,until).filter(w=>w.type===type).map(w=>new Date(new Date(w.date+'T12:00:00Z').getTime()+day*dayMs).toISOString().slice(0,10)).filter(d=>d>=from&&d<=until&&(course(name)!=='grammar'||d>='2026-09-16'));
      if(!planned.length)continue;
      const uid='autumn-2026-'+name+'-'+index, start=new Date(planned[0]+'T'+time+':00+03:00').toISOString();
      const base={starts_at:start,duration_minutes:duration,topic:(course(name)==='grammar'?'Grammar':'Speaking practice')+' · Group '+name,objectives:'Moscow time. '+(type==='above'?'НАД':'ПОД')+' week.'};
      const actual=payload.groups.find(g=>g.name===name)?.lessons||[], exclusions=[], overrides=[];
      for(const date of planned) {
        const starts=new Date(date+'T'+time+':00+03:00').toISOString(),lesson=actual.find(l=>l.starts_at===starts);
        if(!lesson)exclusions.push(stamp(starts));
        else if(lesson.kind==='test')overrides.push(...event(uid,{...lesson,topic:lesson.topic+' · Group '+name},['RECURRENCE-ID:'+stamp(starts)]));
      }
      lines.push(...event(uid,base,['RRULE:FREQ=WEEKLY;INTERVAL=2;UNTIL='+until.replace(/-/g,'')+'T205959Z',...(exclusions.length?['EXDATE:'+exclusions.join(',')]:[])]),...overrides);
    }
    if(from<='2026-09-12'&&until>='2026-09-12')lines.push(...event('autumn-2026-shared-introduction',{starts_at:'2026-09-12T09:00:00.000Z',duration_minutes:180,topic:'Grammar · Groups 150, 151, 154 · Lessons 1–2',objectives:'Shared introductory block. Two classes, exceptionally 12:00–15:00 Moscow time.'}));
    lines.push('END:VCALENDAR');
    // RFC 5545 limits physical lines to 75 UTF-8 octets.
    return lines.map(line=>{let parts=[],part='',bytes=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(bytes+size>75){parts.push(part);part=' ';bytes=1;}part+=ch;bytes+=size;}parts.push(part);return parts.join('\r\n');}).join('\r\n')+'\r\n';
  }
  function render(area,{request,run,refresh}) {
    const details=node('details');details.className='semester-import';details.append(node('summary','Import reviewed autumn 2026 schedule'));
    details.append(node('p','Confirmed schedule for groups 150, 151, 154 and 213–217. Above / below weeks follow your PDF. Edit individual weeks before previewing. Includes the shared introductory block on 12 September, three full-class tests and credit on class 18. Test 2 and 3 dates are provisional: edit them in the teaching plan after import. Holidays are not inferred.'));
    const form=node('form');
    function field(label,id,value) {const wrap=node('div');wrap.className='form-field';const caption=node('label',label);caption.htmlFor=id;caption.className='input-label';const input=node('input');input.id=id;input.type='date';input.value=value;input.required=true;wrap.append(caption,input);form.append(wrap);return input;}
    const from=field('From','semester-from','2026-09-12'),until=field('Until (inclusive)','semester-until','2026-12-29');
    const weekArea=node('div');weekArea.className='semester-weeks';const output=node('div');output.setAttribute('aria-live','polite');
    let calendar=[],pending=null;
    const preview=node('button','Preview groups and lessons');preview.type='submit';preview.className='secondary';
    const save=node('button','Confirm import');save.type='button';save.className='primary';save.hidden=true;
    function reset(){pending=null;save.hidden=true;output.replaceChildren();}
    function calendarView(){reset();weekArea.replaceChildren();try{calendar=weeks(from.value,until.value);}catch(error){output.textContent=error.message;return;}
      for(const week of calendar){const row=node('div');row.className='form-field';const label=node('label','Week of '+week.date);const select=node('select');select.id='week-'+week.date;label.htmlFor=select.id;label.className='input-label';
        for(const [value,text]of [['above','Above · НАД'],['below','Below · ПОД'],['break','No lessons / holiday']]){const option=node('option',text);option.value=value;select.append(option);}select.value=week.type;select.addEventListener('change',()=>{week.type=select.value;reset();});row.append(label,select);weekArea.append(row);}}
    const calendarDetails=node('details');calendarDetails.append(node('summary','Review week calendar'),weekArea);const download=node('button','Download Google Calendar (.ics)');download.type='button';download.className='secondary';
    download.addEventListener('click',()=>{try{const url=URL.createObjectURL(new Blob([ical(from.value,until.value,calendar)],{type:'text/calendar;charset=utf-8'}));const link=node('a');link.href=url;link.download='moon-campus-autumn-2026.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){output.textContent=error.message;}});
    form.append(calendarDetails,preview,download,output,save);details.append(form);area.append(details);
    from.addEventListener('change',calendarView);until.addEventListener('change',calendarView);calendarView();
    form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{reset();const body=build(from.value,until.value,calendar);const result=await request('/schedule-import/preview','POST',body);
      output.append(node('p',result.add+' lessons to add · '+result.keep+' existing lessons kept.'+(result.update?' '+result.update+' generic lessons updated.':'')));
      for(const group of result.groups)output.append(node('p',group.name+' · '+(group.course_id==='grammar'?'Grammar':'Speaking practice')+' · '+group.add+' new lessons'+(group.new_group?' · new group':' · existing group')));
      pending=body;save.hidden=false;
    });});
    save.addEventListener('click',()=>run(async()=>{if(!pending)return;const result=await request('/schedule-import/apply','POST',pending);await refresh();document.getElementById('account-status').textContent='Schedule imported: '+result.add+' lessons added, '+result.keep+' kept.'+(result.update?' '+result.update+' generic lessons updated.':'');}));
  }
  window.MoonSemesterSchedule={render,build,weeks,ical};
})();
