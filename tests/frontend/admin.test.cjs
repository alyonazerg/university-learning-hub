const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium, devices} = require('playwright');
const {spawn} = require('node:child_process');
const path = require('node:path');

async function openDashboard(t, mobile = false) {
  const server = spawn('python', ['-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', path.resolve(__dirname, '../../frontend')], {env: {...process.env, PYTHONUNBUFFERED: '1'}});
  t.after(() => server.kill());
  const origin = await new Promise((resolve, reject) => {
    server.stdout.on('data', data => {const match = data.toString().match(/port (\d+)/); if (match) resolve(`http://127.0.0.1:${match[1]}`);});
    server.on('error', reject);
    server.on('exit', code => reject(new Error(`Static server exited: ${code}`)));
  });
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  t.after(() => browser.close());
  const page = await browser.newPage(mobile ? {...devices['iPhone 13']} : {viewport: {width: 1440, height: 1000}});
  const errors = [];
  const unsafeRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {if (request.method() !== 'GET') unsafeRequests.push(request.url());});
  await page.goto(`${origin}/admin.html`);
  return {page, errors, unsafeRequests};
}

test('teacher overview has eight synthetic groups, registration counts and private-data-free records', async t => {
  const {page, errors, unsafeRequests} = await openDashboard(t);
  assert.equal(await page.locator('.group-card').count(), 8);
  assert.equal(await page.locator('#registered-count').textContent(), '96');
  assert.equal(await page.locator('#pending-count').textContent(), '24');
  assert.equal(await page.locator('.member-row').count(), 15);
  assert.match(await page.locator('.demo-banner').textContent(), /вымышлены/);
  assert.equal(await page.locator('input[type=password]').count(), 0);
  await page.locator('.group-card').nth(1).click();
  assert.match(await page.locator('#selected-group-title').textContent(), /02/);
  await page.locator('#member-search').fill('Amber Fern');
  assert.equal(await page.locator('.member-row').count(), 1);
  await page.locator('#member-search').fill('');
  await page.locator('#status-filter').selectOption('pending');
  assert.equal(await page.locator('.member-row').count(), 3);
  await page.locator('#group-search').fill('не существует');
  assert.equal(await page.locator('.group-card').count(), 0);
  assert.match(await page.locator('#group-list').textContent(), /нет/);
  assert.deepEqual(errors, []);
  assert.deepEqual(unsafeRequests, []);
});

test('new groups, duplicate validation and demo invitations work without persistence or API writes', async t => {
  const {page, errors, unsafeRequests} = await openDashboard(t);
  await page.locator('#add-group').click();
  await page.locator('#group-name').fill('Английский · группа 01');
  await page.locator('#group-form button[type=submit]').click();
  assert.match(await page.locator('#group-error').textContent(), /уже есть/);
  await page.locator('#group-name').fill('<img src=x onerror=alert(1)>');
  await page.locator('#group-form button[type=submit]').click();
  assert.equal(await page.locator('#group-count').textContent(), '9');
  assert.equal(await page.locator('#selected-group-title').textContent(), '<img src=x onerror=alert(1)>');
  assert.equal(await page.locator('img').count(), 0);
  await page.locator('#create-invite').click();
  assert.match(await page.locator('#invite-code').textContent(), /^DEMO-[A-F0-9]{8}$/);
  assert.match(await page.locator('#invite-result').textContent(), /не открывает регистрацию/);
  assert.equal(await page.locator('#pending-count').textContent(), '25');
  await page.reload();
  assert.equal(await page.locator('#group-count').textContent(), '8');
  assert.equal(await page.locator('#pending-count').textContent(), '24');
  assert.deepEqual(errors, []);
  assert.deepEqual(unsafeRequests, []);
});

test('iPhone dashboard has no horizontal overflow and modal works by keyboard', async t => {
  const {page, errors} = await openDashboard(t, true);
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({width, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert((await page.locator('#add-group').boundingBox()).height >= 44);
  }
  await page.locator('#add-group').click();
  assert(await page.locator('#group-dialog').isVisible());
  assert(await page.locator('#group-name').evaluate(el => document.activeElement === el));
  await page.keyboard.press('Escape');
  assert(!(await page.locator('#group-dialog').isVisible()));
  await page.locator('#create-invite').click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []);
});

test('group has one editable course and its catalog reaches the assignment page', async t => {
  const {page, errors} = await openDashboard(t);
  await page.locator('#course-filter').selectOption('grammar');
  assert.equal(await page.locator('.group-card').count(), 4);
  await page.locator('#edit-group').click();
  await page.locator('#group-name').fill('Лунные исследователи');
  await page.locator('#group-course').selectOption('grammar');
  await page.locator('#group-form button[type=submit]').click();
  assert.match(await page.locator('#group-summary').textContent(), /Грамматика/);
  await page.locator('.dashboard-links a').click();
  await page.locator('#new-task').click();
  assert.match(await page.locator('#assignment-group option[value="demo-group-1"]').textContent(), /Грамматика.*Лунные исследователи/);
  assert.deepEqual(errors, []);
});
