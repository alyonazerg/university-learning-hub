const {test} = require('node:test');
const assert = require('node:assert/strict');
const {chromium,devices} = require('playwright');
const {spawn,spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const root = path.resolve(__dirname,'../..');
async function open(t,connected=true) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'ulh-connected-'));
  t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
  const env = {...process.env,DATABASE_URL:'sqlite:///'+path.join(directory,'learning.db'),ADMIN_TOKEN:'synthetic-browser-admin',TELEGRAM_BOT_TOKEN:'synthetic-browser-bot',CORS_ORIGINS:'["http://127.0.0.1:8080"]'};
  const python = path.join(root,'.venv/bin/python');
  let api;
  let port;
  async function startApi() {
    api = spawn(python,['-m','uvicorn','app.main:app','--host','127.0.0.1','--port',String(port)],{cwd:path.join(root,'backend'),env});
    await new Promise((resolve,reject)=>{api.stderr.on('data',data=>{if(data.toString().includes('Application startup complete')) resolve();});api.on('error',reject);api.on('exit',code=>reject(new Error('API exited '+code)));});
  }
  if(connected) {
    const seed=spawnSync(python,[path.join(__dirname,'learning-fixture.py')],{cwd:path.join(root,'backend'),env:{...env,PYTHONPATH:path.join(root,'backend')},encoding:'utf8'});
    assert.equal(seed.status,0,seed.stderr);
    port = await new Promise(resolve=>{const socket=net.createServer();socket.listen(0,'127.0.0.1',()=>{const number=socket.address().port;socket.close(()=>resolve(number));});});
    await startApi();
    t.after(()=>api?.kill());
  }
  const staticServer=spawn('python',['-m','http.server','0','--bind','127.0.0.1','--directory',path.join(root,'frontend')],{env:{...process.env,PYTHONUNBUFFERED:'1'}});
  t.after(()=>staticServer.kill());
  const origin=await new Promise((resolve,reject)=>{staticServer.stdout.on('data',data=>{const match=data.toString().match(/port (\d+)/);if(match)resolve('http://127.0.0.1:'+match[1]);});staticServer.on('error',reject);});
  // Set the exact real browser origin for API CORS. Restart without changing the DB.
  if(connected) {env.CORS_ORIGINS=JSON.stringify([origin]); const stopped=new Promise(resolve=>api.once('exit',resolve));api.kill();await stopped;await startApi();}
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  const context=await browser.newContext({...devices['iPhone 13']});
  await context.route('https://telegram.org/js/telegram-web-app.js',route=>route.fulfill({body:'// Offline SDK fixture'}));
  const apiBase=connected?'http://127.0.0.1:'+port:'';
  await context.route('**/config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.MOON_CAMPUS_API_BASE='+JSON.stringify(apiBase)+';'}));
  const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  async function pageFor(uid) {
    const page=await context.newPage();
    if(uid) {
      const data={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:uid})};
      const check=Object.keys(data).sort().map(key=>key+'='+data[key]).join('\n');
      const secret=crypto.createHmac('sha256','WebAppData').update('synthetic-browser-bot').digest();
      const hash=crypto.createHmac('sha256',secret).update(check).digest('hex');
      const initData=new URLSearchParams({...data,hash}).toString();
      await page.addInitScript(value=>{window.Telegram={WebApp:{initData:value}};},initData);
    }
    await page.goto(origin+'/learning.html');return page;
  }
  return {pageFor,errors,restart:async()=>{const stopped=new Promise(resolve=>api.once('exit',resolve));api.kill();await stopped;await startApi();}};
}
async function teacher(page) {await page.locator('summary').first().click();await page.locator('#admin-key').fill('synthetic-browser-admin');await page.getByRole('button',{name:'Sign in as teacher',exact:true}).click();await page.locator('#workspace').waitFor();}
async function section(page,id) {await page.locator('.dashboard-links a[href="#'+id+'"]').click();}
async function vocabulary(page) {await section(page,'connected-vocabulary-editor');await page.locator('#connected-vocabulary-editor summary').click();}
async function student(page) {await page.locator('#telegram-sign-in').click();await page.locator('#workspace').waitFor();}
test('unconfigured published cabinet disables login and never pretends to save',async t=>{
  const {pageFor,errors}=await open(t,false);const page=await pageFor();
  assert.match(await page.locator('#connection-state').textContent(),/not connected yet/);
  assert(await page.locator('#telegram-sign-in').isDisabled());
  assert(!(await page.locator('#workspace').isVisible()));assert.deepEqual(errors,[]);
});

