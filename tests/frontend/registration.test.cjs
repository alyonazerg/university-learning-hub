const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium, devices} = require('playwright');
const {spawn} = require('node:child_process');
const path = require('node:path');

async function fixture(t, {connected = false, reserveStatus = 200, registerStatus = 201, expiresIn = 300} = {}) {
  const server = spawn('python', ['-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', path.resolve(__dirname, '../../frontend')], {env: {...process.env, PYTHONUNBUFFERED: '1'}});
  t.after(() => server.kill());
  const origin = await new Promise((resolve, reject) => {
    server.stdout.on('data', chunk => {
      const match = chunk.toString().match(/port (\d+)/);
      if (match) resolve(`http://127.0.0.1:${match[1]}`);
    });
    server.on('error', reject);
    server.on('exit', code => reject(new Error(`Static server exited: ${code}`)));
  });
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  t.after(() => browser.close());
  const context = await browser.newContext({...devices['iPhone 13']});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://telegram.org/**', route => route.fulfill({contentType: 'application/javascript', body: ''}));
  const requests = [];
  if (connected) {
    await page.route('**/config.js', route => route.fulfill({contentType: 'application/javascript', body: "window.MOON_CAMPUS_API_BASE='https://api.example.test'; window.Telegram={WebApp:{initData:'synthetic-signed-data',ready(){}}};"}));
    await page.route('https://api.example.test/**', route => {
      requests.push(route.request().postDataJSON());
      const registration = route.request().url().endsWith('/register');
      return route.fulfill({status: registration ? registerStatus : reserveStatus, contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify(registration ? {pseudonym: 'Silver Fern'} : {pseudonym: 'Silver Fern', token: 'synthetic-reservation', expires_in: expiresIn})});
    });
  }
  await page.goto(`${origin}/#invite=${'x'.repeat(43)}`);
  await page.waitForFunction(() => document.getElementById('pseudonym').textContent !== 'Выбираем…');
  return {page, requests, errors};
}

test('iPhone preview: two words, no repeats, no identity inputs or horizontal overflow', async t => {
  const {page, errors} = await fixture(t);
  const seen = new Set();
  for (let i = 0; i < 120; i++) {
    const alias = await page.locator('#pseudonym').textContent();
    assert.match(alias, /^[A-Za-z]+ [A-Za-z]+$/);
    assert.notEqual(alias, 'Lunar Thyme');
    assert(!seen.has(alias));
    seen.add(alias);
    await page.locator('#refresh').click();
  }
  assert.equal(await page.locator('input').count(), 0);
  assert(await page.locator('#continue').isDisabled());
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({width, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert((await page.locator('#refresh').boundingBox()).height >= 44);
  }
  await page.evaluate(() => localStorage.setItem('usedAliases', '{broken'));
  await page.reload();
  assert.match(await page.locator('#pseudonym').textContent(), /^[A-Za-z]+ [A-Za-z]+$/);
  assert.deepEqual(errors, []);
});

test('connected registration sends only signed auth, invitation and server token', async t => {
  const {page, requests, errors} = await fixture(t, {connected: true});
  assert.equal(await page.locator('#pseudonym').textContent(), 'Silver Fern');
  await page.locator('#continue').click();
  await page.waitForFunction(() => document.getElementById('continue').textContent === 'Профиль создан');
  assert(await page.locator('#continue').isDisabled());
  assert(await page.locator('#refresh').isDisabled());
  assert.deepEqual(Object.keys(requests[1]).sort(), ['init_data', 'invitation_token', 'pseudonym_token']);
  assert.deepEqual(errors, []);
});

test('failed reservation cannot enable registration', async t => {
  const {page} = await fixture(t, {connected: true, reserveStatus: 503});
  assert(await page.locator('#continue').isDisabled());
  assert.match(await page.locator('#status').textContent(), /недоступна/);
});

test('expired reservation disables submit', async t => {
  const {page} = await fixture(t, {connected: true, expiresIn: 0.05});
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('истекло'));
  assert(await page.locator('#continue').isDisabled());
});

test('registration conflict is visible and permits a new reservation', async t => {
  const {page} = await fixture(t, {connected: true, registerStatus: 409});
  await page.locator('#continue').click();
  await page.waitForFunction(() => document.getElementById('status').textContent.includes('использованы'));
  assert(await page.locator('#continue').isDisabled());
  assert(!(await page.locator('#refresh').isDisabled()));
});
