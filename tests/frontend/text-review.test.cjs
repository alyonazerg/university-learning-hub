const {test} = require('node:test');
const assert = require('node:assert/strict');
const {analyse, parseVocabulary} = require('../../frontend/text-review.js');
test('lexical coverage respects complete words, phrase boundaries, case and literal inflections', () => {
  const result = analyse('ART is fun. Would you like tea? I enjoyed it. Beautiful garden.', ['art', 'would you like', 'enjoy', 'beauty', 'beautiful']);
  assert.deepEqual(result.found, ['art', 'would you like', 'beautiful']);
  assert.deepEqual(result.missing, ['enjoy', 'beauty']);
  assert.deepEqual(analyse('start. would. You like it.', ['art', 'would you like']).found, []);
  assert.deepEqual(analyse('ＣＡＦÉ, I’m here.', ['café', "I'm"]).found, ['café', "I'm"]);
});
test('vocabulary deduplication and suggestions remain transparent without authorship scores', () => {
  assert.deepEqual(parseVocabulary(' enjoy, ENJOY; would you like\nmoonlit\n,, '), ['enjoy', 'would you like', 'moonlit']);
  const result = analyse('i  like tea !', ['moonlit']);
  assert.equal(result.suggestions.length, 4);
  assert.match(result.suggestions.join('\n'), /i → I/);
  assert.equal('aiProbability' in result, false);
  assert.deepEqual(analyse('I like tea.', ['tea']).suggestions, []);
});