test('older API without planning still allows teacher login and existing cabinet sections',async t=>{
  const {pageFor,errors}=await open(t);const page=await pageFor();
  await page.route('**/learning/plans',route=>route.fulfill({status:404,contentType:'application/json',body:'{"detail":"Not Found"}'}));
  await teacher(page);
  await section(page,'connected-groups');assert(await page.locator('#connected-groups').isVisible());await section(page,'connected-schedule');
  assert.match(await page.locator('#connected-schedule').textContent(),/Update the server/);
  assert.deepEqual(errors,[]);
});

test('schedule and thematic plan persist, create one attendance journal and keep cabinet spacing on mobile',async t=>{
  const {pageFor,errors,restart}=await open(t);const page=await pageFor();await teacher(page);
  await page.getByText('Add weekly schedule',{exact:true}).click();
  await page.locator('#weekly-from').fill('2026-10-12');await page.locator('#weekly-until').fill('2026-10-26');
  await page.locator('#weekly-time').fill('10:00');await page.getByRole('button',{name:'Add schedule',exact:true}).click();
  await page.getByText('Schedule saved. Topics are available in the teaching plan.',{exact:true}).waitFor();
  assert.equal(await page.locator('#connected-schedule .schedule-card').count(),3);
  await section(page,'connected-planning');await page.getByText('Add topic list',{exact:true}).click();
  await page.locator('#plan-bulk-topics').fill('Revision\nSpeaking workshop');
  await page.getByRole('button',{name:'Save topic list',exact:true}).click();
  await page.getByText('Topic list saved. You can add dates later.',{exact:true}).waitFor();
  assert.equal(await page.locator('#connected-planning article').count(),5);
  const first=page.locator('#connected-planning article').first();await first.getByText('Edit topic',{exact:true}).click();
  await first.locator('[id^=plan-topic-]').fill('Narrative tenses');
  await first.locator('[id^=plan-materials-]').fill('Unit 2');
  await first.getByRole('button',{name:'Save topic changes',exact:true}).click();await page.getByText('Topic saved.',{exact:true}).waitFor();
  await first.getByRole('button',{name:'Create attendance register',exact:true}).click();await page.getByText('Attendance register ready.',{exact:true}).waitFor();
  assert.equal(await page.locator('#connected-attendance article').count(),1);
  await section(page,'connected-planning');await first.getByRole('button',{name:'Open attendance',exact:true}).click();await page.getByText('Attendance register ready.',{exact:true}).waitFor();
  assert.equal(await page.locator('#connected-attendance article').count(),1);
  await restart();await page.reload();await teacher(page);
  assert.match(await page.locator('#connected-planning').textContent(),/Narrative tenses/);
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await section(page,'connected-groups'); await page.locator('#connected-groups > details').evaluate(el=>el.open=true);
    assert(await page.locator('#connected-group-form button').evaluate(el=>el.getBoundingClientRect().top-document.querySelector('#new-group-course').getBoundingClientRect().bottom>=12));
  }
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/workspace/work/cabinet-planning-desktop.png'});
  const learner=await pageFor(11);await student(learner);assert.match(await learner.locator('#connected-planning').textContent(),/Narrative tenses/);
  assert.equal(await learner.getByText('Add weekly schedule',{exact:true}).count(),0);
  const foreign=await pageFor(22);await student(foreign);assert.equal(await foreign.locator('#connected-schedule .schedule-card').count(),0);
  assert.deepEqual(errors,[]);
});
test('real API saves cards and reviews through browser reload and server restart',async t=>{
  const {pageFor,errors,restart}=await open(t);const teacherPage=await pageFor();await teacher(teacherPage);await vocabulary(teacherPage);
  await teacherPage.locator('#connected-title').fill('Persistent target vocabulary');
  await teacherPage.locator('#connected-words').fill(JSON.stringify([{term:'searing pain',meaning:'жгучая боль',definition:'Intense burning pain.',transcription:'[IPA]',synonyms:['burning pain'],antonyms:['dull ache'],collocations:['pain in the chest'],example:'She felt a searing pain.'}]));
  await teacherPage.locator('#connected-save').click();await teacherPage.getByText('List saved for the group.',{exact:true}).waitFor();
  const page=await pageFor(11);await student(page);await vocabulary(page);
  assert.match(await page.locator('.card-definition').textContent(),/Intense burning pain/);
  await page.getByRole('button',{name:'👀 Show',exact:true}).click();
  await page.getByRole('button',{name:'🇷🇺 Show meaning',exact:true}).click();assert(await page.locator('#connected-translation').isVisible());
  await page.getByRole('button',{name:/🙂 Good/}).click();await page.getByText('Review saved.',{exact:true}).waitFor();
  assert.match(await page.locator('.learning-progress').textContent(),/XP: 1 · streak: 1/);
  await restart();await page.locator('#refresh-account').click();await page.getByRole('button',{name:'Refresh',exact:true}).waitFor({state:'visible'});
  // Wait for the real HTTP refresh to settle before asserting durable state.
  await page.waitForFunction(()=>!document.getElementById('refresh-account').disabled);
  assert.match(await page.locator('.learning-progress').textContent(),/XP: 1/);
  await page.reload();await student(page);assert.match(await page.locator('.learning-progress').textContent(),/XP: 1/);
  const other=await pageFor(12);await student(other);assert.match(await other.locator('.learning-progress').textContent(),/XP: 0/);
  const foreign=await pageFor(22);await student(foreign);assert.match(await foreign.locator('.learning-progress').textContent(),/of 0/);
  for(const width of [320,375,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.locator('#sign-out').click();await page.locator('#sign-in').waitFor();assert.equal(await page.locator('#connected-decks article').count(),0);
  assert.deepEqual(errors,[]);
});
test('real API enforces editor assignment and teacher approval in the browser',async t=>{
  const {pageFor,errors}=await open(t);const adminPage=await pageFor();await teacher(adminPage);
  const page=await pageFor(11);await student(page);await vocabulary(page);
  await page.locator('#connected-title').fill('Rich student draft');await page.locator('#connected-words').fill(JSON.stringify([{term:'moonlit',meaning:'лунный',definition:'Lit by the moon.'}]));
  await page.locator('#connected-save').click();await page.getByText('Only the assigned editor can prepare full cards. You can suggest a simple word list.',{exact:true}).waitFor();
  await section(adminPage,'connected-groups');await adminPage.locator('#editor-1').selectOption({label:'Silver Fern'});await adminPage.getByRole('button',{name:'Save editor · Synthetic speech',exact:true}).click();await adminPage.getByText('Group editor saved.',{exact:true}).waitFor();
  await page.locator('#refresh-account').click();await page.getByText(/You are your group’s vocabulary editor/).waitFor();
  await page.locator('#connected-save').click();await page.getByText('List saved and awaiting review.',{exact:true}).waitFor();assert.match(await page.locator('.learning-progress').textContent(),/of 0/);
  await adminPage.locator('#refresh-account').click();await section(adminPage,'connected-vocabulary-editor');await adminPage.getByRole('button',{name:'Edit · Rich student draft',exact:true}).click();
  await adminPage.locator('#connected-decks textarea').fill(JSON.stringify([{term:'moonlit',meaning:'освещённый луной',definition:'Illuminated by moonlight.'}]));
  await adminPage.getByRole('button',{name:'Save corrections',exact:true}).click();await adminPage.getByText('Draft updated. You can now approve the list.',{exact:true}).waitFor();
  await adminPage.getByRole('button',{name:'Approve · Rich student draft',exact:true}).click();await adminPage.getByText('List approved.',{exact:true}).waitFor();
  await page.locator('#refresh-account').click();await page.locator('.card-definition').waitFor();assert.match(await page.locator('.learning-progress').textContent(),/of 1/);assert.equal(await page.locator('.card-definition').textContent(),'Illuminated by moonlight.');
  await section(adminPage,'connected-groups');await adminPage.locator('#connected-groups > details').evaluate(el=>el.open=true);await adminPage.locator('#new-group-name').fill('Evening grammar');await adminPage.locator('#new-group-course').selectOption('grammar');await adminPage.getByRole('button',{name:'Create group',exact:true}).click();await adminPage.getByText('Group created.',{exact:true}).waitFor();
  assert.match(await adminPage.locator('#group-editors').textContent(),/Evening grammar/);assert.deepEqual(errors,[]);
});

test('coursework, certificate access, photos and alias attendance survive a real server restart', async t => {
  const {pageFor, errors, restart} = await open(t);
  const adminPage = await pageFor(); await teacher(adminPage);
  async function createTask(title, kind, checkpoint) {
    await section(adminPage,'connected-coursework');await adminPage.getByText('Create assignment', {exact:true}).click();
    await adminPage.locator('#server-task-title').fill(title);
    await adminPage.locator('#server-task-description').fill('Use moonlit and would ... like.');
    await adminPage.getByRole('checkbox', {name:'Assignment for Synthetic speech', exact:true}).check();
    await adminPage.locator('#server-task-kind').selectOption(kind);
    if (checkpoint) await adminPage.locator('#server-task-checkpoint').selectOption({label:checkpoint});
    await adminPage.locator('#server-task-vocabulary').fill('moonlit');
    await adminPage.locator('#server-task-constructions').fill('would ... like');
    await adminPage.locator('#server-task-save').click();
    await adminPage.getByText('Assignment saved for the selected groups.', {exact:true}).waitFor();
  }
  await createTask('October checkpoint', 'checkpoint');
  await createTask('October compensation', 'compensation', 'October checkpoint');
  const page = await pageFor(11); await student(page);await section(page,'connected-coursework');
  const compensation = page.locator('#connected-coursework article').filter({has:page.getByRole('heading', {name:'October compensation', exact:true})});
  await compensation.getByText('Access will open after your teacher checks your certificate.', {exact:true}).waitFor();
  assert.equal(await compensation.getByRole('button', {name:'Submit work'}).count(), 0);
  const checkpoint = adminPage.locator('#connected-coursework article').filter({has:adminPage.getByRole('heading', {name:'October checkpoint', exact:true})});
  await checkpoint.getByRole('checkbox', {name:'Certificate checked · Silver Fern', exact:true}).check();
  await adminPage.getByText('Approval saved.', {exact:true}).waitFor();
  await page.locator('#refresh-account').click();
  await compensation.getByRole('button', {name:'Submit work'}).waitFor();
  await compensation.locator('textarea').fill('A moonlit night. Would you like to visit?');
  await compensation.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9V8AAAAASUVORK5CYII=','base64')});
  await compensation.locator('form .photo-gallery img').waitFor();
  await compensation.getByRole('button', {name:'Submit work'}).click();
  await page.getByText('Work saved.', {exact:true}).waitFor();
  await adminPage.locator('#refresh-account').click();
  const adminCompensation = adminPage.locator('#connected-coursework article').filter({has:adminPage.getByRole('heading', {name:'October compensation', exact:true})});
  await adminCompensation.locator('textarea').fill('Good use of moonlit.');
  await adminCompensation.getByRole('button', {name:'Save feedback'}).click();
  await adminPage.getByText('Feedback saved.', {exact:true}).waitFor();
  await section(adminPage,'connected-attendance');await adminPage.getByText('Add lesson manually',{exact:true}).click();await adminPage.locator('#server-lesson-title').fill('Speech practice · October');
  await adminPage.getByRole('button', {name:'Add lesson',exact:true}).click();
  await adminPage.getByText('Lesson saved.', {exact:true}).waitFor();
  const lesson = adminPage.locator('#connected-attendance article');
  await lesson.getByRole('button', {name:'Mark everyone present', exact:true}).click();
  await adminPage.getByText('Everyone marked present. Attendance saved.',{exact:true}).waitFor();
  await adminPage.locator('#refresh-account').click();
  assert.equal(await lesson.getByLabel('Silver Fern',{exact:true}).inputValue(),'present');
  assert.equal(await lesson.getByLabel('Silver Willow',{exact:true}).inputValue(),'present');
  await lesson.getByLabel('Silver Willow', {exact:true}).selectOption('late');
  await lesson.getByRole('button', {name:'Save attendance', exact:true}).click();
  await adminPage.getByText('Attendance saved.', {exact:true}).waitFor();
  await restart(); await page.reload(); await student(page);await section(page,'connected-coursework');
  await compensation.getByText('Teacher feedback: Good use of moonlit.', {exact:true}).waitFor();
  assert.equal(await compensation.locator('.submission-card .photo-gallery img').count(),1);
  assert.match(await compensation.textContent(), /Attempts used: 1 of 3/);
  assert.match(await page.locator('#connected-attendance').textContent(), /Present: 1/);
  assert(!((await page.locator('#connected-attendance').textContent()).includes('Silver Willow')));
  const second = await pageFor(12); await student(second);
  assert.match(await second.locator('#connected-attendance').textContent(), /Late: 1/);
  assert.equal(await second.locator('.submission-card').count(),0);
  const foreign = await pageFor(22); await student(foreign);
  assert.equal(await foreign.locator('#connected-attendance article').count(),0);
  assert.equal(await foreign.locator('#connected-coursework article').count(),0);
  for (const width of [320,375,390,430]) {await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);
});

test('empty groups explain unavailable task and attendance forms without layout overflow', async t => {
  const {pageFor,errors}=await open(t); const page=await pageFor();
  await page.route('**/learning/groups', route=>route.fulfill({contentType:'application/json',body:'[]'}));
  await teacher(page); await section(page,'connected-coursework');await page.getByText('Create assignment',{exact:true}).click();
  assert.match(await page.locator('#server-task-form fieldset').textContent(),/No groups/);
  assert(await page.locator('#server-task-save').isDisabled());
  assert.equal(await page.locator('#server-lesson-group').textContent(),'Create a group first');
  await section(page,'connected-attendance');await page.getByText('Add lesson manually',{exact:true}).click();assert(await page.getByRole('button',{name:'Add lesson',exact:true}).isDisabled());
  for(const width of [320,390,1280]) {
    await page.setViewportSize({width,height:900});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await section(page,'connected-coursework');assert(await page.locator('#server-task-form fieldset').evaluate(el=>el.getBoundingClientRect().height>60));await section(page,'connected-attendance');
    assert(await page.locator('#server-lesson-title').evaluate(el=>{const label=el.previousElementSibling;return el.getBoundingClientRect().top-label.getBoundingClientRect().bottom>=6;}));
  }
  assert.deepEqual(errors,[]);
});

test('cabinet navigation reduces visible content, supports roles and preserves unfinished forms', async t => {
  const {pageFor,errors}=await open(t);const page=await pageFor();await teacher(page);
  assert.equal(await page.locator('html').getAttribute('lang'),'en');assert(!/[А-Яа-яЁё]/.test(await page.locator('body').innerText()));
  assert(await page.locator('#connected-schedule').isVisible());
  assert(!(await page.locator('#connected-coursework').isVisible()));
  await section(page,'connected-groups');assert(!(await page.locator('#connected-group-form').isVisible()));
  await page.locator('#connected-groups > details > summary').click();await page.locator('#new-group-name').fill('Unfinished group');
  await section(page,'connected-coursework');await page.getByText('Create assignment',{exact:true}).click();await page.locator('#server-task-title').fill('Unfinished task');
  await section(page,'connected-groups');assert.equal(await page.locator('#new-group-name').inputValue(),'Unfinished group');
  await section(page,'connected-coursework');assert.equal(await page.locator('#server-task-title').inputValue(),'Unfinished task');
  for(const width of [320,390,1280]) {
    await page.setViewportSize({width,height:900});
    for(const id of ['connected-groups','connected-schedule','connected-planning','connected-vocabulary-editor','connected-coursework','connected-attendance']) {
      await section(page,id);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.equal(await page.locator('.dashboard-links [aria-current=page]').count(),1);
      assert(await page.locator('.dashboard-links [aria-current=page]').evaluate(el=>el.getBoundingClientRect().height>=44));
    }
  }
  await page.screenshot({path:'/workspace/work/cabinet-ux-desktop.png',fullPage:true});
  const learner=await pageFor(11);await student(learner);assert(!(await learner.locator('.dashboard-links a[href="#connected-groups"]').isVisible()));
  await section(learner,'connected-coursework');assert(!(await learner.getByText('Create assignment',{exact:true}).count()));
  assert.deepEqual(errors,[]);
});

test('teacher creates a real single-student Telegram invitation in the group cabinet', async t => {
  const {pageFor,errors}=await open(t);const page=await pageFor();await teacher(page);await section(page,'connected-groups');
  const group=page.locator('#group-editors article').first();await group.getByText('Invite a student',{exact:true}).click();
  await group.getByRole('button',{name:'Create invitation',exact:true}).click();
  await page.getByText('Invitation created. Share it with one student.',{exact:true}).waitFor();
  const value=await group.getByLabel('Student invitation link').inputValue();
  assert.match(value,/^https:\/\/t\.me\/mooncampusbot\?startapp=[A-Za-z0-9_-]+$/);
  assert.equal(await group.getByRole('link',{name:'Open registration in Telegram'}).getAttribute('href'),value);
  await page.setViewportSize({width:320,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[]);
});

test('reviewed autumn semester imports eight groups, honors week exceptions and preserves existing lessons',async t=>{
  const {pageFor,errors}=await open(t);const page=await pageFor();await teacher(page);await section(page,'connected-schedule');
  await page.getByText('Import reviewed autumn 2026 schedule',{exact:true}).click();
  await page.locator('#semester-from').fill('2026-10-12');await page.locator('#semester-from').dispatchEvent('change');
  const calculated=await page.evaluate(()=>window.MoonSemesterSchedule.build('2026-10-12','2026-12-29',window.MoonSemesterSchedule.weeks('2026-10-12','2026-12-29')));
  assert.equal(calculated.groups.length,8);assert.equal(calculated.groups.reduce((n,g)=>n+g.lessons.length,0),148);
  const grammar=calculated.groups.find(g=>g.name==='151');assert(grammar.lessons.some(l=>l.starts_at==='2026-10-16T11:20:00.000Z'&&l.duration_minutes===100));
  const speech=calculated.groups.find(g=>g.name==='217');assert(speech.lessons.some(l=>l.starts_at==='2026-10-12T13:00:00.000Z'));
  assert(!speech.lessons.some(l=>l.starts_at==='2026-10-16T11:20:00.000Z'));
  await page.getByText('Review week calendar',{exact:true}).click();await page.locator('#week-2026-10-12').selectOption('break');
  await page.getByRole('button',{name:'Preview groups and lessons',exact:true}).click();
  await page.getByText('135 lessons to add · 0 existing lessons kept.',{exact:true}).waitFor();
  assert.equal(await page.locator('#group-editors article').count(),2); // Preview creates nothing.
  await page.locator('#week-2026-10-12').selectOption('above');assert(!(await page.getByRole('button',{name:'Confirm import',exact:true}).isVisible()));
  await page.getByRole('button',{name:'Preview groups and lessons',exact:true}).click();await page.getByText('148 lessons to add · 0 existing lessons kept.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Confirm import',exact:true}).click();await page.getByText('Schedule imported: 148 lessons added, 0 kept.',{exact:true}).waitFor();
  assert.equal(await page.locator('#group-editors article').count(),10);
  await page.locator('#planning-group-filter').selectOption({label:'151'});assert.match(await page.locator('#connected-schedule').textContent(),/16 Oct 2026, 14:20/);
  await page.getByText('Import reviewed autumn 2026 schedule',{exact:true}).click();await page.locator('#semester-from').fill('2026-10-12');await page.locator('#semester-from').dispatchEvent('change');await page.getByRole('button',{name:'Preview groups and lessons',exact:true}).click();
  await page.getByText('0 lessons to add · 148 existing lessons kept.',{exact:true}).waitFor();
  await page.locator('#semester-from').fill('2026-09-12');await page.locator('#semester-from').dispatchEvent('change');
  await page.getByRole('button',{name:'Preview groups and lessons',exact:true}).click();await page.getByText('58 lessons to add · 148 existing lessons kept.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Confirm import',exact:true}).click();await page.getByText('Schedule imported: 58 lessons added, 148 kept.',{exact:true}).waitFor();
  await page.locator('#planning-group-filter').selectOption({label:'151'});await section(page,'connected-planning');
  assert.equal(await page.locator('#connected-planning article').count(),18);
  assert.match(await page.locator('#connected-planning').textContent(),/Lesson 18 · Credit/);
  await page.getByText('Import lesson topics · CSV / XLS / XLSX',{exact:true}).click();await page.locator('#topic-import-all').check();
  await page.getByRole('button',{name:'Preview suggested grammar plan',exact:true}).click();await page.getByRole('button',{name:'Confirm topic import',exact:true}).waitFor();
  assert.equal(await page.locator('.topic-import h3').count(),3);
  await page.getByRole('button',{name:'Confirm topic import',exact:true}).click();await page.getByText('Lesson topics imported. Existing dates were preserved unless specified in the file.',{exact:true}).waitFor();
  assert.equal(await page.locator('#connected-planning article').count(),18);
  const assessment=page.locator('#connected-planning article').filter({has:page.getByRole('heading',{name:'8. Assessment Test 1',exact:true})});
  assert.match(await assessment.textContent(),/19 Oct 2026, 12:40 · 90 min/);
  await assessment.getByText('Edit topic',{exact:true}).click();const date=assessment.locator('input[type=datetime-local]');await date.fill('2026-10-20T12:40');
  assert.equal(await assessment.locator('input[id^=plan-duration-]').inputValue(),'90');
  await assessment.getByRole('button',{name:'Save topic changes',exact:true}).click();await page.getByText('Topic saved.',{exact:true}).waitFor();
  assert.match(await assessment.textContent(),/20 Oct 2026, 12:40/);
  await assessment.getByRole('button',{name:'Mark as taught',exact:true}).click();await page.getByText('Teaching plan updated.',{exact:true}).waitFor();
  assert(await assessment.locator('.taught-badge').isVisible());assert.match(await assessment.getAttribute('class'),/plan-taught/);
  await page.locator('#refresh-account').click();assert(await assessment.locator('.taught-badge').isVisible());
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const gap=await assessment.locator('.planning-actions').evaluate(el=>{const [first,second]=[...el.children].map(x=>x.getBoundingClientRect());return Math.max(second.left-first.right,second.top-first.bottom);});assert(gap>=11);
  }
  for(const width of [320,390,1280]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);
});

