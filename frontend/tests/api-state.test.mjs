import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const result=await build({absWorkingDir:fileURLToPath(new URL('..',import.meta.url)),entryPoints:['src/api.ts'],bundle:true,platform:'node',format:'esm',write:false});
globalThis.window={};
const {api}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
function storage(){const object={getItem:key=>object[key]??null,setItem:(key,value)=>object[key]=String(value),removeItem:key=>delete object[key]};globalThis.localStorage=object;return object}
const anime={id:'anilist:20',title:'Naruto',subtitle:'Naruto',description:'Original.',color:'#8955ff',year:2002,rating:8,episodes:220,tags:['Action'],provider:'addon:https://anime-kitsu.strem.fun|anime'};
const progress={anime_id:anime.id,anime_title:anime.title,provider:anime.provider,season:1,episode:16,episode_title:'Episódio 16',language:'Legendado',quality:'1080p',timestamp:300,duration:1200,completed:false};
test('API persists false preferences, merges quota and normalizes legacy labels',async()=>{storage();await api.saveSettings({quality:'4K',language:'Dublado',history:false,auto_next:false});await api.saveSettings({cache_quota_gb:20});const settings=await api.getSettings();assert.equal(settings.history,false);assert.equal(settings.auto_next,false);assert.equal(settings.cache_quota_gb,20);assert.equal(settings.quality,'2160p');assert.equal(settings.language,'dublado')});
test('disabled automatic history records nothing while explicit edits remain possible',async()=>{storage();await api.saveSettings({history:false});await api.saveProgress(progress);assert.equal((await api.allProgress()).length,0);await api.importProgress([progress]);assert.equal((await api.allProgress())[0].episode,16);await api.removeProgress(anime,1,16);assert.equal((await api.allProgress()).length,0)});
test('browser favorites actually add and remove persisted entries',async()=>{storage();await api.toggleFavorite(anime);assert.equal((await api.favorites()).length,1);assert.equal(anime.favorite,true);await api.toggleFavorite(anime);assert.equal((await api.favorites()).length,0);assert.equal(anime.favorite,false)});
test('browser backup restores original data if a storage write fails midway',async()=>{const data=storage();await api.saveSettings({history:true});await api.putFavorite(anime);const previous=data['anipt-favorites'],original=data.setItem;let failed=false;data.setItem=(key,value)=>{if(key.endsWith(':1:17')&&!failed){failed=true;throw new Error('Simulated quota')}return original(key,value)};await assert.rejects(api.importUserData([],[progress,{...progress,episode:17}]),/Simulated quota/);assert.equal(data['anipt-favorites'],previous);assert.equal((await api.allProgress()).length,0)});


test('stream cache cannot bypass coordinate validation or reuse another local season',async()=>{
  const calls=[],previous=globalThis.window;
  globalThis.window={__TAURI_INTERNALS__:{invoke:async(command,args)=>{
    if(command==='list_addons')return ['https://source.example.test'];
    assert.equal(command,'get_streams');calls.push(args);
    if(args.season!==1||args.episodeNumber!==1)throw new Error('Episode coordinates conflict');
    return {streams:[],sources:[]};
  }}};
  try{
    const current={...anime,id:'anilist:21459',title:'My Hero Academia'};
    const episode={id:'kitsu:11469:1',anime_id:current.id,season:1,number:1,title:'Origin',duration:0,thumbnail:''};
    await api.streamReport(current,episode);await api.streamReport(current,episode);
    assert.equal(calls.length,1);assert.equal(calls[0].episodeId,'kitsu:11469:1');
    assert.equal(calls[0].season,1);assert.equal(calls[0].episodeNumber,1);
    await assert.rejects(api.streamReport(current,{...episode,number:3}),/coordinates conflict/);
    await assert.rejects(api.streamReport(current,{...episode,season:2}),/coordinates conflict/);
    assert.equal(calls.length,3);
  }finally{globalThis.window=previous;}
});
