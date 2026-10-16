import {SubtitleParser,SubtitleStream} from 'virtual:matroska-browser';
import {cuesLocation,readCues,segmentDataOffset,elementSize,seekPosition,type CuePosition} from './mkv-index';
import type {EmbeddedCue,EmbeddedTrack,SubtitleMessage} from './subtitle-types';
const send=(message:SubtitleMessage)=>postMessage(message);
let url='',bytes=0,currentTime=0,head:any,parser:any,abort:AbortController|undefined,generation=0,parsedTime=0;
let tracks:EmbeddedTrack[]=[],index:CuePosition[]=[],wake:undefined|(()=>void),pending:{track:number;cue:EmbeddedCue}[]=[];
const flush=()=>{if(pending.length){send({kind:'cues',cues:pending});pending=[]}};
const bind=(target:any)=>{
  target.on('tracks',(all:EmbeddedTrack[])=>{tracks=all.filter(t=>['ass','ssa','utf8'].includes(t.type));send({kind:'tracks',tracks});if(!tracks.length)abort?.abort()});
  target.on('subtitle',(cue:EmbeddedCue,track:number)=>{if(Number.isFinite(cue.time)&&Number.isFinite(cue.duration)&&cue.duration>0&&cue.text.length<100000){pending.push({track,cue});if(pending.length>=50)flush()}});
  let fontBytes=0;target.on('file',(file:{filename:string;data:Uint8Array})=>{if(/\.(ttf|otf|woff2?)$/i.test(file.filename)&&file.data.length<=8*1024*1024&&(fontBytes+=file.data.length)<=24*1024*1024)send({kind:'font',data:new Uint8Array(file.data)})});
  target.decoder.on('data',(tag:{id:number;data:number})=>{if(tag.id===0xe7)parsedTime=tag.data*target.timecodeScale/1000});
  target.on('error',()=>{abort?.abort();send({kind:'error'})});
  target.resume?.();
};
async function range(start:number,end:number,signal:AbortSignal){
  const response=await fetch(url,{headers:{Range:`bytes=${start}-${Math.min(bytes-1,end)}`},signal,cache:'no-store'});
  if(response.status!==206)throw new Error('Range required');return response;
}
async function loadIndex(header:Uint8Array,signal:AbortSignal){
  const at=cuesLocation(header),segment=segmentDataOffset(header);if(at===undefined||segment===undefined||at>=bytes)return;
  let data=new Uint8Array(await (await range(at,at+65535,signal)).arrayBuffer());const size=elementSize(data);
  if(!size||size>4*1024*1024)return;if(size>data.length)data=new Uint8Array(await (await range(at,at+size-1,signal)).arrayBuffer());
  index=readCues(data,segment,head.timecodeScale);
}
async function parse(start=0){
  const version=++generation;abort?.abort();wake?.();const controller=new AbortController();abort=controller;
  try{
    const target=start?new SubtitleStream(head):head;parser=target;if(start){
      // Cues provide an exact cluster boundary. The upstream heuristic expects
      // Timecode first and otherwise skips valid clusters that begin with CRC32.
      target.unstable=false;bind(target);send({kind:'reset'});
    }
    for(let at=start;at<bytes&&version===generation;){
      const response=await range(at,at+4*1024*1024-1,controller.signal),reader=response.body!.getReader();
      try{while(version===generation){
        // At most a minute of lookahead; no complete-video buffering in JS.
        while(parsedTime>currentTime+60&&version===generation){flush();await new Promise<void>(resolve=>wake=resolve);wake=undefined}
        const chunk=await reader.read();if(chunk.done)break;
        target.write(chunk.value);if(target.decoder.buffer?.length>24*1024*1024)throw new Error('Oversized EBML element');at+=chunk.value.length;flush();
      }}finally{await reader.cancel().catch(()=>{})}
    }flush();
  }catch{if(!controller.signal.aborted&&version===generation)send({kind:'error'})}
}
onmessage=async(event:MessageEvent<{kind:string;url?:string;bytes?:number;time?:number}>)=>{
  const message=event.data;
  if(message.kind==='time'){currentTime=message.time||0;wake?.();return}
  if(message.kind==='seek'){
    currentTime=message.time||0;wake?.();const point=seekPosition(index,currentTime);
    if(head&&tracks.length&&(currentTime<parsedTime-60||currentTime>parsedTime+90)&&point){parsedTime=point.time;void parse(point.offset)}return;
  }
  if(message.kind!=='start')return;
  url=message.url!;bytes=message.bytes!;currentTime=message.time||0;
  // Inspect just the header first. Index requests are bounded and independently
  // cancellable; a missing index never prevents linear playback.
  const controller=new AbortController();abort=controller;
  try{
    head=new SubtitleParser();bind(head);
    const header=new Uint8Array(await(await range(0,Math.min(bytes-1,512*1024-1),controller.signal)).arrayBuffer());
    if(header[0]!==0x1a||header[1]!==0x45){send({kind:'tracks',tracks:[]});return}
    head.write(header);flush();
    if(!tracks.length){send({kind:'tracks',tracks:[]});return}
    await loadIndex(header,controller.signal).catch(()=>{});
    // Start with a fresh parser: the header may end inside a video packet.
    const point=seekPosition(index,currentTime);parsedTime=point?.time||0;
    if(point)void parse(point.offset);else {send({kind:'reset'});head=new SubtitleParser();bind(head);void parse()}
  }catch{if(!controller.signal.aborted)send({kind:'error'})}
};
