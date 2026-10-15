(() => {
  const n=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
  window.MoonGroupSettings={mount(article,{group,groups,request,refresh,run}){
    const form=n('form',undefined,'group-settings-form'),nameLabel=n('label','Group name'),name=n('input'),courseLabel=n('label','Course'),course=n('select');
    name.value=group.name;name.required=true;name.maxLength=120;nameLabel.append(name);
    for(const item of window.MoonCourses){const o=n('option',item.name);o.value=item.id;course.append(o)}course.value=group.course_id;courseLabel.append(course);
    const save=n('button','Save group','secondary');save.type='submit';form.append(nameLabel,courseLabel,save);article.append(form);
    form.onsubmit=e=>{e.preventDefault();run(async()=>{await request('/groups/'+group.id,'PUT',{name:name.value,course_id:course.value});await refresh();document.getElementById('account-status').textContent='Group saved. Existing work and marks are preserved.'})};
    const roster=n('details',undefined,'group-roster');roster.append(n('summary',`Students · ${group.students.length} active`),n('p','Move a student to another group or pause their access. Their work and marks are kept. Membership changes sign the student out; they can sign in again once access is active.','muted'));
    const students=[...group.students.map(s=>({...s,active:true})),...(group.inactive_students||[]).map(s=>({...s,active:false}))];
    if(!students.length)roster.append(n('p','No students yet. Use Invite students below to register them.','muted'));
    for(const student of students){
      const row=n('form',undefined,'group-student-row'),alias=n('strong',student.pseudonym),targetLabel=n('label','Group'),target=n('select'),accessLabel=n('label','Access'),access=n('select');
      target.setAttribute('aria-label','Group for '+student.pseudonym);access.setAttribute('aria-label','Access for '+student.pseudonym);
      for(const g of groups){const o=n('option',g.name);o.value=g.id;target.append(o)}target.value=String(group.id);targetLabel.append(target);
      for(const [value,label] of [['active','Active'],['paused','Paused']]){const o=n('option',label);o.value=value;access.append(o)}access.value=student.active?'active':'paused';accessLabel.append(access);
      const apply=n('button','Save student','secondary');apply.type='submit';row.append(alias,targetLabel,accessLabel,apply);roster.append(row);
      row.onsubmit=e=>{e.preventDefault();run(async()=>{await request(`/groups/${group.id}/students/${encodeURIComponent(student.id)}`,'PUT',{group_id:Number(target.value),is_active:access.value==='active'});await refresh();document.getElementById('account-status').textContent='Student membership saved. Work and marks are preserved.'})};
    }
    article.append(roster);
  }};
})();
