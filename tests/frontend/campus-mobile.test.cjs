const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../../frontend');
async function open(t,width=390){
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width,height:844}});
  await page.route('https://campus.test/**',route=>route.fulfill({contentType:'text/html',body:'<html><head><meta charset="UTF-8"></head><body class="campus-connected"><header class="topbar"><a class="brand">✦ Moon Campus</a><span>Moon Fern</span></header><main><div id="workspace"><nav class="dashboard-links">'+['Home','Schedule','Plan','Vocabulary','Assignments','Attendance','My results','Messages','My IMT'].map(x=>`<a href="#connected-${x.toLowerCase().replaceAll(' ','-')}">${x}</a>`).join('')+'</nav></div></main></body></html>'}));
  await page.goto('https://campus.test/');
  for(const name of ['admin.css','cabinet.css','campus-mobile.css','bug-report.css'])await page.addStyleTag({content:fs.readFileSync(path.join(root,name),'utf8')});
  return page;
}
test('phone chat has one-row navigation, compact composer and no floating report button',async t=>{
  for(const width of [320,390,700]){
    const page=await open(t,width);
    await page.evaluate(()=>{
      window.oscillators=0;window.resumes=0;
      window.AudioContext=class{constructor(){this.state='suspended';this.currentTime=0}resume(){window.resumes++;this.state='running';return Promise.resolve()}createOscillator(){window.oscillators++;return {frequency:{value:0},connect(){},start(){},stop(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}};
      window.mockRequest=async(url,method)=>{
        if(url==='/messages/threads')return [{student_id:'synthetic',alias:'Moon Fern',group:'Test',unread:0,last_incoming_id:1}];
        if(url.startsWith('/messages?'))return {messages:[{id:1,sender:'admin',body:'Welcome ✨',created_at:'2026-10-15T10:00:00Z'}]};
        if(url==='/messages/telegram')return {linked:true,enabled:false,configured:true};
        return {};
      };
    });
    for(const name of ['mini-app.js','emoji-picker.js','message-alerts.js','telegram-message-alerts.js','messages.js','bug-report.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,name),'utf8')});
    await page.evaluate(()=>MoonMessages.render({profile:{role:'student'},request:mockRequest}));
    await page.locator('.message-compose').waitFor({state:'visible'});
    const metrics=await page.evaluate(()=>{
      const nav=document.querySelector('.dashboard-links'),send=document.querySelector('.message-actions button'),input=document.querySelector('.message-compose textarea'),bug=document.querySelector('.bug-trigger');
      const r=e=>e.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth,navHeight:r(nav).height,sendBottom:r(send).bottom,inputHeight:r(input).height,bugPosition:getComputedStyle(bug).position,emojiHeight:r(document.querySelector('.message-compose .moon-emoji-picker')).height};
    });
    await page.screenshot({path:`/tmp/campus-chat-${width}.png`});
    assert.equal(metrics.overflow,false,JSON.stringify(metrics));assert.ok(metrics.navHeight<60);assert.ok(metrics.inputHeight<80);assert.equal(metrics.bugPosition,'static');assert.ok(metrics.emojiHeight<45,JSON.stringify(metrics));
    assert.ok(metrics.sendBottom<=844,JSON.stringify(metrics));
    await page.locator('.message-compose textarea').fill('Hello ✨');await page.locator('.message-actions button').click();
    await page.waitForFunction(()=>window.oscillators===2);assert.ok(await page.evaluate(()=>resumes>0));
    await page.screenshot({path:`/tmp/campus-chat-${width}.png`});await page.close();
  }
});
test('profile keeps sharing opt-in and renders generated avatars and literal biography text',async t=>{
  const page=await open(t);await page.addScriptTag({content:fs.readFileSync(path.join(root,'student-profile.js'),'utf8')});
  await page.evaluate(()=>{
    window.saved=null;const profile={alias:'Moon Fern',bio:'Book lover <3',xp:10,avatar_seed:1,avatar_theme:'mooncat',share_profile:false,share_rating:false,achievements:[{key:'word_explorer',label:'Word explorer',icon:'🌱',points:10}]};
    MoonProfile.render({profile:{role:'student'},request:async(url,method,data)=>{if(method==='PUT'){saved=data;return {...profile,...data}}return url==='/profile/group'?{profiles:[],leaderboard:[]}:profile}});
  });
  await page.locator('.profile-form').waitFor();
  assert.equal(await page.locator('.profile-privacy input:checked').count(),0);
  assert.equal(await page.locator('.profile-privacy input').nth(1).isDisabled(),true);
  const original=await page.locator('.profile-avatar').getAttribute('aria-label');
  await page.locator('.profile-avatar-controls select').selectOption('starfox');assert.notEqual(await page.locator('.profile-avatar').getAttribute('aria-label'),original);
  await page.locator('.profile-actions button').click();await page.waitForFunction(()=>window.saved!==null);
  assert.equal(await page.evaluate(()=>saved.share_profile),false);
  assert.equal(await page.locator('.profile-form textarea').inputValue(),'Book lover <3');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'/tmp/campus-profile-390.png',fullPage:true});
});
