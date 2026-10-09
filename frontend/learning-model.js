(function (root) {
  'use strict';
  function parseList(text) {
    const seen = new Set();
    return text.split(/\r?\n/).map(line => {
      const [term, meaning = '', example = ''] = line.split(';').map(value => value.trim());
      return {term, meaning, example};
    }).filter(word => {
      const key = word.term.normalize('NFKC').toLowerCase();
      if (!key || seen.has(key)) return false;
      if (word.term.length > 120 || word.meaning.length > 300 || word.example.length > 500) throw new Error('Слишком длинная строка словаря.');
      seen.add(key); return true;
    });
  }
  function dayKey(timestamp) {return new Intl.DateTimeFormat('en-CA', {timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit'}).format(timestamp);}
  function streak(dates, now = Date.now()) {
    const unique = new Set(dates);
    const current = new Date(dayKey(now) + 'T12:00:00Z');
    if (!unique.has(dayKey(now))) current.setUTCDate(current.getUTCDate() - 1);
    let count = 0;
    while (unique.has(current.toISOString().slice(0, 10))) {count++; current.setUTCDate(current.getUTCDate() - 1);}
    return count;
  }
  function review(state, wordId, remembered, now = Date.now()) {
    const date = dayKey(now), key = date + ':' + wordId;
    const repeated = state.events.some(event => event.key === key);
    const previous = state.words[wordId] || {level: 0, due: 0};
    if (previous.due > now) return false;
    const level = remembered ? Math.min(previous.level + 1, 4) : 0;
    state.words[wordId] = {level, due: now + (remembered ? [1, 3, 7, 14][level - 1] * 86400000 : 10 * 60000)};
    if (!repeated) state.events.push({key, wordId, date, at: now, xp: 1});
    return true;
  }
  const api = Object.freeze({parseList, dayKey, streak, review});
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MoonLearning = api;
})(typeof window === 'undefined' ? globalThis : window);
