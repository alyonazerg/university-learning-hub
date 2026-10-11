const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
for(const screen of ['warmup','question','essay'])test(`research choice is not repeated during ${screen}`,async t=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let saved=null,withdrawals=0,submitted=false;
 const state={submitted:false,collect_response_times:true,items:[{id:'one',section:'emergent',prompt:'Complete the word.'}],timing:{},answers:{one:'Existing answer'},writing:'Existing essay draft',writing_prompt:'Discuss the topic.',writing_range:[225,275],warmup:screen==='warmup'?['Reading sentence.']:[]};
 await page.addInitScript(({screen})=>localStorage.setItem('moon-revision-test',JSON.stringify({attempt_id:'attempt',token:'secret',index:screen==='essay'?1:0})),{screen});
 await page.route('http://moon.test/**',async route=>{
  const u=new URL(route.request().url());let result;
  if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.MOON_CAMPUS_API_BASE='http://moon.test/api';"});
  if(u.pathname.startsWith('/api/')){
   if(u.pathname.endsWith('/revision-tests/test'))result={title:'Synthetic revision',coursebook:'Evolve 5',unit:'7',groups:['215']};
   else if(u.pathname.endsWith('/withdraw-research')){withdrawals++;state.collect_response_times=false;state.timing={};state.warmup=[];result={withdrawn:true};}
   else if(u.pathname.endsWith('/begin')){state.warmup=[];result=state;}
   else if(u.pathname.endsWith('/submit')){submitted=true;result={submitted:true,collect_response_times:false,controlled_score:80};}
   else if(route.request().method()==='PUT'){saved=route.request().postDataJSON();result={saved:true};}
   else result=state;
   return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  }
  const file=path.resolve(__dirname,'../../frontend',u.pathname.slice(1));
  try{return route.fulfill({body:await fs.readFile(file),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.html')?'text/html':'image/svg+xml'});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('http://moon.test/revision-test.html?test=test');await page.getByRole('button',{name:'Continue my saved attempt'}).click();
 if(screen==='question')await page.locator('#test-answer').fill('New answer');
 if(screen==='essay'){await page.locator('#writing-answer').fill('Updated essay');const accepted=await page.evaluate(()=>{const data=new DataTransfer();data.setData('text/plain','external generated essay');const event=new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true});const accepted=document.getElementById('writing-answer').dispatchEvent(event);window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));return accepted;});assert.equal(accepted,false);assert.equal(await page.locator('#writing-answer').inputValue(),'Updated essay');}
 assert.equal(await page.getByRole('button',{name:'Continue without participating in the research'}).count(),0);assert.equal(withdrawals,0);if(screen==='warmup')await page.getByRole('button',{name:'Start test',exact:true}).click();
 if(screen!=='essay'){
  assert.equal(await page.locator('#test-answer').inputValue(),screen==='question'?'New answer':'Existing answer');
  await page.getByRole('button',{name:'Next',exact:true}).click();
 }
 assert.equal(await page.locator('#writing-answer').inputValue(),screen==='essay'?'Updated essay':'Existing essay draft');
 await page.getByRole('button',{name:'Submit test',exact:true}).click();await page.getByRole('heading',{name:'Submitted',exact:true}).waitFor();
 assert(submitted);if(screen==='essay'){assert.equal(saved.integrity_metrics.paste_attempts,1);assert(saved.integrity_metrics.focus_losses>=1);}assert(saved.timing);assert.equal(await page.getByRole('button',{name:'Continue without participating in the research'}).count(),0);
 assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

test('one shared student link routes each group to its test and aligns consent labels',async t=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 for(const [group,id] of [['213','c1'],['216','b2']]){
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('http://moon.test/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.MOON_CAMPUS_API_BASE='http://moon.test/api';"});
   if(u.pathname.startsWith('/api/')){
    const tests=[{id:'c1',title:'Evolve 6 Unit 7',groups:['213','214'],unit:'7'},{id:'b2',title:'Evolve 5 Unit 7',groups:['215','216','217'],unit:'7'},{id:'b2u8',title:'Evolve 5 Unit 8',groups:['215','216','217'],unit:'8'}];
    const response=u.pathname==='/api/revision-tests'?tests:{...tests.find(x=>x.id===u.pathname.split('/').at(-1)),coursebook:id==='c1'?'Evolve 6':'Evolve 5'};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(response)});
   }
   try{return route.fulfill({body:await fs.readFile(path.resolve(__dirname,'../../frontend',u.pathname.slice(1))),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.html')?'text/html':'image/svg+xml'});}catch{return route.fulfill({status:404,body:''});}
  });
  await page.goto('http://moon.test/revision-test.html');await page.locator('#choose-group').selectOption(group);
  assert.equal(await page.locator('#choose-test').inputValue(),id);
  if(group==='216'){assert.equal(await page.locator('#choose-test option').count(),2);await page.locator('#choose-test').selectOption('b2u8');}
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByPlaceholder('Ivan Ivanov').waitFor();assert.equal(await page.locator('#public-test-group').inputValue(),group);
  const options=page.locator('.revision-consent-option');assert.equal(await options.count(),2);assert.equal(await page.locator('input[name="research-consent"]:checked').count(),0);
  await options.last().click();assert.equal(await page.locator('input[name="research-consent"]:checked').inputValue(),'no');
  const row=await options.last().boundingBox(),radio=await options.last().locator('input').boundingBox(),text=await options.last().locator('span').boundingBox();
  assert(Math.abs(radio.y-text.y)<8);assert(text.x>radio.x);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.close();
 }
});

test('mobile answers survive a dropped connection and are submitted only after reconnection',async t=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:320,height:740}}),page=await context.newPage();let submissions=0;
 const state={submitted:false,collect_response_times:false,items:[{id:'one',section:'emergent',prompt:'A longer mobile question: complete this sentence with the appropriate word.'}],timing:{},answers:{},writing:'',writing_prompt:'Explain your position and give an example.',writing_range:[225,275],warmup:[]};
 await page.addInitScript(()=>localStorage.setItem('moon-revision-test',JSON.stringify({attempt_id:'attempt',token:'secret',index:0})));
 await page.route('http://moon.test/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.MOON_CAMPUS_API_BASE='http://moon.test/api';"});
  if(u.pathname.startsWith('/api/')){
   let result=state;
   if(u.pathname.endsWith('/revision-tests/test'))result={title:'Synthetic revision',coursebook:'Evolve 5',unit:'7',groups:['215']};
   else if(route.request().method()==='PUT'){Object.assign(state,route.request().postDataJSON());result={saved:true};}
   else if(u.pathname.endsWith('/submit')){submissions++;result={submitted:true,collect_response_times:false,controlled_score:80};}
   return route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  }
  try{return route.fulfill({body:await fs.readFile(path.resolve(__dirname,'../../frontend',u.pathname.slice(1))),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.html')?'text/html':'image/svg+xml'});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('http://moon.test/revision-test.html?test=test');await page.getByRole('button',{name:'Continue my saved attempt'}).click();await page.locator('#test-answer').waitFor();
 await context.setOffline(true);await page.locator('#test-answer').fill('Answer during outage');await page.getByRole('button',{name:'Next',exact:true}).click();await page.locator('#writing-answer').fill('Essay during outage');
 await page.getByRole('button',{name:'Submit test',exact:true}).click();await page.getByText(/Not submitted yet/).waitFor();assert.equal(submissions,0);
 const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('moon-revision-test-draft')));assert.equal(draft.answers.one,'Answer during outage');assert.equal(draft.writing,'Essay during outage');
 await context.setOffline(false);await page.getByText('Progress saved on the server.').waitFor();
 await page.reload();await page.getByRole('button',{name:'Continue my saved attempt'}).click();await page.locator('#writing-answer').waitFor();assert.equal(await page.locator('#writing-answer').inputValue(),'Essay during outage');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.getByRole('button',{name:'Submit test',exact:true}).click();await page.getByRole('heading',{name:'Submitted',exact:true}).waitFor();assert.equal(submissions,1);
});

