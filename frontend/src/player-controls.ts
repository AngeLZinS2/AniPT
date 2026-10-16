import './player.css';

const paths:Record<string,string>={play:'m9 5 11 7-11 7Z',pause:'M8 5v14M16 5v14',volume:'m11 5-6 4H2v6h3l6 4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',mute:'m11 5-6 4H2v6h3l6 4Zm5 4 6 6m0-6-6 6',servers:'M3 5h18v5H3ZM3 14h18v5H3ZM6 7.5h.01M6 16.5h.01',subtitles:'M3 5h18v14H3ZM6 10h4m4 0h4M6 14h6m3 0h3',audio:'M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4',settings:'M4 7h16M4 17h16M9 4v6m6 4v6',episodes:'M9 6h12M9 12h12M9 18h12M3 6h1M3 12h1M3 18h1',stats:'M4 20V13m5 7V8m6 12V4m5 16V10',close:'m6 6 12 12M6 18 18 6'};
const icon=(name:string)=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="${name==='play'?'currentColor':'none'}" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name]}"/></svg>`;
export const mediaClock=(seconds:number)=>{if(!Number.isFinite(seconds)||seconds<0)return '0:00';const n=Math.floor(seconds);return `${n>=3600?`${Math.floor(n/3600)}:`:''}${n>=3600?String(Math.floor(n/60)%60).padStart(2,'0'):Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`};