test('Midcheck reuses Grammar Lab RPC with an alias and teacher preview never submits',async t=>{
  const {pageFor,errors}=await open(t,false);const page=await pageFor();let submissions=[];
  const question={assessment_id:'assessment',assessment_title:'Topic 1 Midcheck',question_id:'question',question_type:'single_choice',prompt:'Choose the noun',options:['moon','quickly']};
  await page.route('**/rest/v1/rpc/*',async route=>{
    const endpoint=route.request().url().split('/').pop();let result;
    if(endpoint==='get_active_assessment')result=[question];
    else if(endpoint==='get_assessment_timer')result={time_limit_minutes:35,time_adjustment_seconds:0};
    else if(endpoint==='submit_grammar_attempt'){submissions.push(route.request().postDataJSON());result={attempt_id:'attempt',review_token:'review',score:1,max_score:1,percentage:100};}
    else if(endpoint==='get_attempt_review')result=[{question_id:'question',is_correct:true,student_answer:'moon',correct_answer:'moon',explanation:'A noun.',textbook_reference:'Topic 1'}];
    else if(endpoint==='save_attempt_question_times')result=null;
    else throw Error(endpoint);
    await route.fulfill({contentType:'application/json',body:JSON.stringify(result),headers:{'access-control-allow-origin':'*','access-control-allow-headers':'apikey, authorization, content-type','access-control-allow-methods':'POST, OPTIONS'}});
  });
  const origin=new URL(page.url()).origin;
  await page.goto(origin+'/midcheck.html#alias=Silver%20Fern&group=150&preview=0');try{await page.locator('#start').waitFor({timeout:10000});}catch(error){throw Error(JSON.stringify(errors)+' '+await page.locator('#loading').textContent());}
  assert.equal(await page.locator('#name').inputValue(),'Silver Fern');assert(await page.locator('#name').getAttribute('readonly')!==null);
  await page.getByRole('button',{name:'Start diagnostic',exact:true}).click();await page.getByLabel('moon',{exact:true}).check();await page.getByRole('button',{name:'Submit diagnostic',exact:true}).click();
  await page.locator('#result').waitFor();assert.equal(submissions.length,1);assert.equal(submissions[0].p_full_name,'Silver Fern');assert.equal(submissions[0].p_group_code,'150');
  assert.match(await page.locator('#result').textContent(),/1 \/ 1/);
  await page.goto(origin+'/midcheck.html#alias=Teacher%20Preview&group=150&preview=1');await page.reload();await page.locator('#start').waitFor();
  await page.getByRole('button',{name:'Start diagnostic',exact:true}).click();await page.getByLabel('moon',{exact:true}).check();await page.getByRole('button',{name:'Submit diagnostic',exact:true}).click();
  await page.getByText('Teacher preview complete',{exact:true}).waitFor();assert.equal(submissions.length,1);
  assert.deepEqual(errors,[]);
});

