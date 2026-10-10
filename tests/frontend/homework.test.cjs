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
  await page.locator('#assignment-course').selectOption(Number(group.split('-').at(-1)) % 2 ? 'speech' : 'grammar');
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
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert(!/[А-Яа-яЁё]/.test(await page.locator('body').innerText()));
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
  await page.getByRole('button', {name: 'Leave a comment'}).click();
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
  await page.getByRole('button', {name: 'Leave a comment'}).click();
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
  await page.waitForFunction(() => document.getElementById('submission-error').textContent.includes('already been submitted'));
  assert.equal(await page.locator('.submission-card').count(), 1);
  await page.locator('#teacher-view').click();
  await page.locator('.submission-card').filter({hasText: 'Silver Fern'}).getByRole('button', {name: 'Leave a comment'}).click();
  await page.locator('#review-feedback').fill('Feedback only for version one.');
  await page.locator('#review-form button[type=submit]').click();
  await page.locator('#student-view').click();
  await submitText(page, 'Synthetic version two.');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 2);
  assert.match(await page.locator('.submission-card').first().textContent(), /awaiting review/);
  assert(!(await page.locator('.submission-card').first().textContent()).includes('Feedback only'));
  assert.match(await page.locator('.submission-card').last().textContent(), /Synthetic version one/);
  assert.match(await page.locator('.submission-card').last().textContent(), /Feedback only for version one/);
  await submitText(page, 'Synthetic version three.');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 3);
  assert.equal(await page.locator('#submission-form').count(), 0);
  assert.match(await page.locator('main').textContent(), /All three attempts have been used/);
  assert.deepEqual(errors, []);
});

