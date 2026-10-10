(function (root) {
  'use strict';
  function parseList(text) {
    if (text.trim().startsWith('[')) {
      const cards = JSON.parse(text);
      if (!Array.isArray(cards) || cards.length > 100) throw new Error('Provide an array of up to 100 cards.');
      const seen = new Set();
      return cards.map(card => {
        if (!card || typeof card !== 'object' || Array.isArray(card)) throw new Error('Invalid card structure.');
        const result = {};
        for (const [field, limit] of Object.entries({term:120, meaning:300, example:500, definition:500, transcription:120})) {
          const value = card[field] === undefined ? '' : card[field];
          if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid field: ' + field);
          result[field] = value.trim();
        }
        for (const field of ['synonyms', 'antonyms', 'collocations']) {
          const value = card[field] === undefined ? [] : card[field];
          if (!Array.isArray(value) || value.length > 10 || value.some(item => typeof item !== 'string' || item.length > 150)) throw new Error('Invalid field: ' + field);
          result[field] = value.map(item => item.trim()).filter(Boolean);
        }
        if (!result.term || !result.definition || !result.meaning) throw new Error('A full card needs an expression, a definition and a meaning.');
        return result;
      }).filter(card => {const key = card.term.normalize('NFKC').toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true;});
    }
    const seen = new Set();
    return text.split(/\r?\n/).map(line => {
      const [term, meaning = '', example = ''] = line.split(';').map(value => value.trim());
      return {term, meaning, example};
    }).filter(word => {
      const key = word.term.normalize('NFKC').toLowerCase();
      if (!key || seen.has(key)) return false;
      if (word.term.length > 120 || word.meaning.length > 300 || word.example.length > 500) throw new Error('This vocabulary entry is too long.');
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
  function reviewOptions(state, wordId) {
    const interval = state.words[wordId]?.intervalDays || 0;
    return {again: 10 * 60000, hard: Math.max(1, Math.min(365, Math.round(interval * 1.2))) * 86400000,
      good: Math.max(3, Math.min(365, Math.round(interval * 2))) * 86400000,
      easy: Math.max(7, Math.min(365, Math.round(interval * 3))) * 86400000};
  }
  function review(state, wordId, rating, now = Date.now()) {
    if (typeof rating === 'boolean') rating = rating ? 'good' : 'again';
    if (!['again', 'hard', 'good', 'easy'].includes(rating)) return false;
    const date = dayKey(now), key = date + ':' + wordId;
    const repeated = state.events.some(event => event.key === key);
    const previous = state.words[wordId] || {level: 0, due: 0};
    if (previous.due > now) return false;
    const delay = reviewOptions(state, wordId)[rating];
    const level = rating === 'again' ? 0 : rating === 'hard' ? previous.level : Math.min(previous.level + 1, 4);
    state.words[wordId] = {level, due: now + delay, intervalDays: rating === 'again' ? 0 : delay / 86400000};
    if (!repeated) state.events.push({key, wordId, date, at: now, xp: 1});
    return true;
  }
  const api = Object.freeze({parseList, dayKey, streak, review, reviewOptions});
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MoonLearning = api;
})(typeof window === 'undefined' ? globalThis : window);
