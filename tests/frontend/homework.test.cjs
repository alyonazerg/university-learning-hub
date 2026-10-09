const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium, devices} = require('playwright');
const {spawn} = require('node:child_process');
const path = require('node:path');

async function openHomework(t, options = {}) {
  const server = spawn('python', ['-m', 'http.server', '0', '--bind', '127.0.0.1', '--directory', path.resolve(__dirname, '../../frontend')], {env: {...process.env, PYTHONUNBUFFERED: '1'}});
  t.after(() => server.kill());
  const origin = await new Promise((resolve, reject) => {
    server.stdout.on('data', data => {const match = data.toString().match(/port (\d+)/); if (match) resolve(`http://127.0.0.1:${match[1]}`);});
    server.on('error', reject);
    server.on('exit', code => reject(new Error(`Static server exited: ${code}`)));
  });
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox']});
  t.after(() => browser.close());
  const page = await browser.newPage({...options});
  const errors = []; const writes = []; const external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.method() !== 'GET') writes.push(request.url());
    if (!request.url().startsWith(origin)) external.push(request.url());
  });
  await page.goto(`${origin}/homework.html`);
  return {page, errors, writes, external};
}
async function createTask(page, {title = 'Synthetic homework', group = 'demo-group-1', deadline} = {}) {
  await page.locator('#new-task').click();
  await page.locator('#assignment-title').fill(title);
  await page.locator('#assignment-description').fill('Write a letter about an imaginary moon garden.');
  await page.locator('#assignment-group').selectOption(group);
  if (deadline) await page.locator('#assignment-deadline').fill(deadline);
  await page.locator('#assignment-form button[type=submit]').click();
}
async function submitText(page, text) {
  await page.locator('#submission-content').fill(text);
  await page.locator('#submission-form button[type=submit]').click();
}

test('full teacher → student → teacher → student feedback cycle', async t => {
  const {page, errors, writes} = await openHomework(t);
  await createTask(page);
  assert.equal(await page.locator('#task-count').textContent(), '4');
  await page.locator('#student-view').click();
  assert.equal(await page.locator('#task-count').textContent(), '3');
  assert.equal(await page.locator('#task-details-title').textContent(), 'Synthetic homework');
  await submitText(page, 'A synthetic letter from a moonlit garden.');
  await page.waitForFunction(() => document.getElementById('pending-work-count').textContent === '1');
  assert.equal(await page.locator('.submission-card').count(), 1);
  await page.locator('#teacher-view').click();
  assert.equal(await page.locator('.submission-card strong').first().textContent(), 'Silver Fern');
  await page.getByRole('button', {name: 'Оставить комментарий'}).click();
  await page.locator('#review-feedback').fill('Lovely imaginary garden. Add two questions in your next draft.');
  await page.locator('#review-form button[type=submit]').click();
  await page.locator('#student-view').click();
  assert.match(await page.locator('.feedback-box').textContent(), /Add two questions/);
  assert.equal(await page.locator('#feedback-count').textContent(), '1');
  assert.equal(await page.locator('#pending-work-count').textContent(), '0');
  await page.reload();
  assert.equal(await page.locator('#task-count').textContent(), '3');
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
});

test('student projection excludes other groups, students and their feedback', async t => {
  const {page, errors} = await openHomework(t);
  await page.getByRole('button', {name: 'Оставить комментарий'}).click();
  await page.locator('#review-feedback').fill('Synthetic comment for a different demo student.');
  await page.locator('#review-form button[type=submit]').click();
  await createTask(page, {title: 'Group two only', group: 'demo-group-2'});
  await page.locator('#student-view').click();
  const body = await page.locator('main').textContent();
  assert(!body.includes('Group two only'));
  assert(!body.includes('Silver Willow'));
  assert(!body.includes('Synthetic comment for a different demo student.'));
  assert.equal(await page.locator('.submission-card').count(), 0);
  assert.equal(await page.locator('#task-count').textContent(), '2');
  assert(await page.locator('#new-task').isHidden());
  assert.deepEqual(errors, []);
});

