import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const result=await build({entryPoints:[fileURLToPath(new URL('../src/torrent-selection.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
const {resolveTorrentEpisode,rankedSourceIndices,streamDisplayTitle,nextSourceIndex}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const target={season:1,episode:1,title:'Demon Slayer: Kimetsu no Yaiba',aliases:['Kimetsu no Yaiba']};
test('Demon Slayer screenshot package selects S01E01 without an addon index or user prompt',()=>{
  const files=Array.from({length:26},(_,i)=>({index:i,name:'[Judas] Kimetsu no Yaiba - S01E'+String(i+1).padStart(2,'0')+'.mkv'}));
  assert.deepEqual(resolveTorrentEpisode(files,target),{index:0,reason:'matched'});
});
test('second season never selects season one and does not rely on list position',()=>{
  assert.equal(resolveTorrentEpisode([{index:0,name:'Show S01E01.mkv'},{index:7,name:'Show S02E01.mkv'}],{...target,season:2}).index,7);
  assert.equal(resolveTorrentEpisode([{index:0,name:'Show S01E01.mkv'}],{...target,season:2}).reason,'unmatched');
});
test('episode range, OVA and extras are never auto-selected as the main episode',()=>{
  const files=['Kimetsu no Yaiba OVA S01E01.mkv','Extras/Kimetsu no Yaiba S01E01.mkv','Kimetsu no Yaiba - 01 ~ 26.mkv'];
  assert.equal(resolveTorrentEpisode(files.map((name,index)=>({name,index})),target).reason,'unmatched');
});
test('AOT unnumbered season one filenames select the episode from real metadata',()=>{
  const files=[{index:0,name:'[Erai-raws] Shingeki no Kyojin - 01 [1080p].mkv'},{index:1,name:'[Erai-raws] Shingeki no Kyojin - 02 [1080p].mkv'}];
  assert.equal(resolveTorrentEpisode(files,{season:1,episode:2,title:'Attack on Titan',aliases:['Shingeki no Kyojin']}).index,1);
});
test('season folder confirms a bare episode while an ambiguous sequel does not',()=>{
  assert.equal(resolveTorrentEpisode([{index:9,name:'Season 2/01 - Start.mkv'}],{...target,season:2}).index,9);
  assert.equal(resolveTorrentEpisode([{index:9,name:'Kimetsu no Yaiba - 01.mkv'}],{...target,season:2}).reason,'unmatched');
});
test('equally strong matches are ambiguous and require trying another source',()=>{
  assert.equal(resolveTorrentEpisode([{index:0,name:'A S01E01.mkv'},{index:1,name:'B S01E01.mkv'}],target).reason,'ambiguous');
});
const source=(seeders,quality='1080p',format='Torrent',language='Idioma não informado')=>({seeders,quality,format,language,title:'[Judas] Kimetsu no Yaiba'});
test('highest reported seed count wins before quality or original source order',()=>{
  assert.deepEqual(rankedSourceIndices([source(20,'2160p'),source(989),source(82),source(null,'1080p','MP4')],'legendado','2160p'),[1,2,0,3]);
});
test('known opposite audio is excluded when compatible or unknown audio is offered',()=>{
  assert.deepEqual(rankedSourceIndices([source(999,'1080p','Torrent','Dublado'),source(50)],'legendado','auto'),[1]);
});
test('content title replaces provider label and removes embedded URLs',()=>{
  assert.equal(streamDisplayTitle({title:'[Judas] Kimetsu no Yaiba S01E01',quality:'1080p'},'Demon Slayer'),'[Judas] Kimetsu no Yaiba S01E01');
  assert.equal(streamDisplayTitle({title:'https://private.example/token',quality:''},'Demon Slayer'),'Demon Slayer');
});

test('underscore metadata names and final season folders preserve episode boundaries',()=>{
  assert.equal(resolveTorrentEpisode([{index:5,name:'Show_S01E01_1080p.mkv'}],target).index,5);
  assert.equal(resolveTorrentEpisode([{index:5,name:'Final Season/Show S01E01.mkv'}],target).reason,'unmatched');
  assert.equal(resolveTorrentEpisode([{index:5,name:'Season 2/Show S01E01.mkv'}],target).reason,'unmatched');
});
test('equal seeds use quality as a stable tie breaker without mutating source order',()=>{
  const sources=[source(80,'720p'),source(80,'1080p'),source(80,'2160p')];
  assert.deepEqual(rankedSourceIndices(sources,'legendado','1080p'),[1,0,2]);
  assert.equal(sources[0].quality,'720p');
});
test('automatic fallback visits each source once and stops when all are exhausted',()=>{
  const order=[2,0,1],attempted=new Set();
  for(const expected of order){const next=nextSourceIndex(order,attempted);assert.equal(next,expected);attempted.add(next);}
  assert.equal(nextSourceIndex(order,attempted),undefined);
});
