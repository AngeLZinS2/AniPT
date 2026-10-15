import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/episode-release.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {releasedLimit}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('26 planned episodes with next episode 3 never expose episode 15 or 26',()=>assert.equal(releasedLimit({status:'RELEASING',episodes:26,nextAiringEpisode:{episode:3,airingAt:200}},{episode:2,airingAt:90},100),2));
test('next airing bounds contradictory schedule results',()=>assert.equal(releasedLimit({status:'RELEASING',episodes:26,nextAiringEpisode:{episode:3,airingAt:200}},{episode:26,airingAt:90},100),2));
test('finished season can use confirmed final episode count',()=>assert.equal(releasedLimit({status:'FINISHED',episodes:25,nextAiringEpisode:null},null,100),25));
test('unreleased, unknown and future-only data never fabricate released episodes',()=>{
  for(const status of ['NOT_YET_RELEASED','RELEASING','HIATUS'])assert.equal(releasedLimit({status,episodes:26,nextAiringEpisode:null},null,100),0);
  assert.equal(releasedLimit({status:'RELEASING',episodes:26,nextAiringEpisode:null},{episode:4,airingAt:200},100),0);
});
