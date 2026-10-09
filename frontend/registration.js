(() => {
  'use strict';
  const firstWords = ['Moon', 'Silver', 'Lunar', 'Mystic', 'Star', 'Aurora', 'Dream', 'Velvet', 'Secret', 'Crystal', 'Twilight', 'Golden', 'Gentle', 'Quiet', 'Misty', 'Wild', 'Amber', 'Opal', 'Winter', 'Summer', 'Cosmic', 'Dawn', 'Ivory', 'Willow'];
  const secondWords = ['Willow', 'Fox', 'Bloom', 'Sage', 'Raven', 'Fern', 'Comet', 'Thyme', 'Owl', 'Rose', 'Maple', 'Cloud', 'Lily', 'Clover', 'Iris', 'Wren', 'Moss', 'Cedar', 'Orchid', 'Finch', 'Petal', 'Meadow', 'Birch', 'Lotus'];
  const pool = firstWords.flatMap(first => secondWords.map(second => `${first} ${second}`)).filter(name => name !== 'Lunar Thyme');
  const name = document.getElementById('pseudonym');
  const refresh = document.getElementById('refresh');
  const submit = document.getElementById('continue');
  const status = document.getElementById('status');
  const apiBase = (window.MOON_CAMPUS_API_BASE || '').replace(/\/$/, '');
  const telegram = window.Telegram?.WebApp;
  const invitation = new URLSearchParams(location.hash.slice(1)).get('invite') || telegram?.initDataUnsafe?.start_param || '';
  const connected = Boolean(apiBase && telegram?.initData && invitation);
  const shown = new Set();
  let reservation = null;
  let busy = false;
  let completed = false;
  let expiration = null;

  function randomIndex(length) {
    const value = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / length) * length;
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % length;
  }
  function buttons() {
    refresh.disabled = busy || completed;
    submit.disabled = busy || completed || !reservation;
  }
  function failure(error) {
    return error.name === 'AbortError' || error instanceof TypeError
      ? 'Не удалось получить ответ. Проверь интернет и попробуй позже.' : error.message;
  }
  async function request(path, extra = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${apiBase}${path}`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({init_data: telegram.initData, invitation_token: invitation, ...extra}),
        cache: 'no-store', credentials: 'omit', signal: controller.signal,
      });
      if (!response.ok) {
        const messages = {
          401: 'Вход устарел. Открой приложение заново через Telegram.',
          403: 'Приглашение недоступно. Попроси преподавателя прислать новое.',
          409: 'Псевдоним или приглашение уже использованы. Выбери другой псевдоним. Если профиль уже создан, повторная регистрация не нужна.',
          503: 'Регистрация пока недоступна. Попробуй позже.',
        };
        throw new Error(messages[response.status] || 'Не удалось создать профиль. Попробуй позже.');
      }
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  async function generateAlias() {
    if (busy || completed) return;
    if (!connected) {
      const available = pool.filter(alias => !shown.has(alias));
      if (!available.length) {
        refresh.disabled = true;
        status.textContent = 'Ты посмотрел все варианты. Обнови страницу, чтобы начать заново.';
        return;
      }
      const alias = available[randomIndex(available.length)];
      shown.add(alias);
      name.textContent = alias;
      return;
    }
    busy = true;
    reservation = null;
    clearTimeout(expiration);
    buttons();
    status.textContent = 'Подбираем свободный псевдоним…';
    try {
      reservation = await request('/auth/telegram/pseudonym');
      name.textContent = reservation.pseudonym;
      status.textContent = 'Этот псевдоним зарезервирован для тебя на 5 минут.';
      expiration = setTimeout(() => {
        reservation = null;
        buttons();
        status.textContent = 'Время брони истекло. Нажми «Другой псевдоним».';
      }, reservation.expires_in * 1000);
    } catch (error) {
      name.textContent = 'Попробуем ещё раз';
      status.textContent = failure(error);
    } finally { busy = false; buttons(); }
  }
  refresh.addEventListener('click', generateAlias);
  submit.addEventListener('click', async () => {
    if (busy || !reservation || completed) return;
    busy = true;
    buttons();
    status.textContent = 'Создаём твой профиль…';
    try {
      const profile = await request('/auth/telegram/register', {pseudonym_token: reservation.token});
      name.textContent = profile.pseudonym;
      completed = true;
      clearTimeout(expiration);
      submit.textContent = 'Профиль создан';
      status.textContent = 'Готово! Твой профиль привязан к учебной группе.';
    } catch (error) {
      reservation = null;
      clearTimeout(expiration);
      status.textContent = failure(error);
    } finally { busy = false; buttons(); }
  });
  if (!connected) {
    submit.textContent = 'Предварительный выбор';
    status.textContent = apiBase
      ? 'Для регистрации открой приглашение своей группы в Telegram.'
      : 'Здесь можно примерить псевдонимы. Свободный вариант выберем и закрепим при регистрации по приглашению преподавателя.';
  }
  telegram?.ready();
  generateAlias();
})();
