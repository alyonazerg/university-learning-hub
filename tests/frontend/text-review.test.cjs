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
test('construction templates use bounded word gaps and literal input, without claiming grammar correctness', () => {
  const {analyseConstructions} = require('../../frontend/text-review.js');
  const result = analyseConstructions('I would rather read books than watch TV. I used to swim.', ['would rather ... than ...', 'used to …', 'Present Perfect', '...']);
  assert.deepEqual(result.found, ['would rather ... than ...', 'used to …']);
  assert.deepEqual(result.missing, ['Present Perfect', '...']);
  assert.deepEqual(analyseConstructions('I would rather than swim.', ['would rather ... than ...']).found, []);
  assert.deepEqual(analyseConstructions('used to ' + 'word '.repeat(13) + 'finish', ['used to ... finish']).found, []);
  assert.deepEqual(analyseConstructions('start', ['art']).found, []);
  assert.deepEqual(analyseConstructions('used. To swim.', ['used to ...']).found, []);
  assert.deepEqual(analyseConstructions('word '.repeat(1000), ['used to ' + '... '.repeat(50) + 'finish']).found, []);
  assert.doesNotThrow(() => analyseConstructions('test', ['(a+)+$', '[x]', '<script>']));
});
