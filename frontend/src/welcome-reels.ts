import {ribbonPoints} from './welcome-reel-data';

let nextMaskId=0;

export function mountWelcomeReels(surface:HTMLElement,reduced:boolean){
  if(reduced)return ()=>{};
  const ns='http://www.w3.org/2000/svg',maskId=`welcome-mosaic-mask-${++nextMaskId}`;
  const svg=document.createElementNS(ns,'svg');svg.classList.add('welcome-reel-mask');svg.setAttribute('aria-hidden','true');
  const defs=document.createElementNS(ns,'defs'),mask=document.createElementNS(ns,'clipPath');mask.id=maskId;mask.setAttribute('clipPathUnits','userSpaceOnUse');defs.appendChild(mask);svg.appendChild(defs);
  const layer=document.createElement('div');layer.className='welcome-reels';layer.setAttribute('aria-hidden','true');layer.style.clipPath=`url(#${maskId})`;
  const video=document.createElement('video');video.className='welcome-mosaic';video.hidden=true;video.muted=true;video.defaultMuted=true;video.loop=true;video.playsInline=true;video.preload='none';video.tabIndex=-1;video.setAttribute('disablepictureinpicture','');video.setAttribute('disableremoteplayback','');video.setAttribute('aria-hidden','true');
  const fallback=document.createElement('img');fallback.className='welcome-mosaic-fallback';fallback.alt='';fallback.hidden=true;layer.append(video,fallback);surface.prepend(svg,layer);
  const bands=[-28,67,5].map(angle=>{const polygon=document.createElementNS(ns,'polygon');polygon.setAttribute('points','0,0 0,0 0,0 0,0');mask.appendChild(polygon);return {polygon,angle,x:0,y:0}});
  let disposed=false,frame=0,last=0,lastMove=-Infinity,presence=0,started=false,playing=false,blocked=false,failed=false;
  let width=surface.clientWidth,height=surface.clientHeight,targetX=width*.5,targetY=height*.5;
  const pause=()=>{video.pause();playing=false};
  const play=()=>{if(playing||blocked||failed||!started||document.hidden||disposed)return;playing=true;video.play().catch(error=>{playing=false;if(error?.name==='NotAllowedError')blocked=true})};
  const start=()=>{if(started)return;started=true;video.hidden=false;video.poster='/media/welcome-mosaic.jpg';video.src='/media/welcome-mosaic.mp4';fallback.src='/media/welcome-mosaic.jpg';play()};
  video.addEventListener('loadedmetadata',()=>{if(!disposed&&Number.isFinite(video.duration)&&video.duration>1)video.currentTime=Math.random()*(video.duration-1)});
  video.addEventListener('error',()=>{if(disposed)return;failed=true;pause();video.hidden=true;fallback.hidden=false});
  const stop=()=>{cancelAnimationFrame(frame);frame=0;presence=0;layer.style.opacity='0';pause()};
  const draw=(now:number)=>{
    frame=0;if(disposed||document.hidden||surface.dataset.step!=='hello'){stop();return}
    const dt=Math.min((now-(last||now))/1000,.05);last=now;
    const wanted=now-lastMove<1300?1:0;presence+=(wanted-presence)*(1-Math.exp(-(wanted?6:3.8)*dt));layer.style.opacity=presence.toFixed(3);
    const base=Math.max(72,Math.min(170,Math.min(width,height)*.15));
    bands.forEach((band,index)=>{
      const offsets=[[0,0],[width*.17,-height*.17],[-width*.18,height*.20]][index];
      const blend=1-Math.exp(-(9-index*2)*dt);band.x+=(targetX+offsets[0]-band.x)*blend;band.y+=(targetY+offsets[1]-band.y)*blend;
      band.polygon.setAttribute('points',ribbonPoints(band.x,band.y,width,height,band.angle,base*[1,.72,.65][index]*presence));
    });
    if(presence>.03){start();play()}
    if(presence<.008&&!wanted){stop();return}
    frame=requestAnimationFrame(draw);
  };
  const wake=()=>{if(!frame){last=0;frame=requestAnimationFrame(draw)}};
  const move=(event:PointerEvent)=>{
    if(disposed||surface.dataset.step!=='hello'||(event.target as HTMLElement).closest('button,input,a'))return;
    const bounds=surface.getBoundingClientRect();targetX=event.clientX-bounds.left;targetY=event.clientY-bounds.top;lastMove=performance.now();
    if(!started)bands.forEach(band=>{band.x=targetX;band.y=targetY});wake();
  };
  const leave=()=>{lastMove=-Infinity;wake()};
  const gesture=(event:PointerEvent)=>{move(event);if(surface.dataset.step==='hello'){start();blocked=false;play()}};
  const visibility=()=>{if(document.hidden)stop()};
  const observer=new ResizeObserver(()=>{width=surface.clientWidth;height=surface.clientHeight});observer.observe(surface);
  surface.addEventListener('pointermove',move,{passive:true});surface.addEventListener('pointerdown',gesture,{passive:true});surface.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);
  return ()=>{disposed=true;stop();observer.disconnect();surface.removeEventListener('pointermove',move);surface.removeEventListener('pointerdown',gesture);surface.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);video.removeAttribute('src');video.removeAttribute('poster');video.load();layer.remove();svg.remove()};
}