test('teacher attaches a hosted second-year Revision Test and students can open its saved link',async t=>{
  const {pageFor,errors}=await open(t);const page=await pageFor();await teacher(page);await section(page,'connected-planning');
  await page.getByText('Add topic',{exact:true}).click();await page.locator('#plan-topic-new').fill('Revision Test 1');await page.locator('#plan-kind-new').selectOption('revision');
  await page.locator('#plan-date-new').fill('2026-10-13T12:00');await page.locator('#plan-duration-new').fill('45');await page.locator('#plan-test-url-new').fill('/assessments/revision-1/');
  await page.getByRole('button',{name:'Save topic',exact:true}).click();await page.getByText('Topic saved.',{exact:true}).waitFor();
  const link=page.getByRole('link',{name:'Open Revision Test',exact:true});assert.equal(await link.getAttribute('href'),'/assessments/revision-1/');assert.equal(await link.getAttribute('target'),'_blank');
  await page.reload();await teacher(page);await section(page,'connected-planning');assert(await link.isVisible());
  const learner=await pageFor(11);await student(learner);await section(learner,'connected-planning');assert.equal(await learner.getByRole('link',{name:'Open Revision Test',exact:true}).getAttribute('href'),'/assessments/revision-1/');
  assert.deepEqual(errors,[]);
});

