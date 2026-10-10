(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const student = Object.freeze({id: 'demo-student-1', alias: 'Silver Fern', groupId: 'demo-group-1'});
  const courses = window.MoonCourses;
  const courseName = id => courses.find(course => course.id === id).name;
  const groups = Array.from({length: 8}, (_, i) => ({id: `demo-group-${i + 1}`, name: `English · group ${String(i + 1).padStart(2, '0')}`, courseId: i % 2 ? 'grammar' : 'speech'}));
  // A one-time synthetic catalog handoff from the group dashboard, never credentials or student records.
  try {
    const raw = sessionStorage.getItem('moon-demo-catalog'); sessionStorage.removeItem('moon-demo-catalog');
    const catalog = raw ? JSON.parse(raw) : null;
    if (Array.isArray(catalog) && catalog.length <= 200 && catalog.every(group =>
      typeof group.id === 'string' && /^demo-group-[\w-]+$/.test(group.id) &&
      typeof group.name === 'string' && group.name.length > 0 && group.name.length <= 120 &&
      courses.some(course => course.id === group.courseId)) &&
      new Set(catalog.map(group => group.id)).size === catalog.length &&
      groups.every(group => catalog.some(item => item.id === group.id))) {
      groups.splice(0, groups.length, ...catalog.map(({id, name, courseId}) => ({id, name, courseId})));
    }
  } catch { /* Storage unavailable or invalid: use the original synthetic catalog. */ }
  const day = 86400000;
  const startedAt = Date.now();
  const tasks = [
    {id: 'demo-task-1', title: 'A letter from the Moon', description: 'Write a friendly letter to a fictional new classmate (80–120 words). Tell them about imaginary interests and ask two questions.', groupId: groups[0].id, deadline: startedAt + 3 * day},
    {id: 'demo-task-2', title: 'My enchanted study routine', description: 'Describe a fictional study routine in 6–8 sentences. Practise the present simple and adverbs of frequency.', groupId: groups[0].id, deadline: startedAt + 5 * day},
    {id: 'demo-task-3', title: 'A walk through a magical garden', description: 'Describe an imaginary garden using five adjectives and three prepositions of place.', groupId: groups[1].id, deadline: startedAt + 4 * day},
  ];
  tasks[0].vocabulary = ['enjoy', 'would you like', 'moonlit'];
  tasks[1].vocabulary = ['usually', 'often', 'study'];
  tasks[2].vocabulary = ['behind', 'beautiful', 'between'];
  for (const task of tasks) {task.groupIds = [task.groupId]; task.courseId = groups.find(group => group.id === task.groupId).courseId; task.type = 'regular'; task.startsAt = startedAt; task.constructions = [];}
  const results = new Map();
  const certificates = new Set();
  const firstAliases = ['Silver', 'Amber', 'Misty', 'Violet', 'Golden', 'Crystal', 'Moon', 'Velvet'];
  const roster = groups.flatMap((group, index) => ['Fern', 'Willow'].map((ending, i) => ({id: index === 0 ? `demo-student-${i + 1}` : `demo-student-${group.id}-${i}`, alias: `${firstAliases[index] || `Opal${index + 1}`} ${ending}`, groupId: group.id})));
  function permitted(task, learner = student) {return task.type !== 'compensation' || certificates.has(task.checkpointId + ':' + learner.id);}
  const types = {regular: 'Regular assignment', imt: 'IMT', checkpoint: 'Checkpoint', extra: 'Extra task', compensation: 'Make-up assignment'};
  const notices = [{id: 'demo-notice-1', text: 'Welcome to your learning universe! :moon: Course updates will appear here.', groupIds: groups.map(group => group.id), createdAt: startedAt}];
  const reactions = new Map();
  const comments = new Map();
  const wordLists = [{id: 'seed-list', title: 'Moonlit stories · Unit 1', courseId: 'speech', words: [{term: 'moonlit'}, {term: 'enjoy'}, {term: 'would you like'}]}];
  try {
    const raw = sessionStorage.getItem('moon-demo-word-lists'); sessionStorage.removeItem('moon-demo-word-lists');
    const imported = raw ? JSON.parse(raw) : null;
    if (Array.isArray(imported) && imported.length <= 50 && imported.every(list => typeof list.id === 'string' && list.id.length <= 100 && typeof list.title === 'string' && list.title.length <= 120 && courses.some(course => course.id === list.courseId) && Array.isArray(list.words) && list.words.length <= 100 && list.words.every(word => typeof word.term === 'string' && word.term.length <= 120))) wordLists.splice(0, wordLists.length, ...imported);
  } catch { /* Invalid or unavailable demo handoff uses seed vocabulary. */ }
  const submissions = [Object.freeze({id: 'demo-work-1', taskId: tasks[0].id, studentId: 'demo-student-2', alias: 'Silver Willow', attempt: 1, kind: 'text', content: 'Hello, new friend! I live in a moonlit garden and enjoy reading stories about tiny dragons. What books do you like? Would you like to visit the garden?', createdAt: startedAt - 30 * 60000, late: false})];
  const feedback = new Map();
  const drafts = new Map();
  const pendingSubmissions = new Set();
  let role = new URLSearchParams(location.search).get('role') === 'student' ? 'student' : 'teacher';
  let teacherSelected = tasks[0].id;
  let studentSelected = tasks[0].id;
  let groupFilter = 'all';
  let courseFilter = 'all';
  let reviewing = null;
  let typeFilter = 'all';
  const formatter = new Intl.DateTimeFormat('en-GB', {timeZone: 'Europe/Moscow', dateStyle: 'medium', timeStyle: 'short'});

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function button(text, action, className = 'secondary') {
    const element = node('button', text, className);
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
  }
  function groupName(id) { return groups.find(group => group.id === id).name; }
  function announce(message) { $('homework-announcement').textContent = message; }
  function ownWorks(taskId) { return submissions.filter(work => work.taskId === taskId && work.studentId === student.id); }
  function worksFor(taskId) { return submissions.filter(work => work.taskId === taskId); }
  function visibleTasks() { return tasks.filter(task => (typeFilter === 'all' || task.type === typeFilter) && (courseFilter === 'all' || task.courseId === courseFilter) && (role === 'teacher' ? groupFilter === 'all' || task.groupIds.includes(groupFilter) : task.groupIds.includes(student.groupId) && (permitted(task) || ownWorks(task.id).length > 0))); }
  function selectedTask() {
    const visible = visibleTasks();
    const id = role === 'teacher' ? teacherSelected : studentSelected;
    return visible.find(task => task.id === id) || visible[0];
  }
  function taskState(task) {
    if (role === 'teacher') {
      const works = worksFor(task.id);
      return works.length ? `Attempts: ${works.length} · awaiting review: ${works.filter(work => !feedback.has(work.id)).length}` : 'No submissions yet';
    }
    const works = ownWorks(task.id);
    const latest = works.at(-1);
    return !latest ? 'Ready to submit' : feedback.has(latest.id) ? 'Feedback available' : 'Work awaiting review';
  }
  function displayContent(work) {
    const box = node('div', undefined, 'work-content');
    if (work.kind === 'url') {
      const link = node('a', work.content);
      link.href = work.content;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      box.append(link);
    } else box.append(MoonEmotes.text(work.content));
    box.append(MoonPhotos.gallery(work.photos));
    return box;
  }
  function displayFeedback(work) {
    const review = feedback.get(work.id);
    if (!review) return null;
    const box = node('div', undefined, 'feedback-box');
    const comment = node('p'); comment.append(MoonEmotes.text(review.text));
    box.append(node('strong', `Feedback on attempt ${work.attempt}`), comment);
    return box;
  }
  function focusDetails() {
    if (window.matchMedia('(max-width:850px)').matches) {
      $('task-details-title')?.focus({preventScroll: true});
      document.querySelector('.assignment-details')?.scrollIntoView({block: 'start'});
    }
  }
  function render() {
    const teacher = role === 'teacher';
    $('teacher-view').setAttribute('aria-pressed', String(teacher));
    $('student-view').setAttribute('aria-pressed', String(!teacher));
    $('viewer-name').textContent = teacher ? '✦ Lunar Thyme' : student.alias;
    $('viewer-role').textContent = teacher ? 'Teacher · demo' : 'Student · demo';
    $('view-description').textContent = teacher ? 'Create assignments, review submissions and help students take the next step.' : `${student.alias} · ${groupName(student.groupId)}. Only your assignments and work appear here.`;
    $('new-task').hidden = !teacher;
    $('student-learning-summary').hidden = teacher;
    const ownTasks = tasks.filter(task => task.groupIds.includes(student.groupId));
    $('student-learning-summary').textContent = `Your assignment progress: submitted ${ownTasks.filter(task => ownWorks(task.id).length).length} of ${ownTasks.length}; with feedback ${ownTasks.filter(task => ownWorks(task.id).some(work => feedback.has(work.id))).length}. These are submission statuses, not grades.`;
    renderAnnouncements();
    $('task-metric-label').textContent = teacher ? 'Assignments for all groups' : 'Your assignments';
    $('task-count').textContent = teacher ? tasks.length : visibleTasks().length;
    const accessible = teacher ? submissions : submissions.filter(work => work.studentId === student.id);
    $('pending-work-count').textContent = accessible.filter(work => !feedback.has(work.id)).length;
    $('feedback-count').textContent = accessible.filter(work => feedback.has(work.id)).length;
    $('homework-app').replaceChildren();
    const sidebar = node('section', undefined, 'groups-panel');
    sidebar.setAttribute('aria-label', 'Assignment list');
    sidebar.append(node('h2', teacher ? 'All assignments' : 'Your assignments'));
    const courseLabel = node('label', 'Course', 'input-label'); courseLabel.htmlFor = 'task-course-filter';
    const courseSelect = node('select'); courseSelect.id = 'task-course-filter';
    for (const course of [{id: 'all', name: 'All courses'}, ...courses]) {const option = node('option', course.name); option.value = course.id; courseSelect.append(option);}
    courseSelect.value = courseFilter;
    courseSelect.addEventListener('change', () => {courseFilter = courseSelect.value; groupFilter = 'all'; render(); $('task-course-filter').focus();});
    sidebar.append(courseLabel, courseSelect);
    const typeLabel = node('label', 'Assignment type', 'input-label'); typeLabel.htmlFor = 'task-type-filter';
    const typeSelect = node('select'); typeSelect.id = 'task-type-filter';
    for (const [id, name] of Object.entries({all: 'All types', ...types})) {const option = node('option', name); option.value = id; typeSelect.append(option);}
    typeSelect.value = typeFilter; typeSelect.addEventListener('change', () => {typeFilter = typeSelect.value; render(); $('task-type-filter').focus();});
    sidebar.append(typeLabel, typeSelect);
    if (teacher) {
      const label = node('label', 'Learning group', 'input-label');
      label.htmlFor = 'task-group-filter';
      const filter = node('select');
      filter.id = 'task-group-filter';
      const all = node('option', 'All groups'); all.value = 'all'; filter.append(all);
      for (const group of groups.filter(group => courseFilter === 'all' || group.courseId === courseFilter)) { const option = node('option', group.name); option.value = group.id; filter.append(option); }
      filter.value = groupFilter;
      filter.addEventListener('change', () => {groupFilter = filter.value; render(); $('task-group-filter').focus();});
      sidebar.append(label, filter);
    }
    const list = node('div', undefined, 'task-list');
    const selected = selectedTask();
    for (const task of visibleTasks()) {
      const card = button('', () => {
        if (teacher) teacherSelected = task.id; else studentSelected = task.id;
        render(); focusDetails(); announce(`Selected assignment “${task.title}».`);
      }, 'task-card');
      card.setAttribute('aria-pressed', String(task.id === selected?.id));
      card.append(node('strong', task.title), node('span', `${types[task.type]} · ${courseName(task.courseId)} · ${task.groupIds.map(groupName).join(', ')}`), node('span', `${formatter.format(task.deadline)} · Moscow time`), node('span', taskState(task), 'task-state'));
      list.append(card);
    }
    if (!visibleTasks().length) list.append(node('p', 'No assignments for this group yet.', 'empty'));
    sidebar.append(list);
    const details = node('section', undefined, 'members-panel assignment-details');
    details.setAttribute('aria-label', 'Selected assignment');
    if (selected) renderDetails(details, selected);
    else details.append(node('p', 'Choose another group or create a new assignment.', 'empty'));
    $('homework-app').append(sidebar, details);
  }
  function renderDetails(details, task) {
    const title = node('h2', task.title);
    title.id = 'task-details-title'; title.tabIndex = -1;
    details.append(node('div', 'Selected assignment', 'eyebrow'), title, node('p', task.groupIds.map(groupName).join(', '), 'muted'), node('p', task.description, 'assignment-instructions'));
    const past = Date.now() > task.deadline;
    const deadline = node('p', `Due by ${formatter.format(task.deadline)} · Moscow time${past ? '. The deadline has passed. You can still submit your work, marked as late.' : ''}`, `deadline-note${past ? ' late-note' : ''}`);
    details.append(deadline, node('p', `Course: ${courseName(task.courseId)}`, 'muted'));
    details.append(node('p', `${types[task.type]}${task.period ? ' · ' + task.period : ''} · starts ${formatter.format(task.startsAt)} · Moscow time`, 'muted'));
    if (task.criteria) details.append(node('p', task.criteria, 'assignment-instructions'));
    details.append(node('p', `Target structures: ${task.constructions.join('; ') || 'not set'}`, 'vocabulary-note'));
    details.append(reactionBar('task:' + task.id));
    details.append(node('p', `Target vocabulary: ${task.vocabulary?.join(', ') || 'not set'}`, 'vocabulary-note'));
    details.append(node('p', 'This check looks for exact words and phrases; your teacher assesses their use in context.', 'muted'));
    if (task.type === 'checkpoint') {
      details.append(node('p', `Learning period: ${formatter.format(task.startsAt)} — ${formatter.format(task.periodEnd)} · Moscow time; test: ${formatter.format(task.testAt)} · Moscow time`, 'checkpoint-dates'));
      renderCheckpoint(details, task);
    }
    if (task.type === 'compensation') details.append(node('p', `Make-up work for period: ${tasks.find(item => item.id === task.checkpointId)?.title || '—'}. Approval is granted by your teacher after checking your certificate.`, 'muted'));
    if (role === 'teacher') renderTeacherWorks(details, task);
    else renderStudentWork(details, task);
  }
  function renderCheckpoint(details, task) {
    const section = node('section', undefined, 'checkpoint-results'); section.append(node('h3', 'Checkpoint results and submissions'));
    const learners = roster.filter(learner => task.groupIds.includes(learner.groupId));
    if (role === 'teacher') {
      section.append(node('p', 'Certificate approval applies to this period only. Medical documents and diagnoses are not stored here.', 'muted'));
      for (const learner of learners) {
        const row = node('label', undefined, 'certificate-row'); const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = certificates.has(task.id + ':' + learner.id); checkbox.dataset.studentId = learner.id;
        checkbox.addEventListener('change', () => {const key = task.id + ':' + learner.id; if (checkbox.checked) certificates.add(key); else certificates.delete(key); render(); announce('Approval for this period updated in the demo.');});
        row.append(checkbox, document.createTextNode(`${learner.alias} · certificate checked for this period`)); section.append(row);
      }
      const form = node('form', undefined, 'result-form');
      const learnerLabel = node('label', 'Student', 'input-label'); learnerLabel.htmlFor = 'result-student'; const select = node('select'); select.id = 'result-student';
      for (const learner of learners) {const option = node('option', learner.alias); option.value = learner.id; select.append(option);}
      const score = node('input'); score.id = 'result-score'; score.type = 'number'; score.min = 0; score.step = '0.01'; score.required = false;
      const maximum = node('input'); maximum.id = 'result-maximum'; maximum.type = 'number'; maximum.min = '0.01'; maximum.step = '0.01'; maximum.required = true; maximum.value = '10';
      const scoreLabel = node('label', 'Result', 'input-label'); scoreLabel.htmlFor = score.id; const maxLabel = node('label', 'Maximum', 'input-label'); maxLabel.htmlFor = maximum.id;
      const photos = MoonPhotos.picker('result-photos'); const error = node('p', '', 'form-error'); error.setAttribute('role', 'alert'); const save = node('button', 'Save result and photos', 'primary'); save.type = 'submit';
      form.append(learnerLabel, select, scoreLabel, score, maxLabel, maximum, photos.element, error, save);
      form.addEventListener('submit', event => {event.preventDefault(); const value = score.value.trim() ? Number(score.value) : null, max = Number(maximum.value); if ((value !== null && !Number.isFinite(value)) || (value === null && !photos.photos.length && !results.get(task.id + ':' + select.value)?.photos.length) || !Number.isFinite(max) || max <= 0 || value < 0 || value > max || photos.busy || photos.invalid) {error.textContent = 'Check the scores and wait for supported photos to finish processing.'; return;} results.set(task.id + ':' + select.value, Object.freeze({score: value, maximum: max, photos: photos.photos.length ? Object.freeze(photos.photos.slice()) : (results.get(task.id + ':' + select.value)?.photos || Object.freeze([]))})); render(); announce('Checkpoint result saved in the demo.');});
      section.append(form);
      const csvLabel = node('label', 'Import results as CSV: alias; score; maximum', 'input-label'); csvLabel.htmlFor = 'result-import'; const csv = node('input'); csv.id = 'result-import'; csv.type = 'file'; csv.accept = '.csv,.txt,text/csv,text/plain'; const csvError = node('p', '', 'form-error'); csvError.setAttribute('role', 'alert');
      csv.addEventListener('change', async () => {try {
        const file = csv.files[0]; if (!file) return; if (file.size > 100000 || !/\.(csv|txt)$/i.test(file.name)) throw new Error('Choose a TXT/CSV file up to 100 KB.');
        const text = await file.text(); if (role !== 'teacher') throw new Error('Switch back to teacher mode to import results.'); const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()); if (!rows.length || rows.length > 200) throw new Error('Provide 1–200 rows.');
        const pending = [], seen = new Set();
        for (const line of rows) {const parts = line.split(';').map(value => value.trim()); const learner = learners.find(item => item.alias.toLowerCase() === parts[0].toLowerCase()); const score = Number((parts[1] || '').replace(',', '.')), maximum = Number((parts[2] || '').replace(',', '.')); if (parts.length !== 3 || !parts[1] || !parts[2] || !learner || seen.has(learner.id) || !Number.isFinite(score) || !Number.isFinite(maximum) || maximum <= 0 || score < 0 || score > maximum) throw new Error('Check aliases, duplicates and scores. Nothing has been imported.'); seen.add(learner.id); pending.push({learner, score, maximum});}
        for (const row of pending) {const key = task.id + ':' + row.learner.id; results.set(key, Object.freeze({score: row.score, maximum: row.maximum, photos: results.get(key)?.photos || Object.freeze([])}));} render(); announce('Results imported in the demo.');
      } catch (error) {csvError.textContent = error.message;}}); section.append(csvLabel, csv, csvError);
    }
    for (const learner of learners.filter(learner => role === 'teacher' || learner.id === student.id)) {
      const result = results.get(task.id + ':' + learner.id); if (!result) continue;
      const card = node('article', undefined, 'checkpoint-result'); card.dataset.studentId = learner.id; card.append(node('strong', learner.alias), node('p', result.score === null ? 'Submission photos: result not entered yet' : `Result: ${result.score} / ${result.maximum}`), MoonPhotos.gallery(result.photos)); section.append(card);
    }
    if (role === 'student') section.append(node('p', certificates.has(task.id + ':' + student.id) ? 'Make-up approval granted for this period.' : 'Make-up approval has not been granted for this period yet.', 'muted'));
    details.append(section);
  }
  function analysisPanel(work, task) {
    const panel = node('div', undefined, 'analysis-box');
    if (work.kind !== 'text' || !work.content.trim()) {panel.append(node('p', 'No text provided, or a link was submitted: vocabulary and structures were not checked. Photos are not recognized automatically.')); return panel;}
    const result = MoonTextReview.analyse(work.content, task.vocabulary || []);
    panel.append(node('strong', 'Vocabulary and suggestions'), node('p', `Found: ${result.found.join(', ') || '—'}`), node('p', `Not found: ${result.missing.join(', ') || '—'}`));
    const structures = MoonTextReview.analyseConstructions(work.content, task.constructions);
    panel.append(node('p', `Structures · patterns found: ${structures.found.join('; ') || '—'}`), node('p', `Structures · not found: ${structures.missing.join('; ') || '—'}`));
    panel.append(node('p', 'A pattern match does not confirm that the structure is used correctly.', 'muted'));
    for (const suggestion of result.suggestions) panel.append(node('p', suggestion));
    panel.append(node('p', 'These rule-based suggestions do not assess meaning or authorship. Text alone cannot reliably establish AI use.', 'muted'));
    return panel;
  }
  function renderTeacherWorks(details, task) {
    const section = node('section', undefined, 'work-section');
    section.append(node('h3', 'Submitted work'), node('p', 'Each attempt is stored separately. Feedback belongs to the selected attempt.', 'muted'));
    const list = node('div', undefined, 'submission-list');
    for (const work of worksFor(task.id).slice().reverse()) {
      const card = node('article', undefined, 'submission-card');
      const header = node('div', undefined, 'submission-header');
      header.append(node('strong', work.alias), node('span', feedback.has(work.id) ? 'Reviewed' : 'Pending review', 'member-status'));
      card.append(header, node('p', `Attempt ${work.attempt} of 3 · ${formatter.format(work.createdAt)} · Moscow time${work.late ? ' · Late submission' : ''}`, 'muted'), displayContent(work), analysisPanel(work, task));
      const review = displayFeedback(work); if (review) card.append(review);
      const reviewButton = button(review ? 'Edit comment' : 'Leave a comment', () => openReview(work));
      reviewButton.dataset.workId = work.id;
      card.append(reviewButton); list.append(card);
    }
    if (!worksFor(task.id).length) list.append(node('p', 'No submissions yet. Switch to the student demo hub and submit the first attempt.', 'empty'));
    section.append(list); details.append(section);
  }
  function renderStudentWork(details, task) {
    const works = ownWorks(task.id);
    const section = node('section', undefined, 'work-section');
    section.append(node('h3', 'Your work'), node('p', `Attempts used: ${works.length} of 3. Previous versions are kept.`, 'muted'));
    if (works.length < 3 && permitted(task)) {
      const draft = drafts.get(task.id) || {kind: 'text', content: ''};
      const form = node('form', undefined, 'submission-form'); form.id = 'submission-form';
      const typeLabel = node('label', 'How to submit', 'input-label'); typeLabel.htmlFor = 'submission-kind';
      const type = node('select'); type.id = 'submission-kind';
      for (const [value, label] of [['text', 'Text'], ['url', 'Document link']]) { const option = node('option', label); option.value = value; type.append(option); }
      type.value = draft.kind;
      type.addEventListener('change', () => { drafts.set(task.id, {kind: type.value, content: ''}); render(); $('submission-content').focus(); });
      const label = node('label', draft.kind === 'text' ? 'Sample submission text' : 'HTTPS document link', 'input-label'); label.htmlFor = 'submission-content';
      const content = node(draft.kind === 'text' ? 'textarea' : 'input');
      content.id = 'submission-content'; content.required = draft.kind === 'url'; content.maxLength = draft.kind === 'text' ? 6000 : 2048;
      if (draft.kind === 'text') content.rows = 6; else content.type = 'url';
      content.value = draft.content; content.placeholder = draft.kind === 'text' ? 'Dear imaginary friend…' : 'https://…';
      content.addEventListener('input', () => drafts.set(task.id, {kind: type.value, content: content.value}));
      const error = node('p', '', 'form-error'); error.id = 'submission-error'; error.setAttribute('role', 'alert'); content.setAttribute('aria-describedby', error.id);
      const submit = node('button', 'Submit demo work', 'primary'); submit.type = 'submit'; submit.disabled = pendingSubmissions.has(task.id);
      form.append(typeLabel, type, label, content);
      if (draft.kind === 'text') form.append(MoonEmotes.picker(content));
      const photos = MoonPhotos.picker('submission-photos');
      form.append(photos.element, error, submit);
      form.addEventListener('submit', event => {event.preventDefault(); submitWork(task, type.value, content.value, submit, error, photos);});
      section.append(form);
    } else if (!permitted(task)) section.append(node('p', 'Make-up access is closed. Contact your teacher; previous submissions are available below.', 'compensation-locked'));
    else section.append(node('p', 'All three attempts have been used. Wait for your teacher’s feedback.', 'deadline-note'));
    const list = node('div', undefined, 'submission-list');
    for (const work of works.slice().reverse()) {
      const card = node('article', undefined, 'submission-card');
      card.append(node('strong', `Attempt ${work.attempt} of 3`), node('p', `${formatter.format(work.createdAt)} · Moscow time${work.late ? ' · Late submission' : ''}`, 'muted'), displayContent(work), analysisPanel(work, task));
      const review = displayFeedback(work);
      card.append(review || node('p', 'Your work is awaiting review. Feedback will appear here.', 'muted'));
      list.append(card);
    }
    section.append(list); details.append(section);
  }
  async function submitWork(task, kind, rawContent, submit, error, photos) {
    if (pendingSubmissions.has(task.id)) return;
    if (!permitted(task)) {error.textContent = 'No make-up approval for this period.'; return;}
    if (Date.now() < task.startsAt) {error.textContent = 'The assignment period has not started yet.'; return;}
    if (photos.busy || photos.invalid) {error.textContent = 'Wait for photo processing or choose supported files.'; return;}
    const attachments = photos.photos.slice();
    const content = rawContent.trim();
    if (!content && (!attachments.length || kind === 'url')) {error.textContent = 'Add text, photos or a link.'; return;}
    if (kind === 'url') {
      try {
        const url = new URL(content);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      } catch {error.textContent = 'Use an HTTPS link without a username or password in the URL.'; return;}
    }
    if (ownWorks(task.id).length >= 3) {error.textContent = 'All three attempts have been used.'; return;}
    pendingSubmissions.add(task.id); submit.disabled = true; error.textContent = '';
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${content}:${attachments.map(photo => photo.src).join('|')}`));
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      const works = ownWorks(task.id);
      if (works.some(work => work.hash === hash)) {error.textContent = 'This version has already been submitted. Edit your work before another attempt.'; return;}
      if (works.length >= 3) {error.textContent = 'All three attempts have been used.'; return;}
      if (!permitted(task)) {error.textContent = 'Make-up access is closed.'; return;}
      const createdAt = Date.now();
      submissions.push(Object.freeze({id: `demo-work-${crypto.randomUUID()}`, taskId: task.id, studentId: student.id, alias: student.alias, attempt: works.length + 1, kind, content, photos: Object.freeze(attachments), hash, createdAt, late: createdAt > task.deadline}));
      drafts.delete(task.id);
      render(); announce('Demo work submitted. Switch to the teacher hub to leave feedback.');
    } catch {error.textContent = 'Could not submit demo work. Try again.';}
    finally {pendingSubmissions.delete(task.id); submit.disabled = false; const currentSubmit = $('submission-form')?.querySelector('button[type=submit]'); if (currentSubmit) currentSubmit.disabled = pendingSubmissions.has(selectedTask()?.id);}
  }
  function openReview(work) {
    reviewing = work.id;
    $('review-context').textContent = `${work.alias} · attempt ${work.attempt} · ${tasks.find(task => task.id === work.taskId).title}`;
    $('review-content').replaceChildren(displayContent(work));
    const task = tasks.find(task => task.id === work.taskId);
    $('review-analysis').replaceChildren(analysisPanel(work, task));
    $('use-suggestions').hidden = work.kind !== 'text';
    $('review-feedback').value = feedback.get(work.id)?.text || '';
    $('review-error').textContent = '';
    $('review-dialog').showModal(); $('review-feedback').focus();
  }
  function reactionBar(id) {
    const bar = node('div', undefined, 'reaction-bar'); bar.setAttribute('aria-label', 'Reactions');
    const actor = role === 'teacher' ? 'demo-teacher' : student.id;
    for (const emote of MoonEmotes.items) {
      const key = id + ':' + emote.id;
      const actors = reactions.get(key) || new Set();
      const control = button('', () => {
        if (actors.has(actor)) actors.delete(actor); else actors.add(actor);
        reactions.set(key, actors); render();
        Array.from(document.querySelectorAll('[data-reaction-target]')).find(element => element.dataset.reactionTarget === id && element.dataset.reaction === emote.id)?.focus({preventScroll: true});
        announce('Reaction ' + emote.name + (actors.has(actor) ? ' added.' : ' removed.'));
      });
      control.dataset.reaction = emote.id; control.dataset.reactionTarget = id; control.setAttribute('aria-label', `${emote.name}: ${actors.size}`); control.setAttribute('aria-pressed', String(actors.has(actor)));
      control.append(MoonEmotes.icon(emote.id), document.createTextNode(' ' + actors.size)); bar.append(control);
    }
    return bar;
  }
  function renderComments(card, notice) {
    const thread = node('section', undefined, 'post-comments'); thread.append(node('h3', 'Comments'));
    for (const comment of (comments.get(notice.id) || []).filter(comment => role === 'teacher' || comment.groupId === null || comment.groupId === student.groupId)) {
      const article = node('article', undefined, 'post-comment'); const text = node('p'); text.append(MoonEmotes.text(comment.text));
      article.append(node('strong', comment.alias), text, MoonPhotos.gallery(comment.photos)); thread.append(article);
    }
    const form = node('form'); const field = node('textarea'); field.rows = 2; field.maxLength = 1000; field.placeholder = 'Comment on announcement'; field.setAttribute('aria-label', 'Comment on announcement');
    const photos = MoonPhotos.picker('comment-photos-' + notice.id);
    const error = node('p', '', 'form-error'); error.setAttribute('role', 'alert');
    const submit = node('button', 'Add comment', 'secondary'); submit.type = 'submit';
    form.append(field, MoonEmotes.picker(field), photos.element, error, submit);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (photos.busy || photos.invalid) {error.textContent = 'Wait for photo processing or choose supported files.'; return;}
      const text = field.value.trim(); if (!text && !photos.photos.length) {error.textContent = 'Add text or photos.'; return;}
      const existing = comments.get(notice.id) || [];
      existing.push(Object.freeze({groupId: role === 'teacher' ? null : student.groupId, alias: role === 'teacher' ? '✦ Lunar Thyme' : student.alias, text, photos: Object.freeze(photos.photos.slice())})); comments.set(notice.id, existing);
      render(); announce('Comment added in the demo.');
    });
    thread.append(form); card.append(thread);
  }
  function renderAnnouncements() {
    const section = $('announcements'); section.replaceChildren(node('h2', 'Announcements'));
    if (role === 'teacher') section.append(button('+ Post announcement', () => {
      $('announcement-form').reset(); $('announcement-error').textContent = '';
      $('announcement-groups').replaceChildren();
      for (const group of groups) {const label = node('label'); const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.value = group.id; checkbox.checked = true; label.append(checkbox, document.createTextNode(courseName(group.courseId) + ' · ' + group.name)); $('announcement-groups').append(label);}
      $('announcement-dialog').showModal(); $('announcement-text').focus();
    }));
    const visible = notices.filter(notice => role === 'teacher' || notice.groupIds.includes(student.groupId));
    for (const notice of visible) {
      const card = node('article', undefined, 'notice-card'); const text = node('p'); text.append(MoonEmotes.text(notice.text));
      card.append(node('strong', '✦ Lunar Thyme'), node('p', `${formatter.format(notice.createdAt)} · Moscow time`, 'muted'), text);
      if (role === 'teacher') card.append(node('p', notice.groupIds.map(groupName).join(', '), 'muted'));
      card.append(reactionBar('notice:' + notice.id)); renderComments(card, notice); section.append(card);
    }
    if (!visible.length) section.append(node('p', 'No announcements for your group yet.', 'empty'));
  }
  $('announcement-emotes').append(MoonEmotes.picker($('announcement-text')));
  $('review-emotes').append(MoonEmotes.picker($('review-feedback')));
  $('cancel-announcement').addEventListener('click', () => $('announcement-dialog').close());
  $('announcement-form').addEventListener('submit', event => {
    event.preventDefault(); if (role !== 'teacher') return;
    const text = $('announcement-text').value.trim();
    const groupIds = Array.from($('announcement-groups').querySelectorAll('input:checked'), input => input.value);
    if (!text || !groupIds.length) {$('announcement-error').textContent = 'Add text and choose at least one group.'; return;}
    notices.unshift({id: 'demo-notice-' + crypto.randomUUID(), text, groupIds, createdAt: Date.now()});
    $('announcement-dialog').close(); render(); announce('Announcement published for the selected groups in the demo.');
  });
  function localMoscow(timestamp) { return new Date(timestamp + 3 * 3600000).toISOString().slice(0, 16); }
  function parseMoscow(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
    const timestamp = Date.parse(`${value}:00+03:00`);
    return Number.isFinite(timestamp) && localMoscow(timestamp) === value ? timestamp : NaN;
  }
  function assignmentWordLists() {
    $('assignment-word-list').replaceChildren(); const custom = node('option', 'Enter manually'); custom.value = ''; $('assignment-word-list').append(custom);
    for (const list of wordLists.filter(list => list.courseId === $('assignment-course').value)) {const option = node('option', list.title); option.value = list.id; $('assignment-word-list').append(option);}
  }
  $('assignment-word-list').addEventListener('change', () => {
    const list = wordLists.find(list => list.id === $('assignment-word-list').value && list.courseId === $('assignment-course').value);
    if (list) {
      const text = list.words.map(word => word.term).join('\n');
      if (text.length > $('assignment-vocabulary').maxLength) {$('assignment-error').textContent = 'This list is too long for an assignment. Split it into smaller lists.'; return;}
      $('assignment-vocabulary').value = text; $('assignment-error').textContent = '';
    }
  });
  function assignmentGroups() {
    assignmentWordLists();
    $('assignment-checkpoint').replaceChildren(); const empty = node('option', 'Choose a make-up checkpoint'); empty.value = ''; $('assignment-checkpoint').append(empty);
    for (const checkpoint of tasks.filter(task => task.type === 'checkpoint' && task.courseId === $('assignment-course').value)) {const option = node('option', `${checkpoint.title} · ${checkpoint.period || 'period'}`); option.value = checkpoint.id; $('assignment-checkpoint').append(option);}
    const available = groups.filter(group => group.courseId === $('assignment-course').value);
    $('assignment-group').replaceChildren(); $('assignment-group-choices').replaceChildren();
    available.forEach((group, index) => {
      const option = node('option', `${courseName(group.courseId)} · ${group.name}`); option.value = group.id; option.selected = index === 0; $('assignment-group').append(option);
      const label = node('label'); const checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.value = group.id; checkbox.checked = option.selected;
      checkbox.addEventListener('change', () => {option.selected = checkbox.checked;});
      label.append(checkbox, document.createTextNode(group.name)); $('assignment-group-choices').append(label);
    });
  }
  $('assignment-group').addEventListener('change', () => {for (const checkbox of $('assignment-group-choices').querySelectorAll('input')) checkbox.checked = Array.from($('assignment-group').selectedOptions).some(option => option.value === checkbox.value);});
  for (const course of courses) {const option = node('option', course.name); option.value = course.id; $('assignment-course').append(option);}
  $('assignment-course').addEventListener('change', assignmentGroups); assignmentGroups();
  const imtExamples = {
    essay: {title: 'Opinion Essay + Oral Defense', description: 'Write a 250-word opinion essay on a course-related topic. Prepare to defend your position in a two-minute Q&A.', criteria: 'Written argument: clear thesis, coherent structure, appropriate vocabulary. Oral defense: logical, fluent answers. Arrange the oral defense with the teacher in advance.'},
    shadowing: {title: 'Shadowing Your Favorite Actor', description: 'Choose a 2–4 minute clip, practise matching pace, intonation and pronunciation, and submit a link to your final recording.', criteria: 'Accuracy: rhythm, stress and intonation. Delivery: pronunciation, hesitation and recording length. Sign up with the teacher before the performance.'},
    mindmap: {title: 'Vocabulary Mind Map', description: 'Organize course vocabulary by unit or topic. Include word forms, collocations and example sentences.', criteria: 'Coverage: relevant units and accurate meanings. Organization: clear grouping and useful examples.'},
  };
  $('assignment-template').addEventListener('change', () => {
    const example = imtExamples[$('assignment-template').value]; if (!example) return;
    $('assignment-title').value = example.title; $('assignment-description').value = example.description; $('assignment-criteria').value = example.criteria;
    $('assignment-type').value = 'imt'; $('assignment-deadline').value = localMoscow(Date.now() + 30 * day);
  });
  $('assignment-type').addEventListener('change', () => {$('assignment-deadline').value = localMoscow(Date.now() + ($('assignment-type').value === 'imt' ? 30 : 1) * day);});
  $('teacher-view').addEventListener('click', () => {role = 'teacher'; render(); announce('Teacher demo mode.');});
  $('student-view').addEventListener('click', () => {role = 'student'; courseFilter = 'all'; typeFilter = 'all'; render(); announce('Student demo mode: Silver Fern.');});
  $('new-task').addEventListener('click', () => {
    $('assignment-form').reset(); $('assignment-error').textContent = '';
    assignmentGroups();
    $('assignment-start').value = localMoscow(Date.now());
    $('assignment-deadline').value = localMoscow(Date.now() + day);
    $('assignment-dialog').showModal(); $('assignment-title').focus();
  });
  $('cancel-assignment').addEventListener('click', () => $('assignment-dialog').close());
  $('assignment-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('assignment-title').value.trim();
    const description = $('assignment-description').value.trim();
    const deadline = parseMoscow($('assignment-deadline').value);
    if (!title || !description) {$('assignment-error').textContent = 'Add a title and instructions.'; return;}
    if (!Number.isFinite(deadline) || (deadline <= Date.now() && $('assignment-type').value !== 'checkpoint')) {$('assignment-error').textContent = 'Choose a future deadline in Moscow time.'; return;}
    const groupIds = Array.from($('assignment-group').selectedOptions, option => option.value);
    const courseId = $('assignment-course').value;
    const startsAt = parseMoscow($('assignment-start').value);
    if (!groupIds.length || groupIds.some(id => !groups.some(group => group.id === id && group.courseId === courseId))) {$('assignment-error').textContent = 'Choose groups from the same course.'; return;}
    if (!Number.isFinite(startsAt) || startsAt >= deadline) {$('assignment-error').textContent = 'The start date must be before the deadline.'; return;}
    const task = {id: `demo-task-${crypto.randomUUID()}`, title, description, groupIds, courseId, deadline, startsAt, type: $('assignment-type').value, period: $('assignment-period').value.trim(), criteria: $('assignment-criteria').value.trim(), vocabulary: MoonTextReview.parseVocabulary($('assignment-vocabulary').value), constructions: $('assignment-constructions').value.split('\n').map(value => value.trim()).filter(Boolean)};
    if (task.type === 'checkpoint') {
      task.periodEnd = parseMoscow($('assignment-period-end').value); task.testAt = parseMoscow($('assignment-test-date').value);
      if (!Number.isFinite(task.periodEnd) || task.periodEnd <= startsAt || !Number.isFinite(task.testAt)) {$('assignment-error').textContent = 'For a checkpoint, set an end date after the start date and provide a test date.'; return;}
    }
    if (task.type === 'compensation') {
      const checkpoint = tasks.find(item => item.id === $('assignment-checkpoint').value && item.type === 'checkpoint');
      if (!checkpoint || checkpoint.courseId !== courseId || groupIds.some(id => !checkpoint.groupIds.includes(id))) {$('assignment-error').textContent = 'Choose a checkpoint and its groups from the same course.'; return;}
      task.checkpointId = checkpoint.id;
    }
    tasks.unshift(task); teacherSelected = task.id; groupFilter = 'all'; courseFilter = 'all'; typeFilter = 'all';
    if (task.groupIds.includes(student.groupId)) studentSelected = task.id;
    $('assignment-dialog').close(); render(); focusDetails(); announce(`Demo assignment “${title}” created.`);
  });
  $('use-suggestions').addEventListener('click', () => {
    const work = submissions.find(work => work.id === reviewing);
    if (!work || work.kind !== 'text') return;
    const task = tasks.find(task => task.id === work.taskId);
    const result = MoonTextReview.analyse(work.content, task.vocabulary || []);
    const structures = MoonTextReview.analyseConstructions(work.content, task.constructions);
    const hints = [...result.suggestions];
    if (structures.missing.length) hints.push('Check target structures: ' + structures.missing.join('; ') + '. Pattern matching does not assess grammar.');
    const suggestion = hints.join('\n') || (task.vocabulary?.length ? 'Target vocabulary found; check its use in context.' : 'No target vocabulary specified. Review the text and its meaning yourself.');
    const field = $('review-feedback');
    const combined = [field.value.trim(), suggestion].filter(Boolean).join('\n');
    if (combined.length > field.maxLength) {$('review-error').textContent = 'Your feedback is too long. Shorten it before adding suggestions.'; return;}
    field.value = combined; field.focus();
  });
  $('cancel-review').addEventListener('click', () => $('review-dialog').close());
  $('review-form').addEventListener('submit', event => {
    event.preventDefault();
    const text = $('review-feedback').value.trim();
    if (!text) {$('review-error').textContent = 'Add feedback for the student.'; return;}
    if (!submissions.some(work => work.id === reviewing)) return;
    feedback.set(reviewing, Object.freeze({text, reviewedAt: Date.now()}));
    $('review-dialog').close(); render(); announce('Feedback saved in the demo. The student will see it next to their attempt.');
  });
  render();
})();
