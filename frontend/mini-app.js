(() => {
  const app=window.Telegram?.WebApp;
  if(app?.initData){document.documentElement.classList.add('telegram-mini-app');app.ready?.();app.expand?.()}
  const resize=()=>{
    const height=window.visualViewport?.height||innerHeight;
    document.documentElement.style.setProperty('--campus-viewport',height+'px');
    const chat=document.querySelector('#connected-messages:not(.cabinet-inactive) .message-chat');
    if(chat&&innerWidth<=700){
      const top=chat.getBoundingClientRect().top;
      const available=Math.max(300,Math.floor(height+(window.visualViewport?.offsetTop||0)-top-18));
      if(chat.style.height!==available+'px')chat.style.height=available+'px';
    }else if(chat)chat.style.removeProperty('height');
  };
  resize();window.visualViewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);app?.onEvent?.('viewportChanged',resize);
  if(window.ResizeObserver)new ResizeObserver(resize).observe(document.querySelector('main')||document.body);
  window.MoonMiniApp={fitChat:()=>requestAnimationFrame(resize)};
})();
