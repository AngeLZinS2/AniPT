import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
async function load(name){const source=await readFile(new URL(`../src/${name}.ts`,import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)}
const q=await load('quality'),p=await load('playback');
test('detects real source labels for 2160p, 4K, UHD and widescreen 4K',()=>{for(const label of ['4K HEVC','2160p','UHD','3840x1600'])assert.equal(q.resolutionFromLabel(label),2160);assert.equal(q.resolutionFromLabel('Servidor FHD sem resolução'),0)});
test('4K preference selects offered 2160p and preserves order for ties',()=>{assert.equal(q.preferredQualityIndex([720,2160,1080,2160],'4K'),1)});
test('unavailable 4K uses highest offered lower quality, never inventing a variant',()=>{assert.equal(q.preferredQualityIndex([720,1080,480],'2160p'),1);assert.equal(q.preferredQualityIndex([0,0],'2160p'),-1)});
test('automatic leaves adaptive selection enabled',()=>{assert.equal(q.preferredQualityIndex([720,2160],'auto'),-1);assert.equal(q.normalizeQuality('Automática'),'auto');assert.equal(q.normalizeQuality('best'),'auto')});
test('requested 720p chooses exact quality even if 4K exists',()=>assert.equal(q.preferredQualityIndex([2160,720,1080],'720p'),1));
test('torrent identity distinguishes hashes and episode files but ignores tracker renewal',()=>{
  const source={source:'Torrent A',quality:'1080p',url:'magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&tr=https://tracker.one',torrent_file_index:0};
  assert.equal(p.serverKey(source),p.serverKey({...source,url:'magnet:?xt=urn:btih:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&tr=https://tracker.two'}));
  assert.notEqual(p.serverKey(source),p.serverKey({...source,torrent_file_index:1}));
  assert.notEqual(p.serverKey(source),p.serverKey({...source,url:'magnet:?xt=urn:btih:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'}));
});
test('progress reflects actual episode duration, is bounded and unknown is not fabricated',()=>{assert.equal(p.progressPercent(300,1200),25);assert.equal(p.progressPercent(1300,1200),100);assert.equal(p.progressPercent(-2,1200),0);assert.equal(p.progressPercent(300,0),undefined);assert.equal(p.progressPercent(300,Infinity),undefined);assert.equal(p.progressPercent(1200,1200,true),100)});
test('server identity survives signed URL and description renewal without storing credentials',()=>{const source={source:'Fonte A',quality:'2160p',url:'https://video.example/episode.mp4?token=old'};assert.equal(p.serverKey(source),p.serverKey({...source,quality:'4K source updated',url:'https://video.example/episode.mp4?token=new'}));assert.notEqual(p.serverKey(source),p.serverKey({...source,source:'Fonte B'}))});