test('document links require HTTPS, are not fetched, and text is rendered literally', async t => {
  const {page, errors, writes, external} = await openHomework(t);
  await page.locator('#student-view').click();
  await page.locator('#submission-kind').selectOption('url');
  await submitText(page, 'http://example.invalid/document');
  assert.match(await page.locator('#submission-error').textContent(), /HTTPS/);
  await submitText(page, 'https://name:password@example.invalid/document');
  assert.match(await page.locator('#submission-error').textContent(), /without a username/);
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
  assert.match(await page.locator('.deadline-note').textContent(), /The deadline has passed/);
  await submitText(page, 'Synthetic late work.');
  await page.waitForFunction(() => document.querySelectorAll('.submission-card').length === 1);
  assert.match(await page.locator('.submission-card').textContent(), /Late submission/);
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

test('course filtering and lexical suggestions require teacher approval before feedback', async t => {
  const {page, errors} = await openHomework(t);
  await page.locator('#task-course-filter').selectOption('grammar');
  assert.equal(await page.locator('.task-card').count(), 1);
  assert.match(await page.locator('.task-card').textContent(), /English Grammar/);
  await page.locator('#new-task').click();
  await page.locator('#assignment-title').fill('Vocabulary exercise');
  await page.locator('#assignment-description').fill('Use the target words in a fictional story.');
  await page.locator('#assignment-vocabulary').fill('art, would you like, moonlit');
  await page.locator('#assignment-form button[type=submit]').click();
  await page.locator('#student-view').click();
  await submitText(page, 'i like art. Would you like tea?');
  await page.locator('#teacher-view').click();
  await page.locator('.submission-card button').click();
  assert.match(await page.locator('#review-analysis').textContent(), /Found: art, would you like/);
  assert.match(await page.locator('#review-analysis').textContent(), /Not found: moonlit/);
  await page.locator('#use-suggestions').click();
  assert.match(await page.locator('#review-feedback').inputValue(), /moonlit/);
  await page.locator('#cancel-review').click();
  await page.locator('#student-view').click();
  assert.equal(await page.locator('.feedback-box').count(), 0);
  await page.locator('#teacher-view').click();
  await page.locator('.submission-card button').click();
  await page.locator('#use-suggestions').click();
  await page.locator('#review-form button[type=submit]').click();
  await page.locator('#student-view').click();
  assert.match(await page.locator('.feedback-box').textContent(), /moonlit/);
  assert.deepEqual(errors, []);
});

test('multi-group IMT is a single task with independent group visibility and construction hints', async t => {
  const {page, errors} = await openHomework(t);
  await page.locator('#new-task').click();
  await page.locator('#assignment-template').selectOption('essay');
  assert.equal(await page.locator('#assignment-type').inputValue(), 'imt');
  await page.locator('#assignment-period').fill('IMT 1 · fictional period');
  await page.locator('#assignment-constructions').fill('would rather ... than ...\nused to ...');
  await page.locator('#assignment-group-choices input[value="demo-group-3"]').check();
  await page.locator('#assignment-form button[type=submit]').click();
  assert.equal(await page.locator('#task-count').textContent(), '4');
  await page.locator('#task-group-filter').selectOption('demo-group-3');
  assert.equal(await page.locator('.task-card').count(), 1);
  assert.match(await page.locator('.assignment-details').textContent(), /IMT 1/);
  await page.locator('#task-group-filter').selectOption('demo-group-2');
  assert.equal(await page.locator('.task-card').count(), 1); // existing group-2 fixture only
  assert.doesNotMatch(await page.locator('.task-card').textContent(), /Opinion Essay/);
  await page.locator('#student-view').click();
  await submitText(page, 'I would rather read books than watch TV.');
  assert.match(await page.locator('.submission-card .analysis-box').textContent(), /patterns found: would rather/);
  assert.match(await page.locator('.submission-card .analysis-box').textContent(), /not found: used to/);
  await page.locator('#teacher-view').click();
  await page.locator('#task-group-filter').selectOption('all');
  await page.locator('#task-type-filter').selectOption('imt');
  assert.equal(await page.locator('.task-card').count(), 1);
  assert.deepEqual(errors, []);
});

test('announcements target groups, local emotes render safely, and reactions toggle per viewer', async t => {
  const {page, errors, writes, external} = await openHomework(t, {...devices['iPhone 13']});
  await page.getByRole('button', {name: '+ Post announcement', exact: true}).click();
  await page.locator('#announcement-text').fill('<img src=x> Fictional news ');
  await page.locator('#announcement-emotes button').first().click();
  for (const checkbox of await page.locator('#announcement-groups input').all()) await checkbox.uncheck();
  await page.locator('#announcement-form button[type=submit]').click();
  assert.match(await page.locator('#announcement-error').textContent(), /choose/);
  await page.locator('#announcement-groups input[value="demo-group-2"]').check();
  await page.locator('#announcement-form button[type=submit]').click();
  assert.equal(await page.locator('#announcements .notice-card').count(), 2);
  assert.equal(await page.locator('#announcements .notice-card').first().locator(':scope > p svg[aria-label="Moon smile"]').count(), 1);
  assert.equal(await page.locator('#announcements .notice-card').first().locator('.reaction-bar svg[aria-label="Moon smile"]').count(), 1);
  assert.equal(await page.locator('img').count(), 0);
  await page.locator('#student-view').click();
  assert.equal(await page.locator('#announcements .notice-card').count(), 1);
  const reaction = page.locator('#announcements [data-reaction="sprout"]').first();
  await reaction.click(); assert.equal(await reaction.getAttribute('aria-pressed'), 'true'); assert.match(await reaction.textContent(), /1/);
  await page.locator('#teacher-view').click();
  const shared = page.locator('#announcements .notice-card').last().locator('[data-reaction="sprout"]');
  assert.equal(await shared.getAttribute('aria-pressed'), 'false'); await shared.click(); assert.match(await shared.textContent(), /2/);
  await page.locator('#student-view').click(); await reaction.click(); assert.match(await reaction.textContent(), /1/);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(errors, []); assert.deepEqual(writes, []); assert.deepEqual(external, []);
});

test('empty task audience and reversed period are rejected; future Extra task cannot be submitted yet', async t => {
  const {page, errors} = await openHomework(t);
  await page.locator('#new-task').click();
  await page.locator('#assignment-title').fill('Future extra');
  await page.locator('#assignment-description').fill('Fictional future exercise.');
  await page.locator('#assignment-type').selectOption('extra');
  for (const box of await page.locator('#assignment-group-choices input').all()) await box.uncheck();
  await page.locator('#assignment-form button[type=submit]').click();
  assert.match(await page.locator('#assignment-error').textContent(), /Choose groups/);
  await page.locator('#assignment-group-choices input[value="demo-group-1"]').check();
  const deadline = await page.locator('#assignment-deadline').inputValue();
  await page.locator('#assignment-start').fill(deadline);
  await page.locator('#assignment-form button[type=submit]').click();
  assert.match(await page.locator('#assignment-error').textContent(), /before/);
  const futureStart = new Date(Date.now() + 3 * 3600000 + 3600000).toISOString().slice(0, 16);
  await page.locator('#assignment-start').fill(futureStart);
  await page.locator('#assignment-form button[type=submit]').click();
  await page.locator('#task-type-filter').selectOption('extra');
  assert.equal(await page.locator('.task-card').count(), 1);
  await page.locator('#student-view').click();
  await submitText(page, 'Future draft.');
  assert.match(await page.locator('#submission-error').textContent(), /not started yet/);
  assert.equal(await page.locator('.submission-card').count(), 0);
  assert.deepEqual(errors, []);
});

test('photos attach to homework snapshots and post comments; unsafe files are rejected', async t => {
  const {page, errors} = await openHomework(t);
  const image = {name: 'fictional.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5sAAAAASUVORK5CYII=', 'base64')};
  await page.locator('#student-view').click();
  await page.locator('#submission-photos').setInputFiles(image);
  await page.locator('#submission-form .photo-gallery img').waitFor();
  await page.locator('#submission-form button[type=submit]').click();
  await page.locator('.submission-card .photo-gallery img').waitFor();
  assert.match(await page.locator('.submission-card .analysis-box').textContent(), /Photos are not recognized/);
  const notice = page.locator('#announcements .notice-card').first();
  await notice.locator('input[type=file]').setInputFiles(image);
  await notice.locator('form .photo-gallery img').waitFor();
  await notice.locator('form').getByRole('button', {name: 'Insert: Nervous', exact: true}).click();
  await notice.getByRole('button', {name: 'Add comment', exact: true}).click();
  await notice.locator('.post-comment .photo-gallery img').waitFor();
  assert.equal(await notice.locator('.post-comment svg[aria-label="Nervous"]').count(), 1);
  await page.locator('#submission-photos').setInputFiles({name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>')});
  assert.match(await page.locator('#submission-form').textContent(), /JPG, PNG/);
  await page.locator('#submission-content').fill('Another text.');
  await page.locator('#submission-form button[type=submit]').click();
  assert.match(await page.locator('#submission-error').textContent(), /supported/);
  assert.deepEqual(errors, []);
});

async function createCheckpoint(page, title = 'Checkpoint One') {
  await page.locator('#new-task').click();
  await page.locator('#assignment-title').fill(title);
  await page.locator('#assignment-description').fill('Fictional checkpoint assessment.');
  await page.locator('#assignment-type').selectOption('checkpoint');
  const deadline = await page.locator('#assignment-deadline').inputValue();
  await page.locator('#assignment-period-end').fill(deadline);
  await page.locator('#assignment-test-date').fill(deadline);
  await page.locator('#assignment-form button[type=submit]').click();
}

test('checkpoint dates, private results/photo and atomic CSV import', async t => {
  const {page, errors} = await openHomework(t, {...devices['iPhone 13']});
  await createCheckpoint(page);
  assert.match(await page.locator('.checkpoint-dates').textContent(), /Learning period:.*test:.*Moscow time/);
  const image = {name: 'fictional-work.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5sAAAAASUVORK5CYII=', 'base64')};
  await page.locator('#result-score').fill('');
  await page.locator('#result-photos').setInputFiles(image);
  await page.locator('.result-form .photo-gallery img').waitFor();
  await page.getByRole('button', {name: 'Save result and photos', exact: true}).click();
  assert.match(await page.locator('.checkpoint-result').textContent(), /result not entered yet/);
  await page.locator('#result-score').fill('7');
  await page.getByRole('button', {name: 'Save result and photos', exact: true}).click();
  assert.equal(await page.locator('.checkpoint-result img').count(), 1);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#result-import').setInputFiles({name: 'results.csv', mimeType: 'text/csv', buffer: Buffer.from('Silver Fern;9;10\nUnknown Alias;5;10')});
  await page.getByText('Check aliases, duplicates and scores. Nothing has been imported.', {exact: true}).waitFor();
  assert.match(await page.locator('.checkpoint-result').textContent(), /7 \/ 10/);
  await page.locator('#result-import').setInputFiles({name: 'valid.csv', mimeType: 'text/csv', buffer: Buffer.from('Silver Fern;9;10\nSilver Willow;4;10')});
  await page.locator('.checkpoint-result').nth(1).waitFor();
  assert.equal(await page.locator('.checkpoint-result').count(), 2);
  await page.locator('#student-view').click();
  assert.equal(await page.locator('.checkpoint-result').count(), 1);
  assert.match(await page.locator('.checkpoint-result').textContent(), /Silver Fern.*9 \/ 10/s);
  assert.doesNotMatch(await page.locator('.checkpoint-results').textContent(), /Silver Willow/);
  assert.equal(await page.locator('.checkpoint-result img').count(), 1);
  assert.equal(await page.locator('#result-import').count(), 0);
  assert.deepEqual(errors, []);
});

test('compensation permission is period-specific and revocation preserves older versions', async t => {
  const {page, errors} = await openHomework(t);
  await createCheckpoint(page, 'Period One');
  await page.locator('#new-task').click();
  await page.locator('#assignment-title').fill('Compensation One');
  await page.locator('#assignment-description').fill('Fictional compensation.');
  await page.locator('#assignment-type').selectOption('compensation');
  await page.locator('#assignment-checkpoint').selectOption({label: 'Period One · period'});
  await page.locator('#assignment-form button[type=submit]').click();
  await page.locator('#student-view').click();
  assert.doesNotMatch((await page.locator('.task-card').allTextContents()).join(' '), /Compensation One/);
  await page.locator('#teacher-view').click();
  await page.locator('.task-card').filter({hasText: 'Period One'}).click();
  await page.locator('.certificate-row input[data-student-id="demo-student-1"]').check();
  await page.locator('#student-view').click();
  await page.locator('.task-card').filter({hasText: 'Compensation One'}).click();
  await submitText(page, 'A fictional compensation answer.');
  await page.locator('.submission-card').waitFor();
  await page.locator('#teacher-view').click();
  await createCheckpoint(page, 'Period Two');
  assert.equal(await page.locator('.certificate-row input[data-student-id="demo-student-1"]').isChecked(), false);
  await page.locator('#new-task').click();
  await page.locator('#assignment-title').fill('Compensation Two');
  await page.locator('#assignment-description').fill('Another fictional compensation.');
  await page.locator('#assignment-type').selectOption('compensation');
  await page.locator('#assignment-checkpoint').selectOption({label: 'Period Two · period'});
  await page.locator('#assignment-form button[type=submit]').click();
  await page.locator('#student-view').click();
  assert.doesNotMatch((await page.locator('.task-card').allTextContents()).join(' '), /Compensation Two/);
  await page.locator('#teacher-view').click();
  await page.locator('.task-card').filter({hasText: 'Period One'}).click();
  await page.locator('.certificate-row input[data-student-id="demo-student-1"]').uncheck();
  await page.locator('#student-view').click();
  await page.locator('.task-card').filter({hasText: 'Compensation One'}).click();
  assert.equal(await page.locator('#submission-form').count(), 0);
  assert.match(await page.locator('.compensation-locked').textContent(), /closed/);
  assert.match(await page.locator('.submission-card .work-content').textContent(), /fictional compensation answer/);
  assert.deepEqual(errors, []);
});
