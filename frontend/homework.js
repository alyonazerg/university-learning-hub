(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const student = Object.freeze({id: 'demo-student-1', alias: 'Silver Fern', groupId: 'demo-group-1'});
  const courses = window.MoonCourses;
  const courseName = id => courses.find(course => course.id === id).name;
  const groups = Array.from({length: 8}, (_, i) => ({id: `demo-group-${i + 1}`, name: `Английский · группа ${String(i + 1).padStart(2, '0')}`, courseId: i % 2 ? 'grammar' : 'speech'}));
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
  const formatter = new Intl.DateTimeFormat('ru-RU', {timeZone: 'Europe/Moscow', dateStyle: 'medium', timeStyle: 'short'});

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
  function visibleTasks() { return tasks.filter(task => {const group = groups.find(group => group.id === task.groupId); return (courseFilter === 'all' || group.courseId === courseFilter) && (role === 'teacher' ? groupFilter === 'all' || task.groupId === groupFilter : task.groupId === student.groupId);}); }
  function selectedTask() {
    const visible = visibleTasks();
    const id = role === 'teacher' ? teacherSelected : studentSelected;
    return visible.find(task => task.id === id) || visible[0];
  }
  function taskState(task) {
    if (role === 'teacher') {
      const works = worksFor(task.id);
      return works.length ? `Попыток: ${works.length} · на проверке: ${works.filter(work => !feedback.has(work.id)).length}` : 'Работы ещё не поступили';
    }
    const works = ownWorks(task.id);
    const latest = works.at(-1);
    return !latest ? 'Можно сдать работу' : feedback.has(latest.id) ? 'Есть обратная связь' : 'Работа на проверке';
  }
  function displayContent(work) {
    const box = node('div', undefined, 'work-content');
    if (work.kind === 'url') {
      const link = node('a', work.content);
      link.href = work.content;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      box.append(link);
    } else box.textContent = work.content;
    return box;
  }
  function displayFeedback(work) {
    const review = feedback.get(work.id);
    if (!review) return null;
    const box = node('div', undefined, 'feedback-box');
    box.append(node('strong', `Комментарий к попытке ${work.attempt}`), node('p', review.text));
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
    $('viewer-role').textContent = teacher ? 'Преподаватель · демо' : 'Студент · демо';
    $('view-description').textContent = teacher ? 'Создай задание, посмотри сдачи и помоги студентам сделать следующий шаг.' : `${student.alias} · ${groupName(student.groupId)}. Здесь только твои задания и работы.`;
    $('new-task').hidden = !teacher;
    $('task-metric-label').textContent = teacher ? 'Задания всех групп' : 'Твои задания';
    $('task-count').textContent = teacher ? tasks.length : visibleTasks().length;
    const accessible = teacher ? submissions : submissions.filter(work => work.studentId === student.id);
    $('pending-work-count').textContent = accessible.filter(work => !feedback.has(work.id)).length;
    $('feedback-count').textContent = accessible.filter(work => feedback.has(work.id)).length;
    $('homework-app').replaceChildren();
    const sidebar = node('section', undefined, 'groups-panel');
    sidebar.setAttribute('aria-label', 'Список заданий');
    sidebar.append(node('h2', teacher ? 'Все задания' : 'Твои задания'));
    const courseLabel = node('label', 'Курс', 'input-label'); courseLabel.htmlFor = 'task-course-filter';
    const courseSelect = node('select'); courseSelect.id = 'task-course-filter';
    for (const course of [{id: 'all', name: 'Все курсы'}, ...courses]) {const option = node('option', course.name); option.value = course.id; courseSelect.append(option);}
    courseSelect.value = courseFilter;
    courseSelect.addEventListener('change', () => {courseFilter = courseSelect.value; groupFilter = 'all'; render(); $('task-course-filter').focus();});
    sidebar.append(courseLabel, courseSelect);
    if (teacher) {
      const label = node('label', 'Учебная группа', 'input-label');
      label.htmlFor = 'task-group-filter';
      const filter = node('select');
      filter.id = 'task-group-filter';
      const all = node('option', 'Все группы'); all.value = 'all'; filter.append(all);
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
        render(); focusDetails(); announce(`Выбрано задание «${task.title}».`);
      }, 'task-card');
      card.setAttribute('aria-pressed', String(task.id === selected?.id));
      card.append(node('strong', task.title), node('span', `${courseName(groups.find(group => group.id === task.groupId).courseId)} · ${groupName(task.groupId)}`), node('span', `${formatter.format(task.deadline)} · МСК`), node('span', taskState(task), 'task-state'));
      list.append(card);
    }
    if (!visibleTasks().length) list.append(node('p', 'Для этой группы пока нет заданий.', 'empty'));
    sidebar.append(list);
    const details = node('section', undefined, 'members-panel assignment-details');
    details.setAttribute('aria-label', 'Выбранное задание');
    if (selected) renderDetails(details, selected);
    else details.append(node('p', 'Выбери другую группу или создай новое задание.', 'empty'));
    $('homework-app').append(sidebar, details);
  }
  function renderDetails(details, task) {
    const title = node('h2', task.title);
    title.id = 'task-details-title'; title.tabIndex = -1;
    details.append(node('div', 'Выбранное задание', 'eyebrow'), title, node('p', groupName(task.groupId), 'muted'), node('p', task.description, 'assignment-instructions'));
    const past = Date.now() > task.deadline;
    const deadline = node('p', `Сдать до ${formatter.format(task.deadline)} · МСК${past ? '. Срок прошёл, работу можно отправить с отметкой об опоздании.' : ''}`, `deadline-note${past ? ' late-note' : ''}`);
    details.append(deadline, node('p', `Курс: ${courseName(groups.find(group => group.id === task.groupId).courseId)}`, 'muted'));
    details.append(node('p', `Целевая лексика: ${task.vocabulary?.join(', ') || 'не задана'}`, 'vocabulary-note'));
    details.append(node('p', 'Проверка ищет точные формы слов и фраз; смысл употребления оценивает преподаватель.', 'muted'));
    if (role === 'teacher') renderTeacherWorks(details, task);
    else renderStudentWork(details, task);
  }
  function analysisPanel(work, task) {
    const panel = node('div', undefined, 'analysis-box');
    if (work.kind !== 'text') {panel.append(node('p', 'Ссылка: текст не загружен, лексика и оформление не проверены.')); return panel;}
    const result = MoonTextReview.analyse(work.content, task.vocabulary || []);
    panel.append(node('strong', 'Лексика и подсказки'), node('p', `Найдено: ${result.found.join(', ') || '—'}`), node('p', `Не найдено: ${result.missing.join(', ') || '—'}`));
    for (const suggestion of result.suggestions) panel.append(node('p', suggestion));
    panel.append(node('p', 'Это подсказки по правилам, без проверки смысла и авторства. По тексту нельзя надёжно установить использование ИИ.', 'muted'));
    return panel;
  }
  function renderTeacherWorks(details, task) {
    const section = node('section', undefined, 'work-section');
    section.append(node('h3', 'Сданные работы'), node('p', 'Каждая попытка хранится отдельно. Комментарий относится к выбранной попытке.', 'muted'));
    const list = node('div', undefined, 'submission-list');
    for (const work of worksFor(task.id).slice().reverse()) {
      const card = node('article', undefined, 'submission-card');
      const header = node('div', undefined, 'submission-header');
      header.append(node('strong', work.alias), node('span', feedback.has(work.id) ? 'Проверено' : 'На проверке', 'member-status'));
      card.append(header, node('p', `Попытка ${work.attempt} из 3 · ${formatter.format(work.createdAt)} · МСК${work.late ? ' · После срока' : ''}`, 'muted'), displayContent(work), analysisPanel(work, task));
      const review = displayFeedback(work); if (review) card.append(review);
      const reviewButton = button(review ? 'Изменить комментарий' : 'Оставить комментарий', () => openReview(work));
      reviewButton.dataset.workId = work.id;
      card.append(reviewButton); list.append(card);
    }
    if (!worksFor(task.id).length) list.append(node('p', 'Пока никто не сдал работу. Переключись в демо-кабинет студента и отправь первую попытку.', 'empty'));
    section.append(list); details.append(section);
  }
  function renderStudentWork(details, task) {
    const works = ownWorks(task.id);
    const section = node('section', undefined, 'work-section');
    section.append(node('h3', 'Твоя работа'), node('p', `Использовано попыток: ${works.length} из 3. Предыдущие версии не заменяются.`, 'muted'));
    if (works.length < 3) {
      const draft = drafts.get(task.id) || {kind: 'text', content: ''};
      const form = node('form', undefined, 'submission-form'); form.id = 'submission-form';
      const typeLabel = node('label', 'Как сдаём?', 'input-label'); typeLabel.htmlFor = 'submission-kind';
      const type = node('select'); type.id = 'submission-kind';
      for (const [value, label] of [['text', 'Текст'], ['url', 'Ссылка на документ']]) { const option = node('option', label); option.value = value; type.append(option); }
      type.value = draft.kind;
      type.addEventListener('change', () => { drafts.set(task.id, {kind: type.value, content: ''}); render(); $('submission-content').focus(); });
      const label = node('label', draft.kind === 'text' ? 'Текст вымышленной работы' : 'HTTPS-ссылка на документ', 'input-label'); label.htmlFor = 'submission-content';
      const content = node(draft.kind === 'text' ? 'textarea' : 'input');
      content.id = 'submission-content'; content.required = true; content.maxLength = draft.kind === 'text' ? 6000 : 2048;
      if (draft.kind === 'text') content.rows = 6; else content.type = 'url';
      content.value = draft.content; content.placeholder = draft.kind === 'text' ? 'Dear imaginary friend…' : 'https://…';
      content.addEventListener('input', () => drafts.set(task.id, {kind: type.value, content: content.value}));
      const error = node('p', '', 'form-error'); error.id = 'submission-error'; error.setAttribute('role', 'alert'); content.setAttribute('aria-describedby', error.id);
      const submit = node('button', 'Отправить демо-работу', 'primary'); submit.type = 'submit'; submit.disabled = pendingSubmissions.has(task.id);
      form.append(typeLabel, type, label, content, error, submit);
      form.addEventListener('submit', event => {event.preventDefault(); submitWork(task, type.value, content.value, submit, error);});
      section.append(form);
    } else section.append(node('p', 'Все три попытки использованы. Дождись комментария преподавателя.', 'deadline-note'));
    const list = node('div', undefined, 'submission-list');
    for (const work of works.slice().reverse()) {
      const card = node('article', undefined, 'submission-card');
      card.append(node('strong', `Попытка ${work.attempt} из 3`), node('p', `${formatter.format(work.createdAt)} · МСК${work.late ? ' · После срока' : ''}`, 'muted'), displayContent(work), analysisPanel(work, task));
      const review = displayFeedback(work);
      card.append(review || node('p', 'Работа на проверке. Комментарий появится здесь.', 'muted'));
      list.append(card);
    }
    section.append(list); details.append(section);
  }
  async function submitWork(task, kind, rawContent, submit, error) {
    if (pendingSubmissions.has(task.id)) return;
    const content = rawContent.trim();
    if (!content) {error.textContent = 'Добавь текст или ссылку.'; return;}
    if (kind === 'url') {
      try {
        const url = new URL(content);
        if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
      } catch {error.textContent = 'Нужна HTTPS-ссылка без логина и пароля в адресе.'; return;}
    }
    if (ownWorks(task.id).length >= 3) {error.textContent = 'Все три попытки уже использованы.'; return;}
    pendingSubmissions.add(task.id); submit.disabled = true; error.textContent = '';
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${content}`));
      const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
      const works = ownWorks(task.id);
      if (works.some(work => work.hash === hash)) {error.textContent = 'Эта версия уже отправлена. Измени работу перед новой попыткой.'; return;}
      if (works.length >= 3) {error.textContent = 'Все три попытки уже использованы.'; return;}
      const createdAt = Date.now();
      submissions.push(Object.freeze({id: `demo-work-${crypto.randomUUID()}`, taskId: task.id, studentId: student.id, alias: student.alias, attempt: works.length + 1, kind, content, hash, createdAt, late: createdAt > task.deadline}));
      drafts.delete(task.id);
      render(); announce('Демо-работа отправлена. Переключись в кабинет преподавателя, чтобы оставить комментарий.');
    } catch {error.textContent = 'Не удалось отправить демо-работу. Попробуй ещё раз.';}
    finally {pendingSubmissions.delete(task.id); submit.disabled = false; const currentSubmit = $('submission-form')?.querySelector('button[type=submit]'); if (currentSubmit) currentSubmit.disabled = pendingSubmissions.has(selectedTask()?.id);}
  }
  function openReview(work) {
    reviewing = work.id;
    $('review-context').textContent = `${work.alias} · попытка ${work.attempt} · ${tasks.find(task => task.id === work.taskId).title}`;
    $('review-content').replaceChildren(displayContent(work));
    const task = tasks.find(task => task.id === work.taskId);
    $('review-analysis').replaceChildren(analysisPanel(work, task));
    $('use-suggestions').hidden = work.kind !== 'text';
    $('review-feedback').value = feedback.get(work.id)?.text || '';
    $('review-error').textContent = '';
    $('review-dialog').showModal(); $('review-feedback').focus();
  }
  function localMoscow(timestamp) { return new Date(timestamp + 3 * 3600000).toISOString().slice(0, 16); }
  function parseMoscow(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
    const timestamp = Date.parse(`${value}:00+03:00`);
    return Number.isFinite(timestamp) && localMoscow(timestamp) === value ? timestamp : NaN;
  }
  for (const group of groups) {const option = node('option', `${courseName(group.courseId)} · ${group.name}`); option.value = group.id; $('assignment-group').append(option);}
  $('teacher-view').addEventListener('click', () => {role = 'teacher'; render(); announce('Демо-режим преподавателя.');});
  $('student-view').addEventListener('click', () => {role = 'student'; courseFilter = 'all'; render(); announce('Демо-режим студента Silver Fern.');});
  $('new-task').addEventListener('click', () => {
    $('assignment-form').reset(); $('assignment-error').textContent = '';
    $('assignment-deadline').value = localMoscow(Date.now() + day);
    $('assignment-dialog').showModal(); $('assignment-title').focus();
  });
  $('cancel-assignment').addEventListener('click', () => $('assignment-dialog').close());
  $('assignment-form').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('assignment-title').value.trim();
    const description = $('assignment-description').value.trim();
    const deadline = parseMoscow($('assignment-deadline').value);
    if (!title || !description) {$('assignment-error').textContent = 'Добавь название и инструкцию.'; return;}
    if (!Number.isFinite(deadline) || deadline <= Date.now()) {$('assignment-error').textContent = 'Выбери будущий срок сдачи по московскому времени.'; return;}
    const task = {id: `demo-task-${crypto.randomUUID()}`, title, description, groupId: $('assignment-group').value, deadline, vocabulary: MoonTextReview.parseVocabulary($('assignment-vocabulary').value)};
    tasks.unshift(task); teacherSelected = task.id; groupFilter = 'all'; courseFilter = 'all';
    if (task.groupId === student.groupId) studentSelected = task.id;
    $('assignment-dialog').close(); render(); focusDetails(); announce(`Демонстрационное задание «${title}» создано.`);
  });
  $('use-suggestions').addEventListener('click', () => {
    const work = submissions.find(work => work.id === reviewing);
    if (!work || work.kind !== 'text') return;
    const task = tasks.find(task => task.id === work.taskId);
    const result = MoonTextReview.analyse(work.content, task.vocabulary || []);
    const suggestion = result.suggestions.join('\n') || (task.vocabulary?.length ? 'Целевая лексика найдена; проверь её употребление в контексте.' : 'Целевая лексика не задана. Проверь текст и его смысл самостоятельно.');
    const field = $('review-feedback');
    const combined = [field.value.trim(), suggestion].filter(Boolean).join('\n');
    if (combined.length > field.maxLength) {$('review-error').textContent = 'Комментарий слишком длинный; сократи его перед добавлением подсказок.'; return;}
    field.value = combined; field.focus();
  });
  $('cancel-review').addEventListener('click', () => $('review-dialog').close());
  $('review-form').addEventListener('submit', event => {
    event.preventDefault();
    const text = $('review-feedback').value.trim();
    if (!text) {$('review-error').textContent = 'Добавь комментарий студенту.'; return;}
    if (!submissions.some(work => work.id === reviewing)) return;
    feedback.set(reviewing, Object.freeze({text, reviewedAt: Date.now()}));
    $('review-dialog').close(); render(); announce('Комментарий сохранён в демо. Студент увидит его рядом со своей попыткой.');
  });
  render();
})();