test('private return link loads current feedback without reopening a test',async t=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:320,height:700}});let calls=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://moon.test/**',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.MOON_CAMPUS_API_BASE='http://moon.test/api';"});
  if(u.pathname.startsWith('/api/')){assert.equal(u.pathname,'/api/revision-attempts/private-attempt');assert.equal(route.request().headers().authorization,'Bearer private-token');calls++;return route.fulfill({contentType:'application/json',body:JSON.stringify({submitted:true,title:'Unit 7',group:'213',controlled_score:72,essay_score:18,written_score:90,oral_score:16,rating_score:2.65,essay_feedback:'Good argument.',oral_feedback:'Clear speech.'})});}
  try{return route.fulfill({body:await fs.readFile(path.resolve(__dirname,'../../frontend',u.pathname.slice(1))),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.html')?'text/html':'image/svg+xml'});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('http://moon.test/revision-test.html?view=result&attempt=private-attempt#token=private-token');
 assert.equal(await page.getByText('Good argument.',{exact:true}).isVisible(),false);await page.getByText('Result details',{exact:true}).click();await page.getByText('Good argument.',{exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'');
 assert.equal(await page.locator('.revision-result-rating strong').textContent(),'2.65 / 3');
 assert.equal(await page.getByRole('button',{name:'Reveal my individual question'}).count(),0);
 await page.getByRole('button',{name:'Refresh result'}).click();await page.waitForTimeout(100);assert(calls>=2);
 await page.reload();await page.getByText('Result details',{exact:true}).click();await page.getByText('Clear speech.',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

test('instruction, question and visible options are separate on mobile',async t=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:320,height:800}});
 const prompt='Choose the expression that best fits the meaning and usage in this context.\nThe records trace Omar’s family line. They tell him about his ___.';
 const state={submitted:false,collect_response_times:false,items:[{id:'one',section:'vocabulary',prompt,choices:['ancestry','heritage','ethnicity','citizenship','identity']}],answers:{},timing:{},writing:'',warmup:[],writing_prompt:'Essay',writing_range:[225,275]};
 await page.addInitScript(()=>localStorage.setItem('moon-revision-test',JSON.stringify({attempt_id:'attempt',token:'private'})));
 await page.route('http://moon.test/**',async route=>{const u=new URL(route.request().url());if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.MOON_CAMPUS_API_BASE='http://moon.test/api';"});if(u.pathname.startsWith('/api/'))return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname.includes('revision-tests/')?{title:'RT1',groups:['213']}:state)});try{return route.fulfill({body:await fs.readFile(path.resolve(__dirname,'../../frontend',u.pathname.slice(1))),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.html')?'text/html':'image/svg+xml'});}catch{return route.fulfill({status:404,body:''});}});
 await page.goto('http://moon.test/revision-test.html?test=test');await page.getByRole('button',{name:'Continue my saved attempt'}).click();await page.getByRole('radio',{name:/ancestry/}).waitFor();
 assert.equal(await page.locator('.revision-task-hint').textContent(),'Choose one best answer.');assert(!(await page.locator('.revision-question-card').textContent()).includes('Choose the expression'));assert.equal(await page.getByRole('radio').count(),5);
 await page.getByRole('radio',{name:/ancestry/}).check();assert.equal(await page.locator('#test-answer').inputValue(),'ancestry');await page.getByRole('button',{name:'Next',exact:true}).click();await page.waitForTimeout(100);await page.locator('#writing-answer').waitFor();await page.getByRole('button',{name:'Back',exact:true}).click();assert(await page.getByRole('radio',{name:/ancestry/}).isChecked());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

test('saved attempt waits for identity confirmation and deleted attempt clears browser draft',async t=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());const page=await browser.newPage();let removed=false;
 const state={student_name:'Synthetic Learner',group:'213',title:'RT1',submitted:false,collect_response_times:false,items:[{id:'one',section:'vocabulary',prompt:'Question.'}],answers:{},timing:{},writing:'',warmup:[],writing_prompt:'Essay'};
 await page.addInitScript(()=>{localStorage.setItem('moon-revision-test',JSON.stringify({attempt_id:'attempt',token:'private'}));localStorage.setItem('moon-revision-test-draft',JSON.stringify({attempt_id:'attempt',answers:{one:'Local answer'},writing:'Draft',index:0}));});
 await page.route('http://moon.test/**',async route=>{const u=new URL(route.request().url());if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.MOON_CAMPUS_API_BASE='http://moon.test/api';"});if(u.pathname.startsWith('/api/')){if(u.pathname.includes('revision-attempts/')&&removed)return route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({detail:'This attempt is not available on this device'})});return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname.includes('revision-tests/')?{title:'RT1',groups:['213'],coursebook:'Evolve 6'}:state)});}try{return route.fulfill({body:await fs.readFile(path.resolve(__dirname,'../../frontend',u.pathname.slice(1))),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.html')?'text/html':'image/svg+xml'});}catch{return route.fulfill({status:404,body:''});}});
 await page.goto('http://moon.test/revision-test.html?test=test');await page.getByText('Synthetic Learner · group 213',{exact:true}).waitFor();assert.equal(await page.locator('#test-answer').count(),0);
 await page.getByRole('button',{name:'Continue my saved attempt'}).click();await page.locator('#test-answer').waitFor();removed=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'Attempt unavailable'}).waitFor();assert.equal(await page.locator('#test-answer').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('moon-revision-test')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('moon-revision-test-draft')),null);
});

test('graded individual answer stays completed after student reload',async t=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:390,height:844}});
 const state={submitted:true,title:'RT1',student_name:'Synthetic Learner',group:'213',controlled_score:60,individual_score:16,oral:{individual_question:'',individual_completed:true,dialogue_completed:false,dialogue_allowed:true,status:'paired',partner_name:'Partner',role:'A',dialogue_prompt:'Your role A'}};
 await page.addInitScript(()=>localStorage.setItem('moon-revision-test',JSON.stringify({attempt_id:'attempt',token:'secret'})));
 await page.route('http://moon.test/**',async route=>{const u=new URL(route.request().url());if(u.pathname==='/config.js')return route.fulfill({contentType:'text/javascript',body:"window.MOON_CAMPUS_API_BASE='http://moon.test/api';"});if(u.pathname.startsWith('/api/'))return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname.endsWith('/revision-tests/test')?{title:'RT1',groups:['213']}:u.pathname.endsWith('/oral')?state.oral:state)});const file=path.resolve(__dirname,'../../frontend',u.pathname.slice(1));try{return route.fulfill({body:await fs.readFile(file),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':'text/html'});}catch{return route.fulfill({status:404,body:''});}});
 for(let i=0;i<2;i++){await page.goto('http://moon.test/revision-test.html?test=test');await page.getByRole('button',{name:'Continue my saved attempt'}).click();await page.getByText('Individual answer completed · no need to answer again.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Reveal my individual question'}).count(),0);assert.equal(await page.getByRole('button',{name:'Open dialogue',exact:true}).count(),1);}
 state.oral_score=18;state.oral_breakdown={dialogue_strategies:4,individual_content:5,individual_vocabulary:4,dialogue_vocabulary:3,individual_grammar:4,individual_coherence:4,dialogue_grammar:4,dialogue_coherence:4};state.oral.individual_completed=false;state.oral.individual_question='Old individual question';await page.reload();await page.getByRole('button',{name:'Continue my saved attempt'}).click();await page.getByText('Dialogue completed · no need to answer again.',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Reveal my individual question'}).count(),0);assert.equal(await page.getByRole('button',{name:'Open dialogue',exact:true}).count(),0);assert.equal(await page.locator('.revision-speaking-card:visible').count(),0);assert.equal(await page.getByText('Speaking instructions',{exact:true}).count(),0);await page.getByText('Result details',{exact:true}).click();assert.equal(await page.locator('.revision-result-criteria-card').count(),2);assert.equal(await page.locator('.revision-result-criteria-card').first().locator('th').first().textContent(),'Vocabulary');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/workspace/work/student-receipt-mobile.png',fullPage:true});await page.setViewportSize({width:1100,height:1100});await page.screenshot({path:'/workspace/work/student-receipt-desktop.png',fullPage:true});
});
