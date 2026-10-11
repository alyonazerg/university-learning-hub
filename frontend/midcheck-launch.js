(() => {
  function render(area,{gid,request,run}) {
    const panel=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Grammar Lab · Midcheck';panel.append(summary);
    const note=document.createElement('p');note.textContent='Noun, Article and Genitive diagnostic using your existing Grammar Lab backend. Your learning alias is used instead of your real name. Results remain in Grammar Lab.';panel.append(note);
    const start=document.createElement('button');start.type='button';start.className='secondary';start.textContent='Open Grammar Lab';panel.append(start);
    start.addEventListener('click',()=>run(async()=>{const context=await request('/midcheck/context?group_id='+gid);panel.querySelector('iframe')?.remove();const frame=document.createElement('iframe');frame.className='midcheck-frame';frame.title='Grammar Lab Midcheck';frame.src='midcheck.html#'+new URLSearchParams({alias:context.alias,group:context.group,preview:context.preview?'1':'0'});panel.append(frame);}));area.append(panel);
  }
  window.MoonMidcheck={render};
})();
