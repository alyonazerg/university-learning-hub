(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const courses = window.MoonCourses;
  const lists = [{id: 'seed-list', title: 'Moonlit stories · Unit 1', source: 'Вымышленная презентация', courseId: 'speech', kind: 'target', status: 'approved', words: [{term: 'moonlit', meaning: 'освещённый луной', example: 'A moonlit garden.'}, {term: 'enjoy', meaning: 'получать удовольствие', example: 'I enjoy reading.'}, {term: 'would you like', meaning: 'хотели бы вы', example: 'Would you like some tea?'}]}];
  const editorByGroup = new Map();
  let assignmentGroup = 'demo-group-1';
  let boardPhoto = null, recognizing = false, boardVersion = 0;
  const mayFormat = () => role === 'teacher' || editorByGroup.get('demo-group-1') === 'demo-student-1';
  const state = {words: {}, events: []};
  let role = 'teacher', flipped = false, optedIn = false, selectedWord = null;
  function node(tag, text, className) {const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element;}
  function button(text, action) {const element = node('button', text, 'secondary'); element.type = 'button'; element.addEventListener('click', action); return element;}
  function available() {return lists.filter(list => list.status === 'approved' && list.courseId === 'speech').flatMap(list => list.words.map((word, index) => ({...word, id: list.id + ':' + index})));}
  function render() {
    const teacher = role === 'teacher';
    renderEditorAssignment();
    $('vocab-viewer').textContent = teacher ? '✦ Lunar Thyme' : 'Silver Fern';
    $('vocab-teacher').setAttribute('aria-pressed', String(teacher)); $('vocab-student').setAttribute('aria-pressed', String(!teacher));
    $('editor-title').textContent = teacher ? 'Заранее подготовить целевую лексику' : 'Предложить emergent vocabulary';
    $('save-list').textContent = teacher ? 'Сохранить целевой список' : 'Отправить на проверку';
    $('list-course').disabled = !teacher; if (!teacher) $('list-course').value = 'speech';
    $('vocab-lists').replaceChildren(node('h2', teacher ? 'Списки и предложения студентов' : 'Лексика твоей группы'));
    for (const list of lists.filter(list => teacher || list.courseId === 'speech')) {
      const card = node('article', undefined, 'word-list-card');
      card.append(node('h3', list.title), node('p', `${list.kind === 'target' ? 'Целевая лексика' : 'Emergent vocabulary'} · ${list.status === 'approved' ? 'Одобрено' : 'На проверке'} · ${courses.find(course => course.id === list.courseId).name}`), node('p', list.source || 'Источник не указан', 'muted'));
      const words = node('ul'); for (const word of list.words) words.append(node('li', `${word.term}${word.meaning ? ' — ' + word.meaning : ''}${word.example ? ' · ' + word.example : ''}`)); card.append(words);
      if (teacher && list.status === 'pending') card.append(button('Одобрить для карточек группы', () => {list.status = 'approved'; render(); $('vocab-status').textContent = 'Список одобрен.';}));
      $('vocab-lists').append(card);
    }
    renderTraining(); renderRanking();
  }
  function renderEditorAssignment() {
    const area = $('editor-assignment'); area.replaceChildren();
    if (role === 'teacher') {
      const groupLabel = node('label', 'Группа', 'input-label'); groupLabel.htmlFor = 'card-editor-group';
      const group = node('select'); group.id = 'card-editor-group';
      for (let index = 1; index <= 8; index++) {const option = node('option', `Английский · группа ${String(index).padStart(2, '0')}`); option.value = 'demo-group-' + index; group.append(option);}
      group.value = assignmentGroup; group.addEventListener('change', () => {assignmentGroup = group.value; renderEditorAssignment();});
      const label = node('label', 'Один редактор карточек', 'input-label'); label.htmlFor = 'card-editor-student';
      const select = node('select'); select.id = 'card-editor-student';
      const prefix = ['Silver', 'Amber', 'Misty', 'Violet', 'Golden', 'Crystal', 'Moon', 'Velvet'][Number(assignmentGroup.split('-').at(-1)) - 1];
      const options = [{id: '', name: 'Только преподаватель'}, {id: assignmentGroup === 'demo-group-1' ? 'demo-student-1' : assignmentGroup + '-fern', name: prefix + ' Fern'}, {id: assignmentGroup === 'demo-group-1' ? 'demo-student-2' : assignmentGroup + '-willow', name: prefix + ' Willow'}];
      for (const item of options) {const option = node('option', item.name); option.value = item.id; select.append(option);}
      select.value = editorByGroup.get(assignmentGroup) || '';
      select.addEventListener('change', () => {if (select.value) editorByGroup.set(assignmentGroup, select.value); else editorByGroup.delete(assignmentGroup); boardVersion++; renderEditorAssignment(); $('vocab-status').textContent = 'Редактор группы обновлён в демо.';});
      area.append(groupLabel, group, label, select);
    }
    $('editor-access').textContent = role === 'teacher' ? 'Ты можешь оформлять карточки всех групп. Назначение нового редактора заменяет предыдущего.' : mayFormat() ? 'Ты назначен редактором карточек группы 01. Черновики проверяет преподаватель перед публикацией.' : 'Оформление по фото доступно преподавателю и назначенному редактору. Ты можешь предложить emergent vocabulary текстом.';
    $('board-workspace').hidden = !mayFormat();
    $('board-photo').disabled = !mayFormat() || recognizing;
    $('recognize-board').disabled = !mayFormat() || !boardPhoto || recognizing;
    $('apply-board').disabled = !mayFormat() || recognizing;
    $('board-text').readOnly = !mayFormat();
  }
  $('board-photo').addEventListener('change', async () => {
    const version = ++boardVersion; boardPhoto = null; $('board-preview').replaceChildren(); $('board-status').textContent = ''; renderEditorAssignment();
    const file = $('board-photo').files[0]; if (!file || !mayFormat()) return;
    try {const photo = await MoonPhotos.prepare(file); if (version !== boardVersion || !mayFormat()) return; boardPhoto = photo; $('board-preview').append(MoonPhotos.gallery([photo])); $('board-status').textContent = 'Фото готово. Распознай текст и проверь строки.';}
    catch (error) {$('board-status').textContent = error.message || 'Не удалось прочитать фото.';}
    renderEditorAssignment();
  });
  $('recognize-board').addEventListener('click', async () => {
    if (!mayFormat() || !boardPhoto || recognizing) return;
    const version = boardVersion, initiatingRole = role;
    let worker = null, timeout, aborted = false;
    recognizing = true; renderEditorAssignment(); $('board-status').textContent = 'Загружаются локальные модели распознавания…';
    try {
      if (!window.Tesseract) throw new Error('Модуль распознавания не собран. Выполни сборку frontend.');
      const operation = (async () => {
        worker = await Tesseract.createWorker(['eng', 'rus'], 1, {workerPath: new URL('ocr/worker.min.js', location.href).href, corePath: new URL('ocr/core/', location.href).href, langPath: new URL('ocr/lang/', location.href).href, workerBlobURL: false, logger: message => {if (message.status === 'recognizing text') $('board-status').textContent = `Распознавание: ${Math.round((message.progress || 0) * 100)}%`;}});
        if (aborted) {await worker.terminate(); throw new Error('Распознавание отменено.');}
        await worker.setParameters({tessedit_pageseg_mode: '6'});
        return worker.recognize(boardPhoto.src);
      })();
      const {data} = await Promise.race([operation, new Promise((_, reject) => {timeout = setTimeout(() => reject(new Error('Распознавание заняло слишком долго. Попробуй меньший снимок с чётким текстом.')), 90000);})]);
      if (version !== boardVersion || initiatingRole !== role || !mayFormat()) throw new Error('Доступ или режим изменился. Результат не применён.');
      const text = data.text.trim(); if (!text) throw new Error('Текст не найден. Попробуй более чёткое фото.');
      if (text.length > 15000) throw new Error('Слишком много текста. Используй фото одного участка доски.');
      $('board-text').value = text; $('board-status').textContent = 'Черновик распознан. Исправь ошибки и оставь одну запись на строку; затем перенеси в список.';
    } catch (error) {$('board-status').textContent = error.message || 'Распознавание не удалось.';}
    finally {aborted = true; clearTimeout(timeout); if (worker) {try {await worker.terminate();} catch { /* Worker already terminated. */ }} recognizing = false; renderEditorAssignment();}
  });
  $('apply-board').addEventListener('click', () => {
    if (!mayFormat() || recognizing) return;
    const text = $('board-text').value.trim(); if (!text) {$('board-status').textContent = 'Добавь проверенный текст.'; return;}
    $('word-list').value = text; if (!$('list-source').value) $('list-source').value = 'Фото доски · проверенный черновик';
    $('board-status').textContent = 'Черновик перенесён. Добавь название, значения и примеры перед сохранением.';
    $('word-list').focus();
  });
  function renderTraining() {
    const section = $('vocab-training'); section.hidden = role === 'teacher'; section.replaceChildren();
    if (role === 'teacher') return;
    const words = available(), now = Date.now();
    const learned = words.filter(word => (state.words[word.id]?.level || 0) >= 3).length;
    section.append(node('h2', 'Твой прогресс'), node('p', `Закреплено: ${learned} из ${words.length} · повторений: ${state.events.length} · streak: ${MoonLearning.streak(state.events.map(event => event.date))} дн.`, 'learning-progress'), node('p', 'Streak считает дни повторений по Москве. «Закреплено» — три успешных повторения в разные сроки. XP за активность не является оценкой.', 'muted'));
    const due = words.filter(word => !state.words[word.id] || state.words[word.id].due <= now);
    const word = due.find(word => word.id === selectedWord) || due[0];
    if (!word) {section.append(node('p', 'На сегодня карточки закончились. Возвращайся к следующему повторению.'), button('Проверить очередь повторений', renderTraining)); return;}
    selectedWord = word.id;
    const card = node('article', undefined, 'flashcard'); card.append(node('h3', word.term));
    if (flipped) card.append(node('p', word.meaning || 'Перевод не указан'), node('p', word.example || 'Добавь свой пример при обсуждении слова.'));
    section.append(card);
    const actions = node('div', undefined, 'training-actions');
    if (!flipped) actions.append(button('Показать перевод и пример', () => {flipped = true; renderTraining();}));
    else for (const [label, remembered] of [['Ещё учу', false], ['Помню', true]]) actions.append(button(label, () => {
      MoonLearning.review(state, word.id, remembered); flipped = false; selectedWord = null; renderTraining(); renderRanking(); $('vocab-status').textContent = 'Повторение записано в демо.';
    }));
    section.append(actions);
  }
  function renderRanking() {
    const section = $('vocab-ranking'); section.replaceChildren(node('h2', 'Лидерборды · за всё время демо'));
    section.append(node('p', 'Внутри группы — псевдонимы добровольных участников. Между группами — только команды, без чужих студентов и оценок.', 'muted'));
    if (role === 'student') {
      const label = node('label'); const input = node('input'); input.type = 'checkbox'; input.checked = optedIn; input.id = 'rank-opt-in'; input.addEventListener('change', () => {optedIn = input.checked; renderRanking();}); label.append(input, document.createTextNode('Показывать меня в лидерборде группы')); section.append(label);
      section.append(node('h3', 'Твоя группа'));
      const rows = [{alias: 'Silver Willow', xp: 5}, {alias: 'Silver Clover', xp: 3}];
      if (optedIn) rows.push({alias: 'Silver Fern', xp: state.events.reduce((sum, event) => sum + event.xp, 0)});
      for (const row of rows.sort((a, b) => b.xp - a.xp || a.alias.localeCompare(b.alias))) {const line = node('div', undefined, 'rank-row own-group-rank'); line.append(node('span', row.alias), node('span', row.xp + ' XP')); section.append(line);}
      if (!optedIn) section.append(node('p', 'Ты скрыт из общего списка; личный прогресс доступен выше.'));
    }
    section.append(node('h3', 'Между группами · командный зачёт'));
    const teams = [{name: 'Английский · группа 01', total: 8 + state.events.length, members: 15, participants: 2 + (state.events.length ? 1 : 0)}, {name: 'Английский · группа 03', total: 9, members: 15, participants: 3}, {name: 'Английский · группа 05', total: 2, members: 15, participants: 1}];
    const eligible = teams.filter(team => team.participants >= 3).sort((a, b) => b.total / b.members - a.total / a.members);
    for (const team of eligible) {const row = node('div', undefined, 'rank-row team-rank'); row.append(node('span', team.name), node('span', (team.total / team.members).toFixed(2) + ' XP / место')); section.append(row);}
    section.append(node('p', 'Демонстрационная политика: 1 XP за первую карточку дня для каждого слова; минимум 3 участника для команды, нормирование на 15 учебных мест. Повторное нажатие XP не добавляет. Истории других участников вымышлены.', 'muted'));
  }
  for (const course of courses) {const option = node('option', course.name); option.value = course.id; $('list-course').append(option);}
  function clearBoard() {boardVersion++; boardPhoto = null; $('board-photo').value = ''; $('board-text').value = ''; $('board-preview').replaceChildren(); $('board-status').textContent = '';}
  $('vocab-teacher').addEventListener('click', () => {if (role !== 'teacher') clearBoard(); role = 'teacher'; render();});
  $('vocab-student').addEventListener('click', () => {if (role !== 'student') clearBoard(); role = 'student'; render();});
  $('word-list-form').addEventListener('submit', event => {
    event.preventDefault(); $('word-error').textContent = '';
    try {
      const title = $('list-title').value.trim(), words = MoonLearning.parseList($('word-list').value);
      if (!title || !words.length || words.length > 100) throw new Error('Добавь название и от 1 до 100 слов.');
      if (role === 'student' && words.some(word => !word.meaning)) throw new Error('Добавь значение к каждому предлагаемому слову.');
      lists.push({id: 'demo-list-' + crypto.randomUUID(), title, words, source: $('list-source').value.trim(), courseId: role === 'student' ? 'speech' : $('list-course').value, kind: role === 'teacher' ? 'target' : 'emergent', status: role === 'teacher' ? 'approved' : 'pending'});
      $('word-list-form').reset(); render(); $('vocab-status').textContent = role === 'teacher' ? 'Целевой список сохранён в демо.' : 'Твои слова ждут проверки преподавателя.';
    } catch (error) {$('word-error').textContent = error.message;}
  });
  $('word-file').addEventListener('change', async () => {
    const file = $('word-file').files[0]; if (!file) return;
    if (!/\.(txt|csv)$/i.test(file.name) || file.size > 100000) {$('word-error').textContent = 'Нужен TXT или CSV до 100 КБ.'; return;}
    const text = await file.text();
    if (text.length > 15000) {$('word-error').textContent = 'Список должен быть не длиннее 15 000 символов.'; return;}
    $('word-list').value = text; $('word-error').textContent = '';
  });
  $('vocab-homework').addEventListener('click', () => {
    if (role !== 'teacher') return;
    try {sessionStorage.setItem('moon-demo-word-lists', JSON.stringify(lists.filter(list => list.kind === 'target' && list.status === 'approved')));} catch { /* Optional catalog handoff. */ }
  });
  render();
})();
