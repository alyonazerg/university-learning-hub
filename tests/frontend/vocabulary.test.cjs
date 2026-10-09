const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium, devices} = require('playwright');
const {spawn} = require('node:child_process');
const path = require('node:path');

async function openVocabulary(t, options = {}) {
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
  await page.goto(`${origin}/vocabulary.html`);
  return {page, errors, writes, external};
}
test('teacher bulk list reaches homework, and emergent words require approval for cards', async t => {
  const {page, errors, writes} = await openVocabulary(t);
  await page.locator('#list-title').fill('Presentation Unit 2');
  await page.locator('#list-source').fill('Fictional slides');
  await page.locator('#word-list').fill('wonder; удивляться; I wonder.\nmoonlit; лунный; A garden.');
  await page.locator('#save-list').click();
  assert.match(await page.locator('#vocab-lists').textContent(), /Presentation Unit 2/);
  await page.locator('#vocab-student').click();
  await page.locator('#list-title').fill('Found in a story');
  await page.locator('#word-list').fill('stardust; звёздная пыль; Tiny stardust.');
  await page.locator('#save-list').click();
  assert.match(await page.locator('#vocab-lists').textContent(), /На проверке/);
  assert.match(await page.locator('.learning-progress').textContent(), /из 5/);
  await page.locator('#vocab-teacher').click();
  await page.getByRole('button', {name: 'Одобрить для карточек группы'}).click();
  await page.locator('#vocab-student').click();
  assert.match(await page.locator('.learning-progress').textContent(), /из 6/);
  await page.locator('#vocab-teacher').click();
  await page.locator('#vocab-homework').click();
  await page.locator('#new-task').click();
  await page.locator('#assignment-word-list').selectOption({label: 'Presentation Unit 2'});
  assert.equal(await page.locator('#assignment-vocabulary').inputValue(), 'wonder\nmoonlit');
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
});
test('student cards record progress without farming, ranking is opt-in and cross-group is team-only', async t => {
  const {page, errors} = await openVocabulary(t, {...devices['iPhone 13']});
  await page.locator('#vocab-student').click();
  assert.equal(await page.locator('#rank-opt-in').isChecked(), false);
  assert.doesNotMatch(await page.locator('.own-group-rank').allTextContents().then(x=>x.join(' ')), /Silver Fern/);
  await page.getByRole('button', {name: 'Показать перевод и пример'}).click();
  await page.getByRole('button', {name: 'Помню', exact: true}).click();
  assert.match(await page.locator('.learning-progress').textContent(), /повторений: 1 · streak: 1/);
  await page.locator('#rank-opt-in').check();
  assert.match((await page.locator('.own-group-rank').allTextContents()).join(' '), /Silver Fern1 XP/);
  const teamText = (await page.locator('.team-rank').allTextContents()).join(' ');
  assert.doesNotMatch(teamText, /Silver|Amber|Fern|Willow/);
  for (const width of [320, 375, 390, 430]) {await page.setViewportSize({width, height: 844}); assert(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));}
  await page.reload(); await page.locator('#vocab-student').click();
  assert.match(await page.locator('.learning-progress').textContent(), /повторений: 0 · streak: 0/);
  assert.deepEqual(errors, []);
});