test('public Revision Test respects voluntary consent, resumes answers and excludes withdrawals from research exports',async t=>{
  const {pageFor,errors,restart}=await open(t);const teacherPage=await pageFor();await teacher(teacherPage);await section(teacherPage,'connected-revisions');
  await teacherPage.locator('#connected-revisions h2').waitFor();
  const fixture=await teacherPage.evaluate(async()=>{
    const base=window.MOON_CAMPUS_API_BASE;
    const login=await (await fetch(base+'/learning/login/admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'synthetic-browser-admin'})})).json();
    const auth={Authorization:'Bearer '+login.access_token,'Content-Type':'application/json'};
    const tests=await (await fetch(base+'/learning/revisions/tests',{headers:auth})).json();
    const spec=tests.find(t=>t.definition.level==='C1');
    const response=await fetch(base+'/learning/revisions/tests/'+spec.id+'/publish',{method:'POST',headers:auth});if(!response.ok)throw Error(await response.text());
    return {id:spec.id,answers:Object.fromEntries(spec.definition.items.filter(i=>!i.groups.length||i.groups.includes('213')).map(i=>[i.prompt,i.answers[0]])),admin:auth};
  });
  const publicPage=await pageFor();await publicPage.goto(new URL('revision-test.html?test='+fixture.id,teacherPage.url()).href);
  await publicPage.getByLabel('Your name',{exact:true}).fill('Synthetic Learner');await publicPage.getByLabel('Group',{exact:true}).selectOption('213');
  assert.equal(await publicPage.locator('input[name=research-consent]:checked').count(),0);
  await publicPage.getByRole('button',{name:'Open test',exact:true}).click();assert.equal(await publicPage.locator('#test-answer').count(),0);
  await publicPage.getByLabel('I want to take the test without participating in the research.',{exact:true}).check();
  await publicPage.getByRole('button',{name:'Open test',exact:true}).click();await publicPage.locator('#test-answer').waitFor();
  assert.equal(await publicPage.getByText('Reading preview',{exact:true}).count(),0);
  await publicPage.locator('#test-answer').fill('ancestor');await publicPage.getByText('Progress saved.',{exact:true}).waitFor();await restart();await publicPage.reload();await publicPage.locator('#test-answer').waitFor();assert.equal(await publicPage.locator('#test-answer').inputValue(),'ancestor');
  for(let i=0;i<40;i++){
    if(await publicPage.locator('#writing-answer').count())break;
    const prompt=await publicPage.locator('#test-body h2').textContent();const answer=fixture.answers[prompt];assert(answer,prompt);
    const control=publicPage.locator('#test-answer');if(await control.evaluate(e=>e.tagName==='SELECT'))await control.selectOption(answer);else await control.fill(answer);
    await publicPage.getByRole('button',{name:'Next',exact:true}).click();await publicPage.waitForFunction(old=>document.querySelector('#test-body h2')?.textContent!==old,prompt);
  }
  await publicPage.locator('#writing-answer').fill('Our heritage matters. Traditions help families share memories, but people should be free to forge their own path.');await publicPage.getByRole('button',{name:'Submit test',exact:true}).click();await publicPage.getByRole('heading',{name:'Submitted',exact:true}).waitFor();
  await publicPage.getByRole('button',{name:'Reveal individual speaking question',exact:true}).click();await publicPage.getByRole('button',{name:'Individual answer finished · ready for dialogue',exact:true}).click();await publicPage.getByText('Waiting for the next classmate who finishes.',{exact:true}).waitFor();
  const attemptId=await publicPage.evaluate(id=>JSON.parse(localStorage.getItem('moon-revision-'+id)).attempt_id,fixture.id);
  await teacherPage.evaluate(async ({fixture,attemptId})=>{const response=await fetch(window.MOON_CAMPUS_API_BASE+'/learning/revisions/attempts/'+attemptId+'/oral-with-teacher',{method:'POST',headers:fixture.admin});if(!response.ok)throw Error(await response.text());},{fixture,attemptId});
  await publicPage.getByText('Partner: Teacher',{exact:true}).waitFor();await publicPage.getByText('Your role: Student A.',{exact:true}).waitFor();
  const count=await teacherPage.evaluate(async fixture=>{const response=await fetch(window.MOON_CAMPUS_API_BASE+'/learning/revisions/tests/'+fixture.id+'/export',{headers:fixture.admin});const files=(await response.json()).files;return atob(files[0].content).includes('Synthetic Learner');},fixture);assert.equal(count,false);
  for(const width of [320,390,1280]){await publicPage.setViewportSize({width,height:900});assert(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(errors,[]);
});
