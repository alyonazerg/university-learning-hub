(() => {
  'use strict';
  const n=(tag,text)=>{const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;};
  function render(area,{gid,groups,request,run,done}) {
    const panel=n('details');panel.className='topic-import';panel.append(n('summary','Import lesson topics · CSV / XLS / XLSX'));
    panel.append(n('p','First row: column names. Required: position, topic. Optional: kind, date, time, duration_minutes, objectives, materials. Up to 120 rows, 2 MB. Excel: first visible worksheet. CSV: UTF-8, comma or semicolon separated.'));
    panel.append(n('p','position matches the existing lesson number: matched lessons are updated; new numbers are added. Blank optional cells preserve existing values and dates. kind: lesson, test, imt or extra. Assessment Tests last 90 minutes. Dates: YYYY-MM-DD; times: HH:MM, Moscow time.'));
    const links=n('div');links.className='planning-actions';
    for(const [text,path]of [['Download CSV template','templates/lesson-topics-template.csv'],['Download Excel template','templates/lesson-topics-template.xlsx'],['Download suggested grammar plan','templates/grammar-semester-topics.csv']]){const a=n('a',text);a.href=path;a.download='';a.className='secondary';links.append(a);}panel.append(links);
    const form=n('form'),label=n('label','Topic file');label.className='input-label';label.htmlFor='topic-import-file';const file=n('input');file.id=label.htmlFor;file.type='file';file.accept='.csv,.xls,.xlsx';file.required=true;form.append(label,file);
    const allLabel=n('label'),all=n('input');allLabel.className='topic-import-selection';all.type='checkbox';all.id='topic-import-all';allLabel.append(all,document.createTextNode(' Apply to grammar groups 150, 151 and 154'));form.append(allLabel);
    const preview=n('button','Preview topic import');preview.type='submit';preview.className='secondary';const apply=n('button','Confirm topic import');apply.type='button';apply.className='primary';apply.hidden=true;
    const proposal=n('button','Preview suggested grammar plan');proposal.type='button';proposal.className='secondary';
    const actions=n('div');actions.className='planning-actions';actions.append(preview,proposal);const output=n('div');output.setAttribute('aria-live','polite');let pending=null;
    const reset=()=>{proposal.disabled=!all.checked&&!groups.some(group=>group.id===gid&&group.course_id==='grammar');pending=null;apply.hidden=true;output.replaceChildren();};file.addEventListener('change',reset);all.addEventListener('change',reset);
    async function inspect(filename,bytes) {
      reset();const ids=all.checked?groups.filter(group=>group.course_id==='grammar'&&['150','151','154'].includes(group.name)).map(group=>group.id):[gid];
      if(all.checked&&ids.length!==3)throw new Error('Import grammar groups 150, 151 and 154 first.');
      let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      const body={group_ids:ids,filename,content:btoa(binary)},result=await request('/topic-import/preview','POST',body);
      for(const group of result.groups){output.append(n('h3',group.group+' · '+group.update+' lessons to update · '+group.add+' new topics'));
        const list=n('ol');for(const row of group.topics){const li=n('li',row.position+'. '+row.topic+' · '+row.duration_minutes+' min'+(row.starts_at?' · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',dateStyle:'medium',timeStyle:'short'}).format(new Date(row.starts_at)):' · Date not set'));list.append(li);}output.append(list);}
      pending=body;apply.hidden=false;
    }
    form.addEventListener('submit',event=>{event.preventDefault();run(async()=>{const selected=file.files[0];if(!selected)throw new Error('Choose a topic file.');if(selected.size>2000000)throw new Error('File must be under 2 MB.');await inspect(selected.name,new Uint8Array(await selected.arrayBuffer()));});});
    proposal.addEventListener('click',()=>run(async()=>{const response=await fetch('templates/grammar-semester-topics.csv',{cache:'no-store'});if(!response.ok)throw new Error('Cannot load the suggested plan.');await inspect('grammar-semester-topics.csv',new Uint8Array(await response.arrayBuffer()));}));
    apply.addEventListener('click',()=>run(async()=>{if(!pending)return;await request('/topic-import/apply','POST',pending);await done('Lesson topics imported. Existing dates were preserved unless specified in the file.');}));
    reset();form.append(actions,output,apply);panel.append(form);area.append(panel);
  }
  window.MoonTopicImport={render};
})();
