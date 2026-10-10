const {test} = require('node:test');
const assert = require('node:assert/strict');
const {apiOrigin} = require('../../frontend/configure-api.cjs');

test('deployment config enables only an explicit HTTPS API origin', () => {
  assert.equal(apiOrigin(''), '');
  assert.equal(apiOrigin(' https://api.example.org/ '), 'https://api.example.org');
  for (const value of ['http://api.example.org', 'https://user:password@example.org',
    'https://example.org/api', 'https://example.org?token=x', 'https://example.org#x',
    'javascript:alert(1)', 'not a URL']) assert.throws(() => apiOrigin(value));
});
