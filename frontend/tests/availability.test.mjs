import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/availability.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {checkAvailability}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('only confirmed media appears; missing and failed sources stay hidden',async()=>{
  const result=await checkAvailability([1,2,3,4],async ep=>{if(ep===3)throw Error('offline');return ep===2||ep===4},()=>{});
  assert.deepEqual(result,[2,4]);
});
test('checks are bounded and preserve catalog ordering',async()=>{
  let active=0,peak=0;
  const result=await checkAvailability([1,2,3,4,5],async ep=>{peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,6-ep));active--;return true},()=>{},()=>false,2);
  assert.equal(peak,2);assert.deepEqual(result,[1,2,3,4,5]);
});
test('navigation cancellation prevents updates and new work',async()=>{
  let cancelled=false,calls=0,updates=0;
  await checkAvailability([1,2,3],async()=>{calls++;cancelled=true;return true},()=>updates++,()=>cancelled,1);
  assert.equal(calls,1);assert.equal(updates,0);
});
