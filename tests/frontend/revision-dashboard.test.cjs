const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'../../frontend');
for(const width of [320,1280])test(`revision dashboard has two main actions at ${width}px`,async t=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width,height:1000}});
 const styles=(await Promise.all(['admin.css','cabinet.css','revision-tests.css'].map(f=>fs.readFile(path.join(root,f),'utf8')))).join('\n');
 await page.route('http://moon.test/learning.html',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto('http://moon.test/learning.html');
 await page.setContent(`<style>${styles}</style><main><div id="workspace"><section id="connected-revisions" class="members-panel"></section></div></main>`);await page.addScriptTag({path:path.join(root,'revision-session.js')});
 await page.evaluate(()=>{
  window.calls=[];window.copy='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copy=text;}}});
  const test={id:'one',published:true,definition:{title:'Evolve 5 Unit 7',level:'B2',unit:'7',groups:['215'],priming:[],items:[],writing_prompt:'Write an essay.'}};
  window.MoonRevisions.render({groups:[],tests:[test]},{profile:{role:'admin'},run:async fn=>fn(),request:async(...args)=>{window.calls.push(args);return args[0].includes('/export')?{files:[]}:[];},refresh:async()=>{}});
 });
 assert.equal(await page.locator('.revision-main-actions button:visible').count(),2);assert.equal(await page.getByRole('button',{name:'Publish test'}).count(),0);
 await page.getByRole('button',{name:'View results',exact:true}).click();await page.getByText('No attempts yet.').waitFor();
 assert.equal(await page.locator('.revision-main-actions button:visible').count(),0);
 await page.getByRole('button',{name:'Tests',exact:true}).click();
 await page.locator('summary').filter({hasText:'Export results'}).click();await page.getByLabel('Export format').selectOption('Research CSV');await page.getByRole('button',{name:'Prepare download'}).click();
 assert((await page.evaluate(()=>window.calls)).some(args=>args[0]==='/revisions/tests/one/export?format=csv&research_only=true'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(width===1280)await page.screenshot({path:'/workspace/work/revision-dashboard-desktop.png',fullPage:true});
});

test('student cabinet exposes only locally saved private results',async t=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:320,height:800}});
 await page.route('http://moon.test/**',route=>route.fulfill({contentType:'text/html',body:'<section id="connected-revisions"></section>'}));await page.goto('http://moon.test/learning.html');await page.addScriptTag({path:path.join(root,'revision-session.js')});
 await page.evaluate(()=>{localStorage.setItem('moon-revision-results',JSON.stringify([{attempt_id:'own',token:'private',title:'Unit 7',group:'213'}]));MoonRevisions.render({student:true},{profile:{role:'student'},run:async fn=>fn()});});
 assert.equal(await page.getByRole('heading',{name:'My results'}).count(),1);const url=new URL(await page.getByRole('link',{name:'Unit 7 · 213'}).getAttribute('href'));assert.equal(url.searchParams.get('attempt'),'own');assert.equal(url.hash,'#token=private');assert.equal(await page.getByText('Groups, class lists and research conditions').count(),0);
});

