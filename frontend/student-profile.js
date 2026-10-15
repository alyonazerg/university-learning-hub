(() => {
  const n=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};
  const themes={mooncat:'Moon cat',starfox:'Star fox',forestowl:'Forest owl',moonflower:'Moon flower'};
  function avatar(seed,theme){
    const ns='http://www.w3.org/2000/svg',s=(tag,attrs,parent)=>{const e=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));parent?.append(e);return e};
    const svg=s('svg',{viewBox:'0 0 160 160',role:'img','aria-label':themes[theme]||'Magical avatar',class:'profile-avatar'});
    const palettes=[['#1d294e','#899fd7','#dceaff'],['#38234e','#ac87c2','#f9e7ff'],['#153f3c','#78b5a4','#e1fff0'],['#513047','#d9919c','#ffe9cc']];
    const [dark,mid,light]=palettes[seed%palettes.length],id='avatar-'+crypto.randomUUID();
    const defs=s('defs',{},svg),gradient=s('radialGradient',{id,cx:'.35',cy:'.2',r:'.9'},defs);s('stop',{offset:'0%','stop-color':mid},gradient);s('stop',{offset:'100%','stop-color':dark},gradient);
    s('rect',{width:160,height:160,rx:42,fill:'url(#'+id+')'},svg);
    s('circle',{cx:80,cy:81,r:65,fill:'none',stroke:light,'stroke-opacity':'.25'},svg);
    for(let i=0;i<13;i++){const x=15+(seed*(i+3)*17+i*23)%130,y=13+(seed*(i+7)*13+i*31)%134;s('path',{d:`M${x-2} ${y}h4m-2-2v4`,stroke:light,'stroke-width':1.2,opacity:.65},svg)}
    s('path',{d:'M121 25a13 13 0 1 0 11 20 15 15 0 0 1-11-20',fill:'#f7e7b4'},svg);
    if(theme==='moonflower'){
      s('path',{d:'M80 131V72M80 118Q48 117 47 96Q72 94 80 118M80 106Q111 103 112 85Q91 87 80 106',fill:mid,stroke:light,'stroke-width':2},svg);
      for(let i=0;i<8;i++)s('ellipse',{cx:80,cy:48,rx:12,ry:23,fill:light,opacity:.88,transform:`rotate(${i*45} 80 72)`},svg);
      s('circle',{cx:80,cy:72,r:16,fill:'#f5d38b'},svg);s('circle',{cx:75,cy:69,r:2,fill:dark},svg);s('circle',{cx:85,cy:69,r:2,fill:dark},svg);s('path',{d:'M76 77q4 4 8 0',fill:'none',stroke:dark,'stroke-width':2},svg);
    }else{
      const owl=theme==='forestowl',fox=theme==='starfox';
      const fur=fox?'#e2b48f':owl?'#bcb6d8':light;
      s('path',{d:owl?'M39 63L35 37 65 52Q80 46 97 52L125 37 121 66Q137 125 80 132Q23 125 39 63':'M40 68L39 30 68 51Q80 47 93 51L122 30 120 71Q133 122 80 127Q26 122 40 68',fill:fur},svg);
      if(!owl){s('path',{d:'M47 40L49 63 63 54M113 40L111 63 97 54',fill:mid},svg)}
      if(owl){s('circle',{cx:61,cy:83,r:23,fill:light},svg);s('circle',{cx:99,cy:83,r:23,fill:light},svg)}
      else s('path',{d:fox?'M42 80L80 98 118 80Q118 123 80 125Q42 123 42 80':'M45 88Q80 76 115 88Q115 123 80 125Q45 123 45 88',fill:'#fff4e9',opacity:.85},svg);
      for(const x of [61,99]){s('ellipse',{cx:x,cy:84,rx:owl?8:5,ry:8,fill:dark},svg);s('circle',{cx:x-2,cy:81,r:2,fill:'white'},svg)}
      s('path',{d:owl?'M74 94L86 94 80 103Z':'M75 98Q80 95 85 98L80 103Z',fill:dark},svg);
      if(!owl)s('path',{d:'M80 103v5m-7-1q7 8 14 0',stroke:dark,'stroke-width':1.5,fill:'none'},svg);
      s('path',{d:'M48 124Q80 113 112 124L117 139Q80 151 43 139Z',fill:mid,stroke:light,'stroke-opacity':.5},svg);
      s('path',{d:'M80 122l3 5 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1Z',fill:'#f7df9b'},svg);
    }
    return svg;
  }
  window.MoonProfile={avatar,render({profile,request}){
    if(profile.role!=='student'){document.querySelector('a[href="#connected-profile"]')?.remove();document.getElementById('connected-profile')?.remove();return}
    let area=document.getElementById('connected-profile');if(!area){area=n('section',undefined,'members-panel');area.id='connected-profile';document.getElementById('workspace').append(area)}
    if(!document.querySelector('a[href="#connected-profile"]')){const link=n('a','My profile');link.href='#connected-profile';link.onclick=e=>{e.preventDefault();history.replaceState(null,'',link.hash);window.MoonCabinet.show('connected-profile')};document.querySelector('.dashboard-links').append(link)}
    area.replaceChildren(n('h2','My profile'),n('p','A little magic, a little you. Use your campus alias — please do not share your real name, contact details or other personal information.','muted'));
    const content=n('div');area.append(content);content.textContent='Loading your profile…';
    let data;
    async function load(){try{data=await request('/profile');if(!area.isConnected)return;paint()}catch(error){content.textContent=error.message;const retry=n('button','Try again','secondary');retry.onclick=load;content.append(retry)}}
    function paint(){
      content.replaceChildren();const form=n('form',undefined,'profile-form'),hero=n('div',undefined,'profile-hero'),preview=n('div'),identity=n('div');
      const draw=()=>preview.replaceChildren(avatar(data.avatar_seed,data.avatar_theme));draw();identity.append(n('h3',data.alias),n('p',`${data.xp} XP · learning milestones`,'profile-xp'));hero.append(preview,identity);form.append(hero);
      const controls=n('div',undefined,'profile-avatar-controls'),themeLabel=n('label','Your magical companion'),theme=n('select');Object.entries(themes).forEach(([key,value])=>{const o=n('option',value);o.value=key;theme.append(o)});theme.value=data.avatar_theme;themeLabel.append(theme);const generate=n('button','✨ Create another look','secondary');generate.type='button';controls.append(themeLabel,generate);form.append(controls);
      const bioLabel=n('label','About you · optional, in English'),bio=n('textarea');bio.maxLength=160;bio.rows=2;bio.value=data.bio;bio.placeholder='Book lover, moon gazer, learning one expression at a time…';bioLabel.append(bio);const count=n('small',`${bio.value.length}/160`);bioLabel.append(count);form.append(bioLabel);
      const privacy=n('fieldset',undefined,'profile-privacy');privacy.append(n('legend','Sharing · your choice'));
      const toggle=(text,checked)=>{const l=n('label'),input=n('input');input.type='checkbox';input.checked=checked;l.append(input,n('span',text));privacy.append(l);return input};
      const share=toggle('Show my avatar, bio and achievements to my group',data.share_profile),rating=toggle('Include me in my group’s XP ranking',data.share_rating);
      const guard=()=>{rating.disabled=!share.checked;if(!share.checked)rating.checked=false};share.onchange=guard;guard();privacy.append(n('small','Private by default. Other groups cannot see your profile. XP is separate from academic grades.'));form.append(privacy);
      const actions=n('div',undefined,'profile-actions'),save=n('button','Save profile','primary'),status=n('span');save.type='submit';status.setAttribute('role','status');actions.append(save,status);form.append(actions);content.append(form);
      const changed=()=>{status.textContent='Unsaved changes'};bio.oninput=()=>{count.textContent=`${bio.value.length}/160`;changed()};theme.onchange=()=>{data.avatar_theme=theme.value;draw();changed()};generate.onclick=()=>{data.avatar_seed=1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483647;draw();changed()};privacy.addEventListener('change',changed);
      form.onsubmit=async e=>{e.preventDefault();save.disabled=true;status.textContent='Saving…';try{data=await request('/profile','PUT',{bio:bio.value,avatar_seed:data.avatar_seed,avatar_theme:theme.value,share_profile:share.checked,share_rating:rating.checked});status.textContent='✓ Profile saved';await groupLoad()}catch(error){status.textContent=error.message+' Your changes are still here.'}finally{save.disabled=false}};
      const achievements=n('div',undefined,'profile-achievements');achievements.append(n('h3','Your achievements'));
      if(!data.achievements.length)achievements.append(n('p','Your first chapter starts here. Submit an IMT list, finish practice or send your first message to earn a badge.','muted'));
      for(const badge of data.achievements)achievements.append(n('div',`${badge.icon} ${badge.label} · +${badge.points} XP`,'profile-badge'));content.append(achievements);
      const rules=n('details');rules.append(n('summary','How XP works'),n('p','One-time milestones: submit your first IMT list +10; complete IMT practice +30; answer a whole IMT quiz correctly +20; send your first campus message +10. Repeating or resetting cannot earn the same reward again. Teacher-approved assignments can also award their configured XP once per assignment; corrections replace that award.'));content.append(rules);
      const peers=n('div',undefined,'profile-peers');content.append(peers);
      async function groupLoad(){try{const group=await request('/profile/group');peers.replaceChildren(n('h3','Your group’s constellation'));
        if(!group.profiles.length)peers.append(n('p','No shared profiles yet. Sharing is always optional.','muted'));
        const grid=n('div',undefined,'profile-peer-grid');for(const peer of group.profiles){const card=n('article',undefined,'profile-peer');card.append(avatar(peer.avatar_seed,peer.avatar_theme),n('h4',peer.alias));if(peer.bio)card.append(n('p',peer.bio));if(peer.xp!==undefined)card.append(n('strong',`${peer.xp} XP`));card.append(n('p',peer.achievements.map(b=>b.icon+' '+b.label).join(' · ')));grid.append(card)}peers.append(grid);
        if(group.leaderboard.length){peers.append(n('h3','Group XP · all time'));const ranks=n('ol',undefined,'profile-ranking');for(const row of group.leaderboard)ranks.append(n('li',`${row.rank}. ${row.alias} · ${row.xp} XP`));peers.append(ranks)}
      }catch(error){peers.replaceChildren(n('p',error.message))}}groupLoad();
    }
    // Fetch only when opened; each visit refreshes newly earned achievements.
    let wasVisible=false;const observer=new MutationObserver(()=>{const visible=!area.classList.contains('cabinet-inactive');if(visible&&!wasVisible)load();wasVisible=visible});observer.observe(area,{attributes:true,attributeFilter:['class']});area._profileCleanup=()=>observer.disconnect();
    if(!area.classList.contains('cabinet-inactive'))load();
  }};
})();
