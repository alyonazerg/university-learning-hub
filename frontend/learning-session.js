(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => {const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element;};
  let base = '', token = null, profile = null, busy = false, generation = 0;
  const configured = window.MOON_CAMPUS_API_BASE || '';
  try {
    if (configured) {const url = new URL(configured); if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error(); base = url.href.replace(/\/$/, '');}
  } catch { $('connection-state').textContent = 'The server address is invalid. Contact your administrator.'; }
  const initData = () => window.Telegram?.WebApp?.initData || '';
  const messages = {
    'Lessons overlap in this group': 'Lessons in this group overlap. Check the schedule.',
    'Lesson already has an attendance journal': 'An attendance register already exists for this lesson. Its date and topic cannot be changed.',
    'Attendance topic differs; review the existing journal': 'An attendance register with another topic already exists at that time. Check attendance.',
    'Plan group cannot be changed': 'You cannot change the group of an existing topic.',
    'Set a lesson date first': 'Set a lesson date first.',
    'Invalid or expired Telegram authentication': 'Your Telegram sign-in has expired. Reopen the app.',
    'Registered student required': 'Register using your teacher’s invitation first.',
    'Administrator access required': 'Access denied or incorrect teacher key.',
    'Appointed card editor required': 'Only the assigned editor can prepare full cards. You can suggest a simple word list.',
    'Card is not due yet': 'This card has already been reviewed. Refresh the queue.',
    'Review already recorded': 'This review has already been recorded. Refresh the queue.',
    'Published deck cannot be rewritten': 'Published lists cannot be overwritten because students already have progress on their cards.',
    'Session expired': 'Your session has expired. Sign in again.',
    'Telegram authentication is not configured': 'Telegram sign-in has not been configured on the server yet.',
    'Group already exists': 'A group with this name already exists.', 'Group not found': 'This group is unavailable.', 'Student unavailable': 'Student access has been disabled.',
    'Choose groups from one course': 'Choose groups from the same course.',
    'Compensation must use groups of its checkpoint': 'Make-up work must use groups from the selected Assessment Test.',
    'Compensation access required': 'Make-up work requires approval after your certificate has been checked.',
    'Task has not started': 'The submission period has not started yet.',
    'All three attempts used': 'All three attempts have been used.',
    'Task not found': 'This assignment is unavailable.',
    'Student not found in this group': 'Student not found in this group.',
    'Lesson already exists at this time': 'This group already has a lesson at that time.',
    'Submission changed concurrently; refresh': 'Your work may already have been saved. Refresh the hub before submitting again.',
    'Access changed concurrently; refresh': 'Approval was changed in another window. Refresh the hub.',
    'Existing group has another course or is inactive': 'A matching group has a different course or is inactive. Check Groups before importing.',
    'Schedule changed concurrently; preview again': 'The schedule changed. Preview the import again.',
    'Attendance changed concurrently; refresh': 'Attendance was changed in another window. Refresh the hub.'
  };
  async function request(path, method = 'GET', body) {
    if (!base) throw new Error('The learning server is not connected yet. The demo is available.');
    const response = await fetch(base + '/learning' + path, {method, cache: 'no-store', headers: {...(body ? {'Content-Type': 'application/json'} : {}), ...(token ? {Authorization: 'Bearer ' + token} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
    if (!response.ok) {
      let detail; try {detail = (await response.json()).detail;} catch { /* generic message below */ }
      if (response.status === 404 && path === '/plans') return null;
      if (response.status === 404 && path.startsWith('/schedule-import/')) throw new Error('Update the server to import the semester schedule.');
      if (response.status === 404 && path.endsWith('/invitations')) throw new Error('Update the server to create invitations.');
      if ((response.status === 401 || (path === '/me' && [403, 404].includes(response.status))) && token) clearSession();
      throw new Error(messages[detail] || (response.status === 422 ? 'Check the fields, dates and data format.' : 'Could not complete the action. Try again.'));
    }
    return response.status === 204 ? null : response.json();
  }
  async function audioRequest(path,{method='GET',body,headers={},blob=false}={}){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),180000);
    try{const response=await fetch(base+'/learning'+path,{method,body,signal:controller.signal,cache:'no-store',headers:{...headers,Authorization:'Bearer '+token}});if(!response.ok){let detail;try{detail=(await response.json()).detail;}catch{}if(response.status===401)clearSession();const error=Error(typeof detail==='string'?detail:'Audio request failed');error.status=response.status;throw error;}return blob?response.blob():response.json();}finally{clearTimeout(timer);}
  }
  function updateControls() {
    document.querySelectorAll('button, input, textarea, select').forEach(element => {element.disabled = busy || !base || element.dataset.unavailable === 'true';});
    $('telegram-sign-in').disabled = busy || !base || !initData();
    if (profile?.role === 'admin') $('connected-save').disabled = busy || !$('connected-group').options.length;
  }
  async function run(action) {
    if (busy) return;
    busy = true; const feedback=window.MoonActionFeedback?.begin(); let succeeded=false; updateControls(); $('account-status').textContent = '';
    try {await action();succeeded=true;} catch (error) {$('account-status').textContent = error instanceof TypeError ? 'Could not reach the learning server. Check your connection and try again.' : error.message;}
    finally {busy = false; updateControls();feedback?.(succeeded,$('account-status').textContent);}
  }
  function button(text, action) {const element = node('button', text, 'secondary'); element.type = 'button'; element.addEventListener('click', () => run(action)); return element;}
  const sessionKey='moon-learning-session:'+base;
  function storeSession(result){try{sessionStorage.setItem(sessionKey,JSON.stringify({token:result.access_token,expires_at:Date.now()+result.expires_in*1000}));}catch{}}
  function clearSession() {
    window.MoonSpeakingAudio?.stopAll();
    try{sessionStorage.removeItem(sessionKey);}catch{}generation++; token = null; profile = null; $('workspace').hidden = true; $('sign-in').hidden = false;
    $('connected-decks').replaceChildren(); $('connected-study').replaceChildren(); $('group-editors').replaceChildren(); $('connected-group').replaceChildren();
    $('connected-deck-form').reset(); $('connected-group-form').reset(); $('admin-key').value = ''; $('account-name').textContent = 'Learning hub';
    MoonCoursework.clear(); MoonRevisions.clear();
    MoonPlanning.clear(); activeSection = ''; $('connection-info').hidden = false;
  }
  const cabinetSections = {
    'connected-groups': ['connected-groups'],
    'connected-schedule': ['connected-schedule'],
    'connected-planning': ['connected-planning'],
    'connected-vocabulary-editor': ['connected-decks', 'connected-study', 'connected-vocabulary-editor'],
    'connected-coursework': ['connected-coursework'],
    'connected-attendance': ['connected-attendance'],
    'connected-revisions': ['connected-revisions']
  };
  let activeSection = '';
  function showSection(id, focus = false) {
    if (!cabinetSections[id] || (id === 'connected-groups' && profile?.role !== 'admin')) id = 'connected-schedule';
    activeSection = id;
    const visible = cabinetSections[id];
    for (const section of Object.values(cabinetSections).flat()) $(section).classList.toggle('cabinet-inactive', !visible.includes(section));
    document.querySelectorAll('.dashboard-links a').forEach(link => {
      const selected = link.hash === '#' + id;
      if (selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      if(link.hash==='#connected-revisions')link.textContent=profile?.role==='admin'?'Revision Tests':'My results';
      link.hidden = link.hash === '#connected-groups' && profile?.role !== 'admin';
    });
    if (focus) {const heading = $(visible[0]).querySelector('h2'); if (heading) {heading.tabIndex = -1; heading.focus({preventScroll:true});} $(visible[0]).scrollIntoView({block:'start'});}
  }
  window.MoonCabinet = {show: id => showSection(id, true)};
  document.querySelectorAll('.dashboard-links a').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); history.replaceState(null, '', link.hash); showSection(link.hash.slice(1), true);
  }));
  window.addEventListener('hashchange', () => {if (profile) showSection(location.hash.slice(1), true);});
  async function refresh() {
    const version = generation;
    const me = await request('/me');
    const [decks, extra, coursework, plans, revisions] = await Promise.all([request('/decks'), request(me.role === 'admin' ? '/groups' : '/study'), MoonCoursework.load(request, me), request('/plans'), MoonRevisions.load(request, me)]);
    if (version !== generation || !token) return;
    profile = me; $('sign-in').hidden = true; $('workspace').hidden = false;
    $('account-name').textContent = me.role === 'admin' ? 'Teacher' : me.pseudonym;
    $('connected-groups').hidden = me.role !== 'admin'; $('connected-group-field').hidden = me.role !== 'admin';
    $('connected-editor-title').textContent = me.role === 'admin' ? 'Prepare target vocabulary' : 'Suggest emergent vocabulary';
    $('connected-editor-hint').textContent = me.role === 'admin' ? 'Choose a group. The list will be saved and shared with its students.' : me.is_card_editor ? 'You are your group’s vocabulary editor. Prepare full cards as JSON; your teacher publishes them.' : 'Suggest words with meanings and examples. Your teacher will review them before publishing.';
    $('connected-save').textContent = me.role === 'admin' ? 'Save for group' : 'Submit for review';
    if (me.role === 'admin') {
      renderGroups(extra);
      let imt=$('connected-imt');if(!imt){imt=node('section',undefined,'members-panel');imt.id='connected-imt';$('workspace').append(imt);const link=node('a','IMT');link.href='#connected-imt';document.querySelector('#workspace .dashboard-links').append(link)}
      imt.replaceChildren(node('h2','IMT results'),node('p','Student materials, submissions and teacher review.','muted'));
      const output=node('div',undefined,'invitation-results');imt.append(button('Refresh IMT results',async()=>{const rows=(await request('/imt/collections')).filter(r=>r.entries?.length||Object.keys(r.attempt?.responses||{}).length);output.replaceChildren();if(!rows.length){output.append(node('p','No IMT submissions yet.'));return}const table=node('table');const head=node('tr');['Student','Group','Status','Result'].forEach(x=>head.append(node('th',x)));table.append(head);for(const row of rows){const tr=node('tr');[row.student_name,row.group,({draft:'Not submitted',submitted:'Awaiting review',approved:'Ready for tasks',assessment:'In progress',reviewed:'Reviewed',changes_requested:'Changes requested',rejected:'Not approved'}[row.status]||'Pending'),row.result?.approved_grade??'Pending'].forEach(x=>tr.append(node('td',String(x))));table.append(tr);const details=node('details');details.append(node('summary',row.student_name+' · material and answers'));const material=node('table');const mh=node('tr');['Expression','Meaning','Example'].forEach(x=>mh.append(node('th',x)));material.append(mh);for(const entry of row.entries||[]){const mr=node('tr');[entry.expression,entry.meaning,entry.example].forEach(x=>mr.append(node('td',x||'—')));material.append(mr)}details.append(material);if(row.result?.ai_review){details.append(node('h3','AI suggestion: '+row.result.ai_review.suggested_grade+' / 3'),node('p',row.result.ai_review.feedback));for(const item of row.result.ai_review.items||[])details.append(node('p',(row.entries[item.index]?.expression||'Expression')+': '+item.feedback+(item.correction?' Suggested: '+item.correction:'')))}if(row.status==='submitted'&&row.result?.review_status!=='answers_pending')details.append(button('Approve material and unlock tasks',async()=>{await request('/imt/collections/'+row.id+'/review','POST',{status:'approved'});$('account-status').textContent='Material approved. Student tasks unlocked.'}));const answers=Object.values(row.attempt?.responses||{});if(answers.length){details.append(node('h3','Student answers'));answers.forEach((answer,i)=>details.append(node('p',(i+1)+'. '+(answer.response||'No written response'))))}else details.append(node('p','No task answers submitted yet.','muted'));if(row.result?.teacher_feedback)details.append(node('p',row.result.teacher_feedback));if(row.status==='submitted'&&answers.length){const label=node('label','Final mark (0–3)');const mark=node('input');mark.type='text';mark.inputMode='numeric';mark.pattern='[0-3]';mark.maxLength=1;label.append(mark);details.append(label,button('Save final mark',async()=>{if(!/^[0-3]$/.test(mark.value))throw Error('Enter an integer from 0 to 3');await request('/imt/collections/'+row.id+'/grade','PUT',{approved_grade:Number(mark.value),reason:'Teacher review of IMT and task answers',feedback:''});$('account-status').textContent='Final IMT result saved.'}))} output.append(details)}output.prepend(table)}),output);
    }
    renderDecks(decks);
    $('connected-study').hidden = me.role !== 'student';
    if (me.role === 'student') {
      renderStudy(extra);
      window.MoonMyImt.render({request,audioRequest:(path,opts)=>audioRequest(path.replace(/^\/learning/,''),opts),run});
      let tg=$('telegram-link-panel');if(!tg){tg=node('section',undefined,'members-panel');tg.id='telegram-link-panel';$('workspace').append(tg)}
      tg.replaceChildren(node('h2','Connect Telegram'),node('p','Connect your Telegram account to sign in with it later.','muted'));
      window.moonLinkTelegram=data=>run(async()=>{await request('/account/link-telegram','POST',{telegram_data:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v)]))});tg.replaceChildren(node('h2','Telegram connected'),node('p','You can now use Telegram to sign in to this profile.'))});
      const script=document.createElement('script');script.async=true;script.src='https://telegram.org/js/telegram-widget.js?22';script.dataset.telegramLogin='mooncampusbot';script.dataset.size='large';script.dataset.onauth='moonLinkTelegram(user)';tg.append(script);
    }
    MoonCoursework.render(coursework, {profile: me, groups: me.role === 'admin' ? extra : [], request, run, refresh});
    MoonRevisions.render(revisions, {profile: me, request, audioRequest, run, refresh});
    MoonPlanning.render(plans, {profile: me, groups: me.role === 'admin' ? extra : [], request, run, refresh});
    $('connection-info').hidden = true;
    showSection(activeSection || location.hash.slice(1) || (me.role === 'admin' && !extra.length ? 'connected-groups' : 'connected-schedule'));
  }
  function renderGroups(groups) {
    const previous = $('connected-group').value;
    $('connected-group').replaceChildren(); $('group-editors').replaceChildren();
    for (const group of groups) {
      const course = window.MoonCourses.find(item => item.id === group.course_id)?.name || group.course_id;
      const option = node('option', group.name + ' · ' + course); option.value = group.id; $('connected-group').append(option);
      const article = node('article', undefined, 'word-list-card'); article.append(node('h3', group.name), node('p', course));
      const label = node('label', 'Vocabulary editor', 'input-label'); label.htmlFor = 'editor-' + group.id;
      const select = node('select'); select.id = label.htmlFor;
      const none = node('option', 'Teacher only'); none.value = ''; select.append(none);
      for (const student of group.students) {const item = node('option', student.pseudonym); item.value = student.id; select.append(item);}
      select.value = group.editor_student_id || '';
      article.append(label, select, button('Save editor · ' + group.name, async () => {await request('/groups/' + group.id + '/editor', 'PUT', {student_id: select.value || null}); await refresh(); $('account-status').textContent = 'Group editor saved.';}));
      const invitations = node('details', undefined, 'student-invitation'); invitations.append(node('summary', 'Invite students'));
      const names=node('textarea'); names.placeholder='Optional names, one per line'; names.setAttribute('aria-label','Student names');
      const count=node('input');count.type='number';count.min='1';count.max='100';count.value='1';count.setAttribute('aria-label','Number of invitations');
      const result=node('div',undefined,'invitation-results');
      const fields=node('div',undefined,'invitation-fields');
      const namesLabel=node('label','Student names (optional)','invitation-field');namesLabel.append(names);
      const countLabel=node('label','Number of invitations','invitation-field invitation-count');countLabel.append(count);
      const hint=node('small','Used when the names list is empty.');countLabel.append(hint);
      fields.append(namesLabel,countLabel);
      invitations.append(node('p','Create personal links for this group. Each link works once and expires after 14 days.','muted'),fields);
      const actions=node('div',undefined,'invitation-actions');
      const table=rows=>{const t=node('table');const head=node('tr');['Student','Status','Invitation / alias'].forEach(x=>head.append(node('th',x)));t.append(head);for(const r of rows){const tr=node('tr');tr.append(node('td',r.label),node('td',r.status));const cell=node('td');if(r.link){const field=node('input');field.readOnly=true;field.value=location.origin+r.link;const copy=button('Copy link',async()=>{try{await navigator.clipboard.writeText(field.value);copy.textContent='Copied';}catch{field.focus();field.select();$('account-status').textContent='Select and copy the link.'}});const tools=node('div',undefined,'invitation-link-tools');tools.append(field,copy);cell.append(tools)}else cell.textContent=r.alias||'—';tr.append(cell);t.append(tr)}result.replaceChildren(t)};
      actions.append(button('Create invitations',async()=>{const list=names.value.split(/\n/).map(x=>x.trim()).filter(Boolean);const rows=await request('/groups/'+group.id+'/browser-invitations','POST',{names:list,count:Number(count.value)});table(rows);const text=rows.map(r=>r.label+'\t'+location.origin+r.link).join('\n');result.append(button('Copy all links',async()=>{await navigator.clipboard.writeText(text);$('account-status').textContent='Invitation links copied.'}),button('Download CSV',async()=>{const quote=x=>'"'+String(x).replace(/"/g,'""')+'"';const csv='Student,Link,Status\r\n'+rows.map(r=>[r.label,location.origin+r.link,r.status].map(quote).join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=node('a');a.href=u;a.download='invitations.csv';a.click();URL.revokeObjectURL(u)}));}),button('Registration status',async()=>table(await request('/groups/'+group.id+'/browser-invitations')))); invitations.append(actions,result); article.append(invitations); $('group-editors').append(article);
    }
    if ([...$('connected-group').options].some(option => option.value === previous)) $('connected-group').value = previous;
    if (!groups.length) $('group-editors').append(node('p', 'No groups yet.'));
  }
  function renderDecks(decks) {
    const area = $('connected-decks'); area.replaceChildren(node('h2', 'Saved lists'));
    if (!decks.length) area.append(node('p', 'No lists yet.'));
    for (const deck of decks) {
      const article = node('article', undefined, 'word-list-card'); article.append(node('h3', deck.title), node('p', deck.status === 'approved' ? 'Approved' : 'Pending review'), node('p', deck.source));
      const words = node('ul'); deck.cards.forEach(card => words.append(node('li', card.term + ' — ' + card.meaning))); article.append(words);
      if (profile.role === 'admin' && deck.status === 'pending') {
        for (const card of deck.cards) {const preview = node('details'); preview.append(node('summary', 'Review card: ' + card.term), node('p', card.definition), node('p', card.transcription), node('p', 'Syn: ' + card.synonyms.join(', ')), node('p', 'Ant: ' + card.antonyms.join(', ')), node('p', 'Coll: ' + card.collocations.join(', ')), node('p', card.example)); article.append(preview);}
        article.append(button('Edit · ' + deck.title, async () => {
          const form = node('form'), label = node('label', 'Reviewed card draft · JSON', 'input-label');
          const input = node('textarea'); input.id = 'draft-' + deck.id; input.maxLength = 15000; input.rows = 8; input.required = true; label.htmlFor = input.id;
          input.value = JSON.stringify(deck.cards.map(({id, ...content}) => content), null, 2);
          const save = node('button', 'Save corrections', 'secondary'); save.type = 'submit';
          form.append(label, input, save); form.addEventListener('submit', event => {event.preventDefault(); run(async () => {
            await request('/decks/' + deck.id, 'PUT', {title: deck.title, source: deck.source, group_id: deck.group_id, cards: MoonLearning.parseList(input.value)});
            await refresh(); $('account-status').textContent = 'Draft updated. You can now approve the list.';
          });});
          const old = article.querySelector('form'); if (old) old.remove(); article.append(form); input.focus();
        }));
        article.append(button('Approve · ' + deck.title, async () => {await request('/decks/' + deck.id + '/approve', 'POST'); await refresh(); $('account-status').textContent = 'List approved.';}));
      }
      area.append(article);
    }
  }
  function renderStudy(study) {
    const area = $('connected-study'); area.replaceChildren(node('h2', 'Your progress'), node('p', `Mastered: ${study.reinforced} of ${study.total} · XP: ${study.xp} · streak: ${study.streak} days`, 'learning-progress'));
    area.append(node('p', 'Reviews are saved on the server. Streaks use Moscow time. Activity XP is not a grade.', 'muted'));
    const word = study.due[0];
    if (!word) {area.append(node('p', 'No cards are due now. Check again later.')); return;}
    area.append(node('p', '📚 Remaining: ' + study.due.length));
    const card = node('article', undefined, 'flashcard'); card.append(node('blockquote', word.definition || 'Recall the meaning of this expression: ' + word.term, 'card-definition')); area.append(card);
    const actions = node('div', undefined, 'training-actions'); area.append(actions);
    actions.append(button('👀 Show', async () => {
      card.append(node('h3', word.term), node('p', word.transcription));
      for (const [field, label] of [['synonyms', 'Syn'], ['antonyms', 'Ant'], ['collocations', 'Coll']]) if (word[field]?.length) card.append(node('p', label + ': ' + word[field].join(', ')));
      if (word.example) {
        const example = node('p', 'Ex: ', 'card-example'), index = word.example.toLowerCase().indexOf(word.term.toLowerCase());
        if (index >= 0) example.append(document.createTextNode(word.example.slice(0, index)), node('strong', word.example.slice(index, index + word.term.length)), document.createTextNode(word.example.slice(index + word.term.length)));
        else example.append(document.createTextNode(word.example));
        card.append(example);
      }
      const translation = node('p', word.meaning); translation.id = 'connected-translation'; translation.hidden = true;
      const reveal = button('🇷🇺 Show meaning', async () => {translation.hidden = !translation.hidden; reveal.setAttribute('aria-expanded', String(!translation.hidden)); reveal.textContent = translation.hidden ? '🇷🇺 Show meaning' : '🇷🇺 Hide meaning';}); reveal.setAttribute('aria-expanded', 'false'); reveal.setAttribute('aria-controls', translation.id); card.append(reveal, translation);
      actions.replaceChildren();
      for (const [rating, label] of [['again', '❌ Again'], ['hard', '🙁 Hard'], ['good', '🙂 Good'], ['easy', '😎 Easy']]) {
        const seconds = word.intervals[rating], delay = seconds < 86400 ? seconds / 60 + ' min' : seconds / 86400 + ' days';
        actions.append(button(label + ' · ' + delay, async () => {await request('/cards/' + word.id + '/review', 'POST', {rating}); await refresh(); $('account-status').textContent = 'Review saved.';}));
      }
    }));
  }
  async function signIn(path, body) {
    const result = await request(path, 'POST', body); token = result.access_token; storeSession(result); generation++;
    await refresh();
  }
  for (const course of window.MoonCourses) {const option = node('option', course.name); option.value = course.id; $('new-group-course').append(option);}
  $('connected-group-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
    await request('/groups', 'POST', {name: $('new-group-name').value.trim(), course_id: $('new-group-course').value});
    $('connected-group-form').reset(); await refresh(); $('account-status').textContent = 'Group created.';
  });});
  $('admin-sign-in').addEventListener('submit', event => {event.preventDefault(); const key = $('admin-key').value; $('admin-key').value = ''; run(() => signIn('/login/admin', {token: key}));});
  $('telegram-sign-in').addEventListener('click', () => run(() => signIn('/login/telegram', {init_data: initData()})));
  $('sign-out').addEventListener('click', () => run(async () => {await request('/logout', 'POST'); clearSession(); $('account-status').textContent = 'You have signed out.';}));
  $('refresh-account').addEventListener('click', () => run(refresh));
  $('connected-deck-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
    const cards = MoonLearning.parseList($('connected-words').value);
    if (!cards.length || cards.length > 100 || cards.some(card => !card.meaning)) throw new Error('Add 1–100 expressions, each with a meaning.');
    await request('/decks', 'POST', {title: $('connected-title').value.trim(), source: $('connected-source').value.trim(), group_id: profile.role === 'admin' ? Number($('connected-group').value) : profile.group_id, cards});
    $('connected-deck-form').reset(); await refresh(); $('account-status').textContent = profile.role === 'admin' ? 'List saved for the group.' : 'List saved and awaiting review.';
  });});
  if (base) $('connection-state').textContent = 'The learning server is connected. Your lists and progress are saved after sign-in.';
  else if (!configured) $('connection-state').textContent = 'The learning server is not connected yet. Sign-in and saving are unavailable; you can explore the demo.';
  $('telegram-hint').textContent = initData() ? 'Ready to sign in with Telegram.' : 'To sign in as a student, open the platform from the bot’s Mini App.';
  updateControls();
  document.body.dataset.sessionRestore='pending';
  run(async()=>{try{let saved;try{saved=JSON.parse(sessionStorage.getItem(sessionKey));}catch{}if(saved?.token&&saved.expires_at>Date.now()){token=saved.token;generation++;await refresh();}else if(saved){sessionStorage.removeItem(sessionKey);}}finally{document.body.dataset.sessionRestore='done';}});
})();