/** Owns presentation only; playback, source selection and saving stay in main.ts. */
export function playerControls(overlay:HTMLElement,video:HTMLVideoElement){
  overlay.classList.add('cinema-player');
  if(!overlay.hasAttribute('tabindex'))overlay.tabIndex=-1;
  const stage=overlay.querySelector<HTMLElement>('.video-stage')!;
  const shell=overlay.querySelector<HTMLElement>('.player-shell')!;
  const heading=shell.querySelector<HTMLElement>(':scope > header')!;
  heading.classList.add('player-heading');stage.append(heading);
  const quality=heading.querySelector<HTMLElement>('.player-quality')!;
  const fullscreen=heading.querySelector<HTMLButtonElement>('.player-fullscreen')!;
  const panel=overlay.querySelector<HTMLElement>('.server-panel')!;
  const extra=panel.querySelector<HTMLElement>('.player-extra-controls')!;
  const footer=shell.querySelector<HTMLElement>('.episode-navigation')!;
  const controls=document.createElement('div');controls.className='cinema-controls';
  controls.innerHTML=`<div class="cinema-timeline"><output class="elapsed">0:00</output><input type="range" min="0" max="1000" value="0" step="1" aria-label="Posição no vídeo" disabled><output class="duration">0:00</output></div><div class="cinema-toolbar"><button class="cinema-play" aria-label="Reproduzir">${icon('play')}</button><button class="cinema-mute" aria-label="Silenciar">${icon('volume')}</button><input class="cinema-volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"><span class="cinema-spacer"></span></div>`;
  const toolbar=controls.querySelector<HTMLElement>('.cinema-toolbar')!;
  stage.append(controls);
  const listeners:Array<()=>void>=[];let timer:number|undefined,open:string|null=null,disposed=false,scrubbing=false,keyboardMode=false;
  const on=(target:EventTarget,event:string,fn:EventListener)=>{target.addEventListener(event,fn);listeners.push(()=>target.removeEventListener(event,fn))};
  const menus=new Map<string,{body:HTMLElement;button:HTMLButtonElement}>();
  const list=panel.querySelector<HTMLElement>('.server-list')!;
  const sourceButtons=[...list.querySelectorAll<HTMLElement>('[data-stream]')];
  const torrents=sourceButtons.filter(button=>button.dataset.sourceKind==='torrent').length,directs=sourceButtons.length-torrents;
  const filters=document.createElement('div');filters.className='source-type-filter';filters.setAttribute('role','group');filters.setAttribute('aria-label','Tipo de servidor');
  filters.innerHTML=`<button type="button" data-filter-kind="all" aria-pressed="true">Todos <small>${sourceButtons.length}</small></button><button type="button" data-filter-kind="direct" aria-pressed="false">Diretos <small>${directs}</small></button><button type="button" data-filter-kind="torrent" aria-pressed="false">Torrents <small>${torrents}</small></button>`;
  filters.hidden=!torrents||!directs;list.before(filters);let sourceFilter='all';
  const filterSources=(kind:string)=>{sourceFilter=kind;for(const item of list.querySelectorAll<HTMLElement>('[data-source-kind]'))item.hidden=kind!=='all'&&item.dataset.sourceKind!==kind;for(const button of filters.querySelectorAll('button'))button.setAttribute('aria-pressed',String((button as HTMLElement).dataset.filterKind===kind));list.scrollTop=0};
  for(const button of filters.querySelectorAll<HTMLElement>('button'))on(button,'click',()=>filterSources(button.dataset.filterKind!));
  const sourceObserver=new MutationObserver(()=>{const active=list.querySelector<HTMLElement>('[data-stream].active');if(active&&sourceFilter!=='all'&&active.dataset.sourceKind!==sourceFilter)filterSources('all')});
  sourceObserver.observe(list,{subtree:true,attributes:true,attributeFilter:['class']});listeners.push(()=>sourceObserver.disconnect());
  const show=()=>{if(disposed)return;stage.classList.remove('controls-asleep');controls.inert=false;heading.inert=false;if(timer)clearTimeout(timer);timer=window.setTimeout(()=>{if(!video.paused&&!video.ended&&!open&&!(keyboardMode&&stage.matches(':focus-within'))&&!scrubbing){
    // Keep the dialog as the keyboard target when its focused button disappears.
    // Otherwise Chromium moves focus to body and Tab/Escape miss the dialog.
    if(controls.contains(document.activeElement)||heading.contains(document.activeElement))overlay.focus({preventScroll:true});
    stage.classList.add('controls-asleep');controls.inert=true;heading.inert=true;
  }},2800)};
  const closeMenus=()=>{for(const {body,button}of menus.values()){body.hidden=true;body.inert=true;button.setAttribute('aria-expanded','false')}open=null;show()};
  const addMenu=(id:string,title:string,content:HTMLElement[],symbol=id)=>{
    const button=document.createElement('button');button.type='button';button.className='cinema-menu-button';button.innerHTML=icon(symbol);button.title=title;button.setAttribute('aria-label',title);button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',`player-menu-${id}`);
    const body=id==='servers'?panel:document.createElement('section');body.id=`player-menu-${id}`;body.classList.add('cinema-popover');body.setAttribute('aria-label',title);body.hidden=true;body.inert=true;
    const top=document.createElement('div');top.className='cinema-menu-heading';const titleEl=document.createElement('b');titleEl.textContent=title;const dismiss=document.createElement('button');dismiss.type='button';dismiss.innerHTML=icon('close');dismiss.setAttribute('aria-label',`Fechar ${title.toLowerCase()}`);top.append(titleEl,dismiss);
    if(id==='servers')body.prepend(top);else body.append(top,...content);stage.append(body);toolbar.append(button);menus.set(id,{body,button});
    on(button,'click',()=>{const next=open!==id;closeMenus();if(next){open=id;body.hidden=false;body.inert=false;button.setAttribute('aria-expanded','true');show()}});
    on(dismiss,'click',()=>{closeMenus();button.focus()});
    return body;
  };
  addMenu('episodes','Episódios',[footer]);
  addMenu('settings','Reprodução',[quality,extra.querySelector<HTMLElement>(':scope > label')!,extra.querySelector<HTMLElement>('.player-shortcuts')!]);
  for(const [id,label,symbol]of [['audio','Áudio','audio'],['subtitles','Legendas','subtitles']]){
    const field=extra.querySelector<HTMLSelectElement>(`[aria-label="Faixa de ${id==='audio'?'áudio':'legendas'}"]`)!.parentElement!;
    const empty=document.createElement('p');empty.className='track-empty';empty.textContent=id==='audio'?'Esta fonte não disponibilizou outras faixas de áudio.':'Nenhuma faixa de legenda disponível nesta fonte.';
    const body=addMenu(id,label,[field,empty],symbol);
    if(id==='subtitles'){
      const appearance=document.createElement('fieldset');appearance.className='subtitle-appearance';appearance.hidden=true;appearance.innerHTML='<legend>Ajustes da legenda</legend><label>Atraso <output>0 s</output><input aria-label="Atraso da legenda" data-key="delay" type="range" min="-10" max="10" step="0.25" value="0"></label><label>Tamanho <output>100%</output><input aria-label="Tamanho da legenda" data-key="size" type="range" min="75" max="175" step="5" value="100"></label><label>Elevar legenda <output>0%</output><input aria-label="Posição vertical da legenda" data-key="position" type="range" min="0" max="25" step="1" value="0"></label>';
      body.append(appearance);const select=field.querySelector('select')!;
      const observer=new MutationObserver(()=>appearance.hidden=select.dataset.embedded!=='true'||select.value==='-1');observer.observe(select,{attributes:true,childList:true});listeners.push(()=>observer.disconnect());
      on(select,'change',()=>appearance.hidden=select.dataset.embedded!=='true'||select.value==='-1');
      for(const input of appearance.querySelectorAll<HTMLInputElement>('input'))on(input,'input',()=>{input.previousElementSibling!.textContent=input.value+(input.dataset.key==='delay'?' s':'%');const settings=Object.fromEntries([...appearance.querySelectorAll<HTMLInputElement>('input')].map(el=>[el.dataset.key,Number(el.value)]));select.dispatchEvent(new CustomEvent('anibr:subtitle-settings',{detail:settings}))});
    }
  }
  const stats=panel.querySelector<HTMLElement>('.torrent-info')!;
  const note=document.createElement('p');note.textContent='O cache é salvo neste computador. O upload P2P permanece desativado.';
  addMenu('stats','Transferência',[stats,note]);
  addMenu('servers','Servidores',[]);
  toolbar.append(fullscreen);
  const retry=extra.querySelector<HTMLElement>('.retry-stream')!;panel.append(retry);extra.remove();
  const play=controls.querySelector<HTMLButtonElement>('.cinema-play')!,mute=controls.querySelector<HTMLButtonElement>('.cinema-mute')!,volume=controls.querySelector<HTMLInputElement>('.cinema-volume')!,seek=controls.querySelector<HTMLInputElement>('.cinema-timeline input')!;
  const sync=()=>{play.innerHTML=icon(video.paused?'play':'pause');play.setAttribute('aria-label',video.paused?'Reproduzir':'Pausar');mute.innerHTML=icon(video.muted||video.volume===0?'mute':'volume');mute.setAttribute('aria-label',video.muted?'Ativar som':'Silenciar');volume.value=String(video.muted?0:video.volume);const duration=Number.isFinite(video.duration)?video.duration:0;seek.disabled=!duration;if(!scrubbing)seek.value=String(duration?Math.round(video.currentTime/duration*1000):0);seek.style.setProperty('--played',`${Number(seek.value)/10}%`);seek.setAttribute('aria-valuetext',`${mediaClock(video.currentTime)} de ${mediaClock(duration)}`);controls.querySelector('.elapsed')!.textContent=mediaClock(video.currentTime);controls.querySelector('.duration')!.textContent=mediaClock(duration);if(video.paused||video.ended)show()};
  const toggle=()=>{if(video.paused)video.play().catch(()=>{});else video.pause()};
  on(play,'click',toggle);on(video,'click',()=>{closeMenus();toggle()});on(video,'dblclick',()=>fullscreen.click());
  on(mute,'click',()=>{video.muted=!video.muted});on(volume,'input',()=>{video.muted=false;video.volume=Number(volume.value)});
  on(seek,'input',()=>{scrubbing=true;controls.querySelector('.elapsed')!.textContent=mediaClock(Number(seek.value)/1000*video.duration);seek.style.setProperty('--played',`${Number(seek.value)/10}%`)});
  on(seek,'change',()=>{if(Number.isFinite(video.duration))video.currentTime=Number(seek.value)/1000*video.duration;scrubbing=false;sync();show()});
  for(const e of ['timeupdate','durationchange','loadedmetadata','play','pause','ended','volumechange','emptied'])on(video,e,()=>{sync();if(e==='play')show()});
  on(stage,'pointermove',show);on(stage,'pointerdown',()=>{keyboardMode=false;show()});on(stage,'focusin',show);on(stage,'focusout',show);on(overlay,'keydown',()=>{keyboardMode=true;show()});
  on(stage,'keydown',event=>{if((event as KeyboardEvent).key==='Escape'&&open){event.stopImmediatePropagation();event.preventDefault();const button=menus.get(open)?.button;closeMenus();button?.focus()}});
  on(stage,'click',event=>{if((event.target as HTMLElement).closest('.cinema-popover,.cinema-controls'))return;closeMenus()});
  on(document,'fullscreenchange',()=>{fullscreen.setAttribute('aria-label',document.fullscreenElement?'Sair da tela cheia':'Entrar em tela cheia');fullscreen.title=document.fullscreenElement?'Sair da tela cheia (F)':'Tela cheia (F)';show()});
  // Wake controls before the outer dialog computes its keyboard focus cycle.
  const wakeKeys=()=>{keyboardMode=true;show()};overlay.addEventListener('keydown',wakeKeys,true);listeners.push(()=>overlay.removeEventListener('keydown',wakeKeys,true));
  video.controls=false;sync();show();
  return ()=>{disposed=true;if(timer)clearTimeout(timer);for(const remove of listeners)remove();video.controls=true};
}
