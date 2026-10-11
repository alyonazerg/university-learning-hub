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
 assert.equal(await page.locator('#connected-revisions button:visible').count(),2);assert.equal(await page.getByRole('button',{name:'Publish test'}).count(),0);
 await page.getByRole('button',{name:'View results',exact:true}).click();await page.getByText('No attempts yet.').waitFor();
 assert.equal(await page.locator('#connected-revisions button:visible').count(),2);
 await page.locator('summary').filter({hasText:'Export results'}).click();await page.getByLabel('Export format').selectOption('Research CSV');await page.getByRole('button',{name:'Prepare download'}).click();
 assert((await page.evaluate(()=>window.calls)).some(args=>args[0]==='/revisions/tests/one/export?format=csv&research_only=true'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(width===1280)await page.screenshot({path:'/workspace/work/revision-dashboard-desktop.png',fullPage:true});
});