test('three immutable attempts, duplicate rejection and version-specific feedback', async t => {
  const {page, errors} = await openHomework(t);
  await page.locator('#student-view').click();
  await submitText(page, 'Synthetic version one.');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 1);
  await submitText(page, 'Synthetic version one.');
  await page.waitForFunction(() => document.getElementById('submission-error').textContent.includes('уже отправлена'));
  assert.equal(await page.locator('.submission-card').count(), 1);
  await page.locator('#teacher-view').click();
  await page.locator('.submission-card').filter({hasText: 'Silver Fern'}).getByRole('button', {name: 'Оставить комментарий'}).click();
  await page.locator('#review-feedback').fill('Feedback only for version one.');
  await page.locator('#review-form button[type=submit]').click();
  await page.locator('#student-view').click();
  await submitText(page, 'Synthetic version two.');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 2);
  assert.match(await page.locator('.submission-card').first().textContent(), /Работа на проверке/);
  assert(!(await page.locator('.submission-card').first().textContent()).includes('Feedback only'));
  assert.match(await page.locator('.submission-card').last().textContent(), /Synthetic version one/);
  assert.match(await page.locator('.submission-card').last().textContent(), /Feedback only for version one/);
  await submitText(page, 'Synthetic version three.');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 3);
  assert.equal(await page.locator('#submission-form').count(), 0);
  assert.match(await page.locator('main').textContent(), /Все три попытки использованы/);
  assert.deepEqual(errors, []);
});

test('document links require HTTPS, are not fetched, and text is rendered literally', async t => {
  const {page, errors, writes, external} = await openHomework(t);
  await page.locator('#student-view').click();
  await page.locator('#submission-kind').selectOption('url');
  await submitText(page, 'http://example.invalid/document');
  assert.match(await page.locator('#submission-error').textContent(), /HTTPS/);
  await submitText(page, 'https://name:password@example.invalid/document');
  assert.match(await page.locator('#submission-error').textContent(), /без логина/);
  await submitText(page, 'https://example.invalid/synthetic-document');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 1);
  const link = page.locator('.submission-card a');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  await page.locator('#submission-kind').selectOption('text');
  await submitText(page, '<img src=x onerror=alert(1)>');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 2);
  assert.equal(await page.locator('img').count(), 0);
  assert.match(await page.locator('.submission-card').first().textContent(), /<img src=x/);
  assert.deepEqual(errors, []); assert.deepEqual(writes, []); assert.deepEqual(external, []);
});

test('deadlines use Moscow regardless of browser timezone, and lateness adds no penalty', async t => {
  const {page, errors} = await openHomework(t, {timezoneId: 'America/Los_Angeles'});
  await page.clock.install({time: new Date('2026-10-09T09:00:00Z')});
  await createTask(page, {title: 'Moscow deadline', deadline: '2026-10-10T18:00'});
  assert.match(await page.locator('.deadline-note').textContent(), /18:00/);
  await page.clock.fastForward(31 * 3600000); // 10 Oct 16:00 UTC = 19:00 MSK.
  await page.locator('#student-view').click();
  assert.match(await page.locator('.deadline-note').textContent(), /Срок прошёл/);
  await submitText(page, 'Synthetic late work.');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 1);
  assert.match(await page.locator('.submission-card').textContent(), /После срока/);
  assert(!(await page.locator('main').textContent()).includes('20%'));
  assert.deepEqual(errors, []);
});

test('mobile layouts and dialogs support assignment and submission flows', async t => {
  const {page, errors} = await openHomework(t, {...devices['iPhone 13']});
  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({width, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  await page.locator('#new-task').click();
  assert(await page.locator('#assignment-title').evaluate(el => el === document.activeElement));
  await page.keyboard.press('Escape');
  assert(!(await page.locator('#assignment-dialog').isVisible()));
  await page.locator('#student-view').click();
  await submitText(page, 'Long synthetic content '.repeat(200));
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 1);
  for (const width of [320, 375, 390]) {
    await page.setViewportSize({width, height: 844});
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.deepEqual(errors, []);
});
