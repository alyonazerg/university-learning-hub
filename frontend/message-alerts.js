(() => {
  let audio=null,registration=null,enabled=false,sound=true;
  try{enabled=localStorage.getItem('moon-message-alerts')==='on';sound=localStorage.getItem('moon-message-sound')!=='off'}catch{}
  function unlock(){
    const Context=window.AudioContext||window.webkitAudioContext;
    if(!Context)return Promise.resolve(false);
    try{audio=audio||new Context();return audio.resume().then(()=>audio.state==='running').catch(()=>false)}catch{return Promise.resolve(false)}
  }
  function play(sent=false){
    if(!sound||audio?.state!=='running')return false;
    try{const start=audio.currentTime;[sent?523.25:659.25,sent?659.25:830.61].forEach((hz,i)=>{
      const osc=audio.createOscillator(),gain=audio.createGain(),at=start+i*.11;
      osc.type='sine';osc.frequency.value=hz;gain.gain.setValueAtTime(0,at);
      gain.gain.linearRampToValueAtTime(sent?.07:.1,at+.02);gain.gain.exponentialRampToValueAtTime(.001,at+.3);
      osc.connect(gain);gain.connect(audio.destination);osc.start(at);osc.stop(at+.32);
    });return true}catch{return false}
  }
  // iOS may suspend audio again after an app switch. Re-arm on every gesture.
  const arm=()=>{if(sound)unlock()};document.addEventListener('pointerdown',arm,{passive:true});document.addEventListener('touchend',arm,{passive:true});
  window.MoonMessageAlerts={prepare:unlock,sent:()=>play(true),mount(area){
    const box=document.createElement('details');box.className='message-sound-settings';
    const summary=document.createElement('summary');summary.textContent='Sound & browser alerts';box.append(summary);
    const tools=document.createElement('div');tools.className='message-alert-tools';
    const button=document.createElement('button'),tone=document.createElement('button'),test=document.createElement('button'),status=document.createElement('span');
    [button,tone,test].forEach(b=>{b.type='button';b.className='secondary'});test.textContent='Test sound';status.setAttribute('role','status');
    const labels=()=>{button.textContent=enabled?'Browser alerts on':'Enable browser alerts';tone.textContent=sound?'Sound on':'Sound off'};labels();
    test.onclick=async()=>{sound=true;localStorage.setItem('moon-message-sound','on');labels();const ok=await unlock();status.textContent=ok&&play()?'Sound played. If you cannot hear it, check your phone’s volume and Silent Mode.':'Tap again to activate sound, or check this browser’s audio settings.'};
    tone.onclick=()=>{sound=!sound;localStorage.setItem('moon-message-sound',sound?'on':'off');labels();if(sound)unlock().then(()=>play())};
    button.onclick=async()=>{unlock();try{
      if(enabled){enabled=false;localStorage.setItem('moon-message-alerts','off');labels();return}
      if(!('Notification' in window))throw Error('System alerts are unavailable here. Use Telegram alerts below; sound works while this page is open.');
      if(await Notification.requestPermission()!=='granted')throw Error('Allow notifications in your browser settings.');
      if('serviceWorker' in navigator)registration=await navigator.serviceWorker.register('/message-notifications-sw.js');
      enabled=true;localStorage.setItem('moon-message-alerts','on');labels();status.textContent='Browser alerts enabled while Moon Campus is open. Use Telegram for background delivery.';play();
    }catch(error){status.textContent=error.message}};
    tools.append(tone,test,button,status);box.append(tools);area.append(box);
    if(enabled&&'serviceWorker' in navigator)navigator.serviceWorker.register('/message-notifications-sw.js').then(r=>registration=r).catch(()=>{});
  },async notify(name,open){
    play();if(!enabled||!('Notification' in window)||Notification.permission!=='granted')return;
    const options={body:'You have a new message on Moon Campus.',tag:'moon-message-'+name,icon:'/favicon.svg',silent:!sound,data:{url:'/learning.html#connected-messages'}};
    try{if(registration)await registration.showNotification('Message from '+name,options);else{const note=new Notification('Message from '+name,options);note.onclick=()=>{window.focus();open();note.close()}}}catch{}
  }};
})();
