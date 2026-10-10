(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const node = (tag, text, className) => {const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element;};
  let base = '', token = null, profile = null, busy = false, generation = 0;
  const configured = window.MOON_CAMPUS_API_BASE || '';
  try {
    if (configured) {const url = new URL(configured); if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error(); base = url.href.replace(/\/$/, '');}
  } catch { $('connection-state').textContent = 'Адрес сервера настроен неверно. Обратись к администратору.'; }
  const initData = () => window.Telegram?.WebApp?.initData || '';
  const messages = {
    'Invalid or expired Telegram authentication': 'Вход через Telegram устарел. Открой приложение заново.',
    'Registered student required': 'Сначала зарегистрируйся по приглашению преподавателя.',
    'Administrator access required': 'Недостаточно прав или неверный ключ преподавателя.',
    'Appointed card editor required': 'Полные карточки оформляет назначенный редактор. Можно предложить простой список слов.',
    'Card is not due yet': 'Эта карточка уже повторена. Обнови очередь.',
    'Review already recorded': 'Повторение уже записано. Обнови очередь.',
    'Published deck cannot be rewritten': 'Опубликованный список нельзя перезаписать: у студентов уже есть прогресс по его карточкам.',
    'Session expired': 'Сессия завершилась. Войди снова.',
    'Telegram authentication is not configured': 'Вход через Telegram ещё не настроен на сервере.',
    'Group already exists': 'Группа с таким названием уже существует.', 'Group not found': 'Группа недоступна.', 'Student unavailable': 'Доступ студента отключён.'
  };
  async function request(path, method = 'GET', body) {
    if (!base) throw new Error('Учебный сервер пока не подключён. Доступно демо.');
    const response = await fetch(base + '/learning' + path, {method, cache: 'no-store', headers: {...(body ? {'Content-Type': 'application/json'} : {}), ...(token ? {Authorization: 'Bearer ' + token} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
    if (!response.ok) {
      let detail; try {detail = (await response.json()).detail;} catch { /* generic message below */ }
      if ((response.status === 401 || (path === '/me' && [403, 404].includes(response.status))) && token) clearSession();
      throw new Error(messages[detail] || (response.status === 422 ? 'Проверь заполнение и формат карточек: каждой записи нужны выражение и перевод.' : 'Не удалось выполнить действие. Попробуй снова.'));
    }
    return response.status === 204 ? null : response.json();
  }
  function updateControls() {
    document.querySelectorAll('button, input, textarea, select').forEach(element => {element.disabled = busy || !base;});
    $('telegram-sign-in').disabled = busy || !base || !initData();
    if (profile?.role === 'admin') $('connected-save').disabled = busy || !$('connected-group').options.length;
  }
  async function run(action) {
    if (busy) return;
    busy = true; updateControls(); $('account-status').textContent = '';
    try {await action();} catch (error) {$('account-status').textContent = error instanceof TypeError ? 'Нет связи с учебным сервером. Проверь подключение и попробуй снова.' : error.message;}
    finally {busy = false; updateControls();}
  }
  function button(text, action) {const element = node('button', text, 'secondary'); element.type = 'button'; element.addEventListener('click', () => run(action)); return element;}
  function clearSession() {
    generation++; token = null; profile = null; $('workspace').hidden = true; $('sign-in').hidden = false;
    $('connected-decks').replaceChildren(); $('connected-study').replaceChildren(); $('group-editors').replaceChildren(); $('connected-group').replaceChildren();
    $('connected-deck-form').reset(); $('connected-group-form').reset(); $('admin-key').value = ''; $('account-name').textContent = 'Учебный кабинет';
  }
  async function refresh() {
    const version = generation;
    const me = await request('/me');
    const [decks, extra] = await Promise.all([request('/decks'), request(me.role === 'admin' ? '/groups' : '/study')]);
    if (version !== generation || !token) return;
    profile = me; $('sign-in').hidden = true; $('workspace').hidden = false;
    $('account-name').textContent = me.role === 'admin' ? 'Преподаватель' : me.pseudonym;
    $('connected-groups').hidden = me.role !== 'admin'; $('connected-group-field').hidden = me.role !== 'admin';
    $('connected-editor-title').textContent = me.role === 'admin' ? 'Подготовить целевую лексику' : 'Предложить emergent vocabulary';
    $('connected-editor-hint').textContent = me.role === 'admin' ? 'Выбери группу. Список сохранится на сервере и станет доступен её студентам.' : me.is_card_editor ? 'Ты редактор карточек своей группы. Полные карточки можно подготовить в JSON. Публикует преподаватель.' : 'Предложи слова с переводами и примерами. Преподаватель проверит их перед публикацией.';
    $('connected-save').textContent = me.role === 'admin' ? 'Сохранить для группы' : 'Отправить на проверку';
    if (me.role === 'admin') renderGroups(extra);
    renderDecks(decks);
    $('connected-study').hidden = me.role !== 'student';
    if (me.role === 'student') renderStudy(extra);
  }
  function renderGroups(groups) {
    const previous = $('connected-group').value;
    $('connected-group').replaceChildren(); $('group-editors').replaceChildren();
    for (const group of groups) {
      const course = window.MoonCourses.find(item => item.id === group.course_id)?.name || group.course_id;
      const option = node('option', group.name + ' · ' + course); option.value = group.id; $('connected-group').append(option);
      const article = node('article', undefined, 'word-list-card'); article.append(node('h3', group.name), node('p', course));
      const label = node('label', 'Редактор карточек', 'input-label'); label.htmlFor = 'editor-' + group.id;
      const select = node('select'); select.id = label.htmlFor;
      const none = node('option', 'Только преподаватель'); none.value = ''; select.append(none);
      for (const student of group.students) {const item = node('option', student.pseudonym); item.value = student.id; select.append(item);}
      select.value = group.editor_student_id || '';
      article.append(label, select, button('Сохранить редактора · ' + group.name, async () => {await request('/groups/' + group.id + '/editor', 'PUT', {student_id: select.value || null}); await refresh(); $('account-status').textContent = 'Редактор группы сохранён.';})); $('group-editors').append(article);
    }
    if ([...$('connected-group').options].some(option => option.value === previous)) $('connected-group').value = previous;
    if (!groups.length) $('group-editors').append(node('p', 'Группы пока не созданы.'));
  }
  function renderDecks(decks) {
    const area = $('connected-decks'); area.replaceChildren(node('h2', 'Сохранённые списки'));
    if (!decks.length) area.append(node('p', 'Пока нет списков.'));
    for (const deck of decks) {
      const article = node('article', undefined, 'word-list-card'); article.append(node('h3', deck.title), node('p', deck.status === 'approved' ? 'Одобрено' : 'На проверке'), node('p', deck.source));
      const words = node('ul'); deck.cards.forEach(card => words.append(node('li', card.term + ' — ' + card.meaning))); article.append(words);
      if (profile.role === 'admin' && deck.status === 'pending') {
        for (const card of deck.cards) {const preview = node('details'); preview.append(node('summary', 'Проверить карточку: ' + card.term), node('p', card.definition), node('p', card.transcription), node('p', 'Syn: ' + card.synonyms.join(', ')), node('p', 'Ant: ' + card.antonyms.join(', ')), node('p', 'Coll: ' + card.collocations.join(', ')), node('p', card.example)); article.append(preview);}
        article.append(button('Исправить · ' + deck.title, async () => {
          const form = node('form'), label = node('label', 'Проверенный черновик карточек · JSON', 'input-label');
          const input = node('textarea'); input.id = 'draft-' + deck.id; input.maxLength = 15000; input.rows = 8; input.required = true; label.htmlFor = input.id;
          input.value = JSON.stringify(deck.cards.map(({id, ...content}) => content), null, 2);
          const save = node('button', 'Сохранить исправления', 'secondary'); save.type = 'submit';
          form.append(label, input, save); form.addEventListener('submit', event => {event.preventDefault(); run(async () => {
            await request('/decks/' + deck.id, 'PUT', {title: deck.title, source: deck.source, group_id: deck.group_id, cards: MoonLearning.parseList(input.value)});
            await refresh(); $('account-status').textContent = 'Черновик исправлен. Теперь можно одобрить список.';
          });});
          const old = article.querySelector('form'); if (old) old.remove(); article.append(form); input.focus();
        }));
        article.append(button('Одобрить · ' + deck.title, async () => {await request('/decks/' + deck.id + '/approve', 'POST'); await refresh(); $('account-status').textContent = 'Список одобрен.';}));
      }
      area.append(article);
    }
  }
  function renderStudy(study) {
    const area = $('connected-study'); area.replaceChildren(node('h2', 'Твой прогресс'), node('p', `Закреплено: ${study.reinforced} из ${study.total} · XP: ${study.xp} · streak: ${study.streak} дн.`, 'learning-progress'));
    area.append(node('p', 'Повторения сохраняются на сервере. Streak считается по Москве. XP за активность не является оценкой.', 'muted'));
    const word = study.due[0];
    if (!word) {area.append(node('p', 'Нет карточек для повторения сейчас. Обнови очередь позже.')); return;}
    area.append(node('p', '📚 Осталось: ' + study.due.length));
    const card = node('article', undefined, 'flashcard'); card.append(node('blockquote', word.definition || 'Вспомни перевод выражения: ' + word.term, 'card-definition')); area.append(card);
    const actions = node('div', undefined, 'training-actions'); area.append(actions);
    actions.append(button('👀 Показать', async () => {
      card.append(node('h3', word.term), node('p', word.transcription));
      for (const [field, label] of [['synonyms', 'Syn'], ['antonyms', 'Ant'], ['collocations', 'Coll']]) if (word[field]?.length) card.append(node('p', label + ': ' + word[field].join(', ')));
      if (word.example) {
        const example = node('p', 'Ex: ', 'card-example'), index = word.example.toLowerCase().indexOf(word.term.toLowerCase());
        if (index >= 0) example.append(document.createTextNode(word.example.slice(0, index)), node('strong', word.example.slice(index, index + word.term.length)), document.createTextNode(word.example.slice(index + word.term.length)));
        else example.append(document.createTextNode(word.example));
        card.append(example);
      }
      const translation = node('p', word.meaning); translation.id = 'connected-translation'; translation.hidden = true;
      const reveal = button('🇷🇺 Показать перевод', async () => {translation.hidden = !translation.hidden; reveal.setAttribute('aria-expanded', String(!translation.hidden)); reveal.textContent = translation.hidden ? '🇷🇺 Показать перевод' : '🇷🇺 Скрыть перевод';}); reveal.setAttribute('aria-expanded', 'false'); reveal.setAttribute('aria-controls', translation.id); card.append(reveal, translation);
      actions.replaceChildren();
      for (const [rating, label] of [['again', '❌ Снова'], ['hard', '🙁 Трудно'], ['good', '🙂 Хорошо'], ['easy', '😎 Легко']]) {
        const seconds = word.intervals[rating], delay = seconds < 86400 ? seconds / 60 + ' мин.' : seconds / 86400 + ' дн.';
        actions.append(button(label + ' · ' + delay, async () => {await request('/cards/' + word.id + '/review', 'POST', {rating}); await refresh(); $('account-status').textContent = 'Повторение сохранено.';}));
      }
    }));
  }
  async function signIn(path, body) {
    const result = await request(path, 'POST', body); token = result.access_token; generation++;
    try {await refresh();} catch (error) {clearSession(); throw error;}
  }
  for (const course of window.MoonCourses) {const option = node('option', course.name); option.value = course.id; $('new-group-course').append(option);}
  $('connected-group-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
    await request('/groups', 'POST', {name: $('new-group-name').value.trim(), course_id: $('new-group-course').value});
    $('connected-group-form').reset(); await refresh(); $('account-status').textContent = 'Группа создана.';
  });});
  $('admin-sign-in').addEventListener('submit', event => {event.preventDefault(); const key = $('admin-key').value; $('admin-key').value = ''; run(() => signIn('/login/admin', {token: key}));});
  $('telegram-sign-in').addEventListener('click', () => run(() => signIn('/login/telegram', {init_data: initData()})));
  $('sign-out').addEventListener('click', () => run(async () => {await request('/logout', 'POST'); clearSession(); $('account-status').textContent = 'Ты вышел из кабинета.';}));
  $('refresh-account').addEventListener('click', () => run(refresh));
  $('connected-deck-form').addEventListener('submit', event => {event.preventDefault(); run(async () => {
    const cards = MoonLearning.parseList($('connected-words').value);
    if (!cards.length || cards.length > 100 || cards.some(card => !card.meaning)) throw new Error('Добавь от 1 до 100 выражений, каждому нужен перевод.');
    await request('/decks', 'POST', {title: $('connected-title').value.trim(), source: $('connected-source').value.trim(), group_id: profile.role === 'admin' ? Number($('connected-group').value) : profile.group_id, cards});
    $('connected-deck-form').reset(); await refresh(); $('account-status').textContent = profile.role === 'admin' ? 'Список сохранён для группы.' : 'Список сохранён и ждёт проверки.';
  });});
  if (base) $('connection-state').textContent = 'Для кабинета указан учебный сервер. После входа списки и прогресс сохраняются в базе.';
  else if (!configured) $('connection-state').textContent = 'Учебный сервер ещё не подключён. Вход и сохранение здесь пока недоступны; можно посмотреть демо.';
  $('telegram-hint').textContent = initData() ? 'Готово к входу через Telegram.' : 'Для входа студента открой платформу через Mini App бота.';
  updateControls();
})();
