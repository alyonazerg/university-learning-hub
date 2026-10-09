const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseList, dayKey, streak, review} = require('../../frontend/learning-model.js');
test('word lists preserve phrases and deduplicate Unicode/case variants', () => {
  assert.deepEqual(parseList('Moonlit; лунный; A garden.\nMOONLIT; x\nwould you like; хотели бы вы; Tea?\n'), [{term: 'Moonlit', meaning: 'лунный', example: 'A garden.'}, {term: 'would you like', meaning: 'хотели бы вы', example: 'Tea?'}]);
  assert.throws(() => parseList('x'.repeat(121)));
});
test('streak uses unique Moscow days and remains alive until the day after the last review', () => {
  const now = Date.parse('2026-10-10T21:05:00Z');
  assert.equal(dayKey(now), '2026-10-11');
  assert.equal(streak(['2026-10-09', '2026-10-10', '2026-10-10'], now), 2);
  assert.equal(streak(['2026-10-09'], now), 0);
  assert.equal(streak(['2026-10-09', '2026-10-10', '2026-10-11'], now), 3);
});
test('review spacing and daily idempotent XP prevent repeated-click farming', () => {
  const state = {words: {}, events: []}; const start = Date.parse('2026-10-09T12:00:00Z');
  assert(review(state, 'word-1', false, start));
  assert.equal(review(state, 'word-1', true, start + 1), false);
  assert(review(state, 'word-1', true, start + 10 * 60000));
  assert.equal(state.events.length, 1);
  assert.equal(state.words['word-1'].level, 1);
  assert(review(state, 'word-1', true, start + 2 * 86400000));
  assert.equal(state.events.length, 2); assert.equal(state.words['word-1'].level, 2);
});