test('teacher can find separate essay and oral grading criteria and rating',async t=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:320,height:1200}});
 const styles=(await Promise.all(['admin.css','cabinet.css','revision-tests.css'].map(f=>fs.readFile(path.join(root,f),'utf8')))).join('\n');
 await page.route('http://moon.test/**',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto('http://moon.test/learning.html');await page.setContent(`<style>${styles}</style><main><section id="connected-revisions" class="members-panel"></section></main>`);await page.addScriptTag({path:path.join(root,'revision-session.js')});
 await page.evaluate(()=>{const test={id:'one',published:true,definition:{title:'Unit 7',level:'C1',unit:'7',groups:['213'],priming:[],items:[],writing_prompt:'Essay'}};const row={id:'attempt',test_id:'one',student_name:'Synthetic Learner',group:'213',condition:'control',submitted_at:'2026-10-11T10:00:00',started_at:'2026-10-11T09:00:00',teacher_status:'reviewed',research_consent:true,priming_catalog:{vocabulary:['heritage'],grammar:[{id:'gerund',label:'Gerund after a verb',example:'enjoyed baking'}],exposed:false},writing:'Our heritage matters.',oral:{status:'paired',score:16},report:{controlled_score:72,writing_score:18,total_score:90},rating_score:2.65};MoonRevisions.render({groups:[],tests:[test]},{profile:{role:'admin'},run:async fn=>fn(),request:async()=>[row],refresh:async()=>{}});});
 await page.getByRole('button',{name:'View results',exact:true}).click();await page.getByLabel('Student',{exact:true}).selectOption('attempt');
 assert.equal(await page.getByText('Rating: 2.65 / 3',{exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Save essay grade'}).count(),1);assert.equal(await page.getByRole('button',{name:'Save individual answer grade'}).count(),0);assert.equal(await page.locator('.revision-review-panel:visible mark').textContent(),'heritage');await page.getByRole('button',{name:'Speaking',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Save individual answer grade'}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Save dialogue grade'}).count(),1);
 const mark=page.locator('.revision-review-panel:visible input[type=number]').first();await mark.fill('3');assert.equal(await mark.getAttribute('step'),'1');assert.equal(await mark.evaluate(field=>field.dispatchEvent(new WheelEvent('wheel',{deltaY:100,cancelable:true}))),false);assert.equal(await mark.inputValue(),'3');await mark.fill('3.5');assert.equal(await mark.evaluate(field=>field.checkValidity()),false);await mark.fill('3');
 assert.equal(await page.getByText('Speaking criteria · individual and dialogue',{exact:true}).count(),1);assert.equal(await page.locator('.revision-selected-work').count(),1);assert.equal(await page.locator('.revision-review-panel:visible').count(),1);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1100,height:1000});const cards=await page.locator('.revision-speaking-grade').all();const first=await cards[0].boundingBox(),second=await cards[1].boundingBox();assert.equal(first.y,second.y);assert(second.x>first.x);assert.equal(Math.round((await mark.boundingBox()).width),64);await page.screenshot({path:'/workspace/work/revision-compact-speaking.png',fullPage:true});
});

test('group analytics is isolated from marking and fits mobile',async t=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:320,height:900}});
 const styles=(await Promise.all(['admin.css','cabinet.css','revision-tests.css'].map(f=>fs.readFile(path.join(root,f),'utf8')))).join('\n');
 await page.route('http://moon.test/**',route=>route.fulfill({contentType:'text/html',body:'<html></html>'}));await page.goto('http://moon.test/learning.html');await page.setContent(`<style>${styles}</style><main><section id="connected-revisions" class="members-panel"></section></main>`);await page.addScriptTag({path:path.join(root,'revision-session.js')});
 await page.evaluate(()=>{window.calls=[];const stats={submitted:3,unfinished:1,final_assessed:1,rating_mean:2.1,sections:[{section:'Grammar',percent:60,assessed:3,pending:0}],weak_items:[{label:'Negative adverbial inversion',section:'grammar',correct:1,answered:3,percent:33.3}]};const payload={overall:stats,groups:[{group:'213',coursebook:'Evolve 6',...stats},{group:'214',coursebook:'Evolve 6',...stats}],note:'Attempts, not unique students.'};const test={id:'one',published:true,definition:{title:'RT1',level:'C1',unit:'7',groups:['213'],priming:[],items:[],writing_prompt:'Essay'}};MoonRevisions.render({groups:[],tests:[test]},{profile:{role:'admin'},run:async fn=>fn(),request:async path=>{window.calls.push(path);return path.startsWith('/revisions/analytics')?payload:[];},refresh:async()=>{}});});
 assert.equal((await page.evaluate(()=>window.calls)).length,0);await page.getByRole('button',{name:'Analytics',exact:true}).click();await page.getByText('Lowest-scoring tasks',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save essay grade'}).count(),0);assert(await page.getByText(/small sample/).count());await page.getByLabel('Scope',{exact:true}).selectOption('All tests');await page.getByLabel('Group view',{exact:true}).selectOption('213');assert((await page.evaluate(()=>window.calls)).includes('/revisions/analytics'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});
