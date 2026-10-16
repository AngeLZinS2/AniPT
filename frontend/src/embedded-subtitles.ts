import type JASSUB from 'jassub';
import type {ASSStyle} from 'jassub/dist/worker/util';
import workerUrl from 'jassub/dist/worker/worker.js?worker&url';
import wasmUrl from 'jassub/dist/wasm/jassub-worker.wasm?url';
import modernWasmUrl from 'jassub/dist/wasm/jassub-worker-modern.wasm?url';
import defaultFont from 'jassub/dist/default.woff2?url';
import {assChunk,defaultAssHeader,preferredSubtitle,type EmbeddedCue,type EmbeddedTrack,type SubtitleMessage} from './subtitle-types';
export type EmbeddedState={tracks:EmbeddedTrack[];selected:number;status:'loading'|'ready'|'error'};
export type SubtitleAppearance={delay:number;size:number;position:number};
export function embeddedSubtitles(video:HTMLVideoElement,url:string,bytes:number,changed:()=>void){
  const state:EmbeddedState={tracks:[],selected:-1,status:'loading'};
  const worker=new Worker(new URL('./mkv-worker.ts',import.meta.url),{type:'module',name:'anibr-mkv-subtitles'});
  let renderer:JASSUB|undefined,disposed=false,epoch=0,readOrder=0,queue=Promise.resolve(),cueBytes=0;
  let styles:ASSStyle[]=[],appearance:SubtitleAppearance={delay:0,size:100,position:0},playResY=720;
  const cues=new Map<number,EmbeddedCue[]>(),fonts:Uint8Array[]=[];
  const fail=()=>{if(disposed)return;state.status='error';state.selected=-1;renderer?._canvas.style.setProperty('visibility','hidden');changed()};
  const startup=window.setTimeout(()=>{if(state.status==='loading'){worker.terminate();fail()}},45000);
  const enqueue=(action:()=>Promise<void>)=>{queue=queue.then(async()=>{if(!disposed)await action()}).catch(fail)};
  const ensureRenderer=async()=>{
    if(renderer)return renderer;
    const {default:JASSUB}=await import('jassub');if(disposed)throw new Error('Closed');
    // libass bitmap cache limit is expressed in MB, not bytes.
    renderer=new JASSUB({video,workerUrl,wasmUrl,modernWasmUrl,availableFonts:{'liberation sans':defaultFont},subContent:defaultAssHeader,queryFonts:false,fonts,maxRenderHeight:1080,libassMemoryLimit:32,libassGlyphLimit:1000});
    renderer._worker.addEventListener('error',fail);await Promise.race([renderer.ready,new Promise<never>((_,reject)=>{const timer=window.setTimeout(()=>reject(new Error('Subtitle renderer timeout')),15000);renderer!.ready.then(()=>clearTimeout(timer),()=>clearTimeout(timer))})]);
    return renderer;
  };
  const repaint=async(current:JASSUB)=>{if(video.videoWidth&&video.videoHeight)await current.manualRender({mediaTime:video.currentTime,expectedDisplayTime:performance.now(),width:video.videoWidth,height:video.videoHeight},true)};
  const applyAppearance=async(current:JASSUB)=>{current.timeOffset=-appearance.delay;for(let index=0;index<styles.length;index++){const style=styles[index];await current.renderer.setStyle({...style,FontSize:style.FontSize*appearance.size/100,MarginV:style.MarginV+Math.round(playResY*appearance.position/100)},index)}};
  const select=(number:number)=>{
    state.selected=state.tracks.some(t=>t.number===number)?number:-1;const version=++epoch;changed();
    if(state.selected===-1){if(renderer)renderer._canvas.style.visibility='hidden';return}
    const track=state.tracks.find(t=>t.number===state.selected)!,existing=[...(cues.get(track.number)||[])];
    enqueue(async()=>{const current=await ensureRenderer();if(disposed||version!==epoch)return;await current.renderer.setTrack(track.header||defaultAssHeader);styles=await current.renderer.getStyles();playResY=Number((track.header||'').match(/PlayResY:\s*(\d+)/i)?.[1])||720;await applyAppearance(current);readOrder=0;for(const cue of existing){if(version!==epoch||disposed)return;await current.renderer.processChunk(assChunk(cue,track.type==='utf8',readOrder++),cue.time,cue.duration)}if(version===epoch){current._canvas.style.visibility='visible';await current.resize(true);await repaint(current)}});
  };
  worker.onmessage=(event:MessageEvent<SubtitleMessage>)=>{
    if(disposed)return;const message=event.data;
    if(message.kind==='tracks'){
      clearTimeout(startup);
      // A parser restart re-emits tracks. Preserve an explicit user selection.
      const first=state.status==='loading';state.tracks=message.tracks;state.status='ready';if(first)select(preferredSubtitle(state.tracks));else changed();
    }else if(message.kind==='cues'){
      const version=epoch,track=state.tracks.find(t=>t.number===state.selected),active:EmbeddedCue[]=[];
      for(const {track:number,cue}of message.cues){
        if(cueBytes+cue.text.length>16*1024*1024)continue;
        const saved=cues.get(number)||[];if(saved.length>=20000)continue;
        saved.push(cue);cueBytes+=cue.text.length;cues.set(number,saved);if(number===state.selected)active.push(cue);
      }
      if(track&&active.length)enqueue(async()=>{const current=await ensureRenderer();if(version!==epoch)return;for(const cue of active){if(disposed||version!==epoch)return;await current.renderer.processChunk(assChunk(cue,track.type==='utf8',readOrder++),cue.time,cue.duration)}if(video.paused)await repaint(current)});
    }else if(message.kind==='font'){
      if(fonts.reduce((n,font)=>n+font.byteLength,0)+message.data.byteLength>24*1024*1024)return;fonts.push(message.data);
      if(renderer)enqueue(async()=>{await renderer!.ready;await renderer!.renderer.addFonts([message.data])});
    }else if(message.kind==='reset'){cues.clear();cueBytes=0;if(state.selected!==-1)select(state.selected)}else fail();
  };
  worker.onerror=fail;
  const time=()=>worker.postMessage({kind:'time',time:video.currentTime});
  const seek=()=>worker.postMessage({kind:'seek',time:video.currentTime});
  video.addEventListener('timeupdate',time);video.addEventListener('seeking',seek);
  worker.postMessage({kind:'start',url,bytes,time:video.currentTime});changed();
  return {state,select,configure(settings:SubtitleAppearance){appearance={delay:Number.isFinite(settings.delay)?Math.max(-10,Math.min(10,settings.delay)):0,size:Number.isFinite(settings.size)?Math.max(75,Math.min(175,settings.size)):100,position:Number.isFinite(settings.position)?Math.max(0,Math.min(25,settings.position)):0};if(renderer)enqueue(async()=>{await applyAppearance(renderer!);await repaint(renderer!)})},destroy(){disposed=true;epoch++;clearTimeout(startup);worker.terminate();video.removeEventListener('timeupdate',time);video.removeEventListener('seeking',seek);cues.clear();fonts.length=0;if(renderer){const current=renderer;current.destroy().catch(()=>{});setTimeout(()=>current._worker.terminate(),2000)}}};
}
