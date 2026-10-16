import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const result=await build({entryPoints:[fileURLToPath(new URL('../src/torrent-selection.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
const {resolveTorrentEpisode,rankedSourceIndices,streamDisplayTitle,nextSourceIndex,torrentPackageConflicts}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const target={season:1,episode:1,title:'Demon Slayer: Kimetsu no Yaiba',aliases:['Kimetsu no Yaiba']};
test('Demon Slayer screenshot package selects S01E01 without an addon index or user prompt',()=>{
  const files=Array.from({length:26},(_,i)=>({index:i,name:'[Judas] Kimetsu no Yaiba - S01E'+String(i+1).padStart(2,'0')+'.mkv'}));
  assert.deepEqual(resolveTorrentEpisode(files,target),{index:0,reason:'matched'});
});
test('second season never selects season one and does not rely on list position',()=>{
  assert.equal(resolveTorrentEpisode([{index:0,name:'Kimetsu no Yaiba S01E01.mkv'},{index:7,name:'Kimetsu no Yaiba S02E01.mkv'}],{...target,season:2}).index,7);
  assert.equal(resolveTorrentEpisode([{index:0,name:'Kimetsu no Yaiba S01E01.mkv'}],{...target,season:2}).reason,'unmatched');
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
  assert.equal(resolveTorrentEpisode([{index:9,name:'Kimetsu no Yaiba/Season 2/01 - Start.mkv'}],{...target,season:2}).index,9);
  assert.equal(resolveTorrentEpisode([{index:9,name:'Kimetsu no Yaiba - 01.mkv'}],{...target,season:2}).reason,'unmatched');
});
test('equally strong matches are ambiguous and require trying another source',()=>{
  assert.equal(resolveTorrentEpisode([{index:0,name:'[Group A] Kimetsu no Yaiba S01E01.mkv'},{index:1,name:'[Group B] Kimetsu no Yaiba S01E01.mkv'}],target).reason,'ambiguous');
});
const source=(seeders,quality='1080p',format='Torrent',language='Idioma não informado')=>({seeders,quality,format,language,title:'[Judas] Kimetsu no Yaiba'});
test('direct video takes priority and torrents follow in reported seed order',()=>{
  assert.deepEqual(rankedSourceIndices([source(20,'2160p'),source(989),source(82),source(null,'1080p','MP4')],'legendado','2160p'),[3,1,2,0]);
});
test('known opposite audio is excluded when compatible or unknown audio is offered',()=>{
  assert.deepEqual(rankedSourceIndices([source(999,'1080p','Torrent','Dublado'),source(50)],'legendado','auto'),[1]);
});
test('content title replaces provider label and removes embedded URLs',()=>{
  assert.equal(streamDisplayTitle({title:'[Judas] Kimetsu no Yaiba S01E01',quality:'1080p'},'Demon Slayer'),'[Judas] Kimetsu no Yaiba S01E01');
  assert.equal(streamDisplayTitle({title:'https://private.example/token',quality:''},'Demon Slayer'),'Demon Slayer');
});

test('underscore metadata names and final season folders preserve episode boundaries',()=>{
  assert.equal(resolveTorrentEpisode([{index:5,name:'Kimetsu_no_Yaiba_S01E01_1080p.mkv'}],target).index,5);
  assert.equal(resolveTorrentEpisode([{index:5,name:'Final Season/Kimetsu no Yaiba S01E01.mkv'}],target).reason,'unmatched');
  assert.equal(resolveTorrentEpisode([{index:5,name:'Season 2/Kimetsu no Yaiba S01E01.mkv'}],target).reason,'unmatched');
});

const hero={season:1,episode:1,title:'My Hero Academia',aliases:['Boku no Hero Academia']};
test('matching episode coordinates or a season folder alone never identify the anime',()=>{
  for(const name of ['Other Anime S01E01.mkv','Season 1/Other Anime - 01.mkv','Season 1/01.mkv']){
    assert.equal(resolveTorrentEpisode([{index:0,name}],hero).reason,'unmatched',name);
  }
  assert.equal(resolveTorrentEpisode([{index:4,name:'Season 1/S01E01.mkv'}],{...hero,packageTitle:'Boku no Hero Academia'}).index,4);
});

test('Boku season one rejects third-season names even when the file says local S01E01',()=>{
  for(const part of ['Season 3','3rd Season','3ª Temporada','Season III','III Season','Temporada III']){
    for(const name of [`${part}/Boku no Hero Academia S01E01.mkv`,`Boku no Hero Academia ${part} - 01.mkv`]){
      assert.equal(resolveTorrentEpisode([{index:0,name}],hero).reason,'unmatched',name);
    }
    for(const name of ['Boku no Hero Academia S01E01.mkv','Boku no Hero Academia - 01.mkv']){
      assert.equal(resolveTorrentEpisode([{index:0,name}],{...hero,packageTitle:`Boku no Hero Academia ${part}`}).reason,'unmatched',part+' / '+name);
    }
  }
});

test('the requested third part may use Kitsu-local season one without changing episode coordinates',()=>{
  const third={...hero,title:'My Hero Academia 3rd Season',aliases:['Boku no Hero Academia 3rd Season']};
  assert.equal(resolveTorrentEpisode([{index:4,name:'Boku no Hero Academia 3rd Season - 01.mkv'}],third).index,4);
  assert.equal(resolveTorrentEpisode([{index:4,name:'Boku no Hero Academia/Season III/S01E01.mkv'}],third).index,4);
  assert.equal(resolveTorrentEpisode([{index:4,name:'Boku no Hero Academia S01E01.mkv'}],{...third,packageTitle:'Boku no Hero Academia 3rd Season'}).index,4);
  assert.equal(resolveTorrentEpisode([{index:4,name:'Boku no Hero Academia S03E01.mkv'}],third).reason,'unmatched');
  assert.equal(resolveTorrentEpisode([{index:4,name:'Boku no Hero Academia S01E01.mkv'}],third).reason,'unmatched');
  assert.equal(resolveTorrentEpisode([{index:4,name:'Boku no Hero Academia S03E01.mkv'}],{...third,season:3}).index,4);
});

test('season and cour part markers are distinct and conflicting parts are rejected',()=>{
  const secondPart={season:3,episode:1,title:'Attack on Titan Season 3 Part 2',aliases:['Shingeki no Kyojin Season 3 Part 2']};
  assert.equal(resolveTorrentEpisode([{index:2,name:'Shingeki no Kyojin/Season III/Part 2/S03E01.mkv'}],secondPart).index,2);
  assert.equal(resolveTorrentEpisode([{index:2,name:'Shingeki no Kyojin/Season III/Part 1/S03E01.mkv'}],secondPart).reason,'unmatched');
});

test('multi-season collections use the file path season instead of the package range',()=>{
  for(const packageTitle of ['Boku no Hero Academia S01-S06','Boku no Hero Academia Seasons 1-6','Boku no Hero Academia Complete Collection']){
    const collection={...hero,packageTitle};
    assert.equal(resolveTorrentEpisode([{index:6,name:'Season 1/01.mkv'}],collection).index,6);
    assert.equal(resolveTorrentEpisode([{index:6,name:'Boku no Hero Academia S01E01.mkv'}],collection).index,6);
    assert.equal(resolveTorrentEpisode([{index:6,name:'Boku no Hero Academia - 01.mkv'}],collection).reason,'unmatched');
    assert.equal(resolveTorrentEpisode([{index:6,name:'Season 3/01.mkv'}],collection).reason,'unmatched');
  }
  assert.equal(resolveTorrentEpisode([{index:6,name:'Boku no Hero Academia S01-S06/Season 1/01.mkv'}],hero).index,6);
});

test('absolute episode numbers and source coordinates are never inferred from a season label',()=>{
  const third={...hero,season:3,title:'My Hero Academia 3rd Season'};
  assert.equal(resolveTorrentEpisode([{index:0,name:'Boku no Hero Academia - 39.mkv'}],third).reason,'unmatched');
  assert.equal(resolveTorrentEpisode([{index:0,name:'Boku no Hero Academia 3rd Season S01E01.mkv'}],third).reason,'unmatched');
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

test('manual choice never falls back to the torrent with the highest seed count',()=>{
  const sources=[source(999),source(80),source(null,'1080p','MP4')];
  const order=rankedSourceIndices(sources,'legendado','auto');assert.deepEqual(order,[2,0,1]);
  const chosen=1,attempted=new Set([chosen]);
  assert.equal(nextSourceIndex(order,attempted,false),undefined);
  assert.deepEqual([...attempted],[1]);
  assert.equal(nextSourceIndex(order,attempted,true),2);
});
test('quality preference is applied within direct video before considering torrent seeds',()=>{
  assert.deepEqual(rankedSourceIndices([source(1000,'1080p'),source(null,'720p','MP4'),source(null,'1080p','HLS')],'legendado','1080p'),[2,1,0]);
});


test('a correct package never renames another anime or overrides a conflicting episode',()=>{
  for(const name of ['Other Anime S01E01.mkv','Other Anime - 01.mkv']){
    assert.equal(resolveTorrentEpisode([{index:0,name}],{...hero,packageTitle:'Boku no Hero Academia'}).reason,'unmatched');
  }
  for(const packageTitle of ['Boku no Hero Academia S03E01','Boku no Hero Academia 3x01','Boku no Hero Academia Season 1 Season 3']){
    assert.equal(resolveTorrentEpisode([{index:0,name:'S01E01.mkv'}],{...hero,packageTitle}).reason,'unmatched');
  }
  assert.equal(resolveTorrentEpisode([{index:7,name:'Season 1/S01E01.mkv'}],{...hero,packageTitle:'Boku no Hero Academia'}).index,7);
  assert.equal(resolveTorrentEpisode([{index:7,name:'[Group] S01E01 - Izuku Midoriya Origin.mkv'}],{...hero,packageTitle:'Boku no Hero Academia'}).index,7);
});


test('a franchise prefix never identifies a spin-off as the original work',()=>{
  const vigilantes='[Judas] Boku no Hero Academia Illegals (My Hero Academia Vigilantes) (Season 01) [1080p][HEVC x265 10bit][Dual-Audio][Multi-Subs]v2 (Batch) - Batch idx=1';
  for(const name of ['Boku no Hero Academia Illegals S01E01.mkv','My Hero Academia Vigilantes - 01.mkv','Season 1/S01E01.mkv']){
    assert.equal(resolveTorrentEpisode([{index:0,name}],{...hero,packageTitle:vigilantes}).reason,'unmatched');
  }
  assert.equal(resolveTorrentEpisode([{index:0,name:'My Hero Academia Vigilantes S01E01.mkv'}],{...hero,packageTitle:'Boku no Hero Academia'}).reason,'unmatched');
  const original={...hero,packageTitle:'[Group] Boku no Hero Academia (2016) (Season 01) [1080p] [Batch]'};
  assert.equal(resolveTorrentEpisode([{index:3,name:'Season 1/S01E01.mkv'}],original).index,3);
});


test('a known spin-off conflict is rejected before requesting torrent metadata',()=>{
  assert.equal(torrentPackageConflicts('[Judas] Boku no Hero Academia Illegals (My Hero Academia Vigilantes) (Season 01) [1080p]',hero.title,hero.aliases),true);
  assert.equal(torrentPackageConflicts('[Group] Boku no Hero Academia (2016) (Season 1) [1080p]',hero.title,hero.aliases),false);
  assert.equal(torrentPackageConflicts('Servidor 1080p',hero.title,hero.aliases),false);
});


test('verified global episode coordinates identify a split cour without a redundant part label',()=>{
  const part={season:3,episode:13,title:'Attack on Titan Season 3 Part 2',aliases:['Shingeki no Kyojin Season 3 Part 2']};
  assert.equal(resolveTorrentEpisode([{index:8,name:'Shingeki no Kyojin S03E13.mkv'}],part).index,8);
  assert.equal(resolveTorrentEpisode([{index:8,name:'Shingeki no Kyojin Part 1 S03E13.mkv'}],part).reason,'unmatched');
});
