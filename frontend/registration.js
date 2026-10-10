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
      ? 'Could not get a response. Check your connection and try again later.' : error.message;
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
          401: 'Your sign-in expired. Reopen the app through Telegram.',
          403: 'This invitation is unavailable. Ask your teacher for a new one.',
          409: 'This alias or invitation has already been used. Choose another alias. If you already have a profile, you do not need to register again.',
          503: 'Registration is unavailable. Try again later.',
        };
        throw new Error(messages[response.status] || 'Could not create your profile. Try again later.');
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
        status.textContent = 'You have seen every option. Reload the page to start again.';
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
    status.textContent = 'Finding an available alias…';
    try {
      reservation = await request('/auth/telegram/pseudonym');
      name.textContent = reservation.pseudonym;
      status.textContent = 'This alias is reserved for you for 5 minutes.';
      expiration = setTimeout(() => {
        reservation = null;
        buttons();
        status.textContent = 'Your reservation expired. Select “Another alias”.';
      }, reservation.expires_in * 1000);
    } catch (error) {
      name.textContent = 'Try again';
      status.textContent = failure(error);
    } finally { busy = false; buttons(); }
  }
  refresh.addEventListener('click', generateAlias);
  submit.addEventListener('click', async () => {
    if (busy || !reservation || completed) return;
    busy = true;
    buttons();
    status.textContent = 'Creating your profile…';
    try {
      const profile = await request('/auth/telegram/register', {pseudonym_token: reservation.token});
      name.textContent = profile.pseudonym;
      completed = true;
      clearTimeout(expiration);
      submit.textContent = 'Profile created';
      status.textContent = 'Done! Your profile is linked to your learning group.';
    } catch (error) {
      reservation = null;
      clearTimeout(expiration);
      status.textContent = failure(error);
    } finally { busy = false; buttons(); }
  });
  if (!connected) {
    submit.textContent = 'Preview selection';
    status.textContent = apiBase
      ? 'To register, open your group invitation in Telegram.'
      : 'Try out aliases here. An available alias will be reserved when you register using your teacher’s invitation.';
  }
  telegram?.ready();
  generateAlias();
})();
