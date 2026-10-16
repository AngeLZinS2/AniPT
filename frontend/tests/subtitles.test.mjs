import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {build} from 'esbuild';
const code=await build({entryPoints:['src/mkv-index.ts','src/subtitle-types.ts'],bundle:true,write:false,outdir:'ignored',format:'esm',platform:'node'});
const modules=await Promise.all(code.outputFiles.map(file=>import('data:text/javascript;base64,'+Buffer.from(file.text).toString('base64'))));
const {cuesLocation,readCues,segmentDataOffset,elementSize,seekPosition}=modules.find(m=>m.readCues);
const {preferredSubtitle,assChunk}=modules.find(m=>m.preferredSubtitle);
const fixture=readFileSync(new URL('./fixtures/subtitles.mkv',import.meta.url));
const context={console,queueMicrotask,Uint8Array,ArrayBuffer,TextEncoder,TextDecoder,setTimeout,clearTimeout};vm.createContext(context);
const browserBundle=readFileSync(new URL('../node_modules/matroska-subtitles/dist/matroska-subtitles.min.js',import.meta.url),'utf8').replaceAll('window.queueMicrotask','globalThis.queueMicrotask');
vm.runInContext(browserBundle,context);
const {SubtitleParser,SubtitleStream}=context.MatroskaSubtitles;
test('actual browser demuxer reads Portuguese ASS tracks and timed packets without window',()=>{
 const parser=new SubtitleParser(),packets=[];let tracks=[];
 parser.on('tracks',t=>tracks=t);parser.on('subtitle',(cue,track)=>packets.push({cue,track}));
 parser.write(new Uint8Array(fixture));
 assert.equal(tracks.length,2);assert.equal(preferredSubtitle(tracks),2);
 assert.equal(packets.filter(p=>p.track===2).length,4);
 assert.equal(packets.find(p=>p.cue.time===90000&&p.track===2).cue.text,'Depois de avançar · 90 segundos');
 assert.equal(packets[0].cue.duration,15000);
});
test('MKV cues locate real cluster byte offsets and preserve seconds on seek',()=>{
 const offset=cuesLocation(fixture);assert.ok(offset>0&&offset<fixture.length);
 const size=elementSize(fixture.subarray(offset));assert.ok(size>0&&size<4096);
 const index=readCues(fixture.subarray(offset,offset+size),segmentDataOffset(fixture));assert.ok(index.length>10);
 const point=seekPosition(index,95);assert.ok(point.time<=83&&point.time>60);
 assert.equal(fixture.subarray(point.offset,point.offset+4).toString('hex'),'1f43b675');
 const parser=new SubtitleParser();parser.write(new Uint8Array(fixture.subarray(0,index[0].offset)));
 const next=new SubtitleStream(parser),found=[];next.unstable=false;next.on('data',()=>{});next.on('subtitle',(cue,track)=>{if(track===2)found.push(cue)});
 next.write(new Uint8Array(fixture.subarray(point.offset)));
 assert.ok(found.some(c=>c.time===90000));assert.ok(!found.some(c=>c.time===0));
});
test('missing/truncated/oversized indexes never fabricate a byte offset',()=>{
 assert.equal(cuesLocation(new Uint8Array([0,1,2])),undefined);
 assert.deepEqual(readCues(new Uint8Array([0x1c,0x53,0xbb,0x6b,0xff]),0),[]);
 assert.equal(seekPosition([],100),undefined);
});
test('Portuguese full subtitles win over CC and other languages are not silently selected',()=>{
 const tracks=[{number:1,language:'eng',type:'ass'},{number:2,language:'por',name:'Português CC',type:'ass'},{number:3,language:'por',name:'Português (Brasil)',type:'ass'}];
 assert.equal(preferredSubtitle(tracks),3);assert.equal(preferredSubtitle(tracks.slice(0,1)),-1);
 assert.equal(preferredSubtitle([{number:1,language:'por',type:'pgs'}]),-1);
});
test('streamed ASS packets have unique ReadOrder and preserve dialogue/style/margins',()=>{
 const cue={text:'Olá, mundo!{\\i1} Texto',time:0,duration:3000,layer:'2',style:'Signs',marginV:'40'};
 assert.equal(assChunk(cue,false,73),'73,2,Signs,,0,0,40,,Olá, mundo!{\\i1} Texto');
 assert.ok(assChunk({...cue,text:'Linha 1\nLinha 2'},true,74).endsWith('Linha 1\\NLinha 2'));
});
