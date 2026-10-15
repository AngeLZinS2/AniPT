import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/profile.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
let id=0;
const module=()=>import(`data:text/javascript;base64,${Buffer.from(js+'\n//'+id++).toString('base64')}`);
test('first access remains pending for missing or corrupt profile; names are normalized locally',async()=>{
  const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const p=await module();assert.equal(p.localProfile(),null);values.set('anibr-local-profile','broken');assert.equal(p.localProfile(),null);
  assert.equal(p.saveLocalProfile('  Ange\u0000lo   Neri  '),true);assert.equal(p.localProfile().name,'Angelo Neri');
  const reloaded=await module();assert.equal(reloaded.localProfile().completed,true);assert.equal(reloaded.localProfile().name,'Angelo Neri');
});
test('anonymous completion persists without a generated identity',async()=>{
  const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const p=await module();p.saveLocalProfile('');const reloaded=await module();assert.equal(reloaded.localProfile().name,'');assert.equal(reloaded.localProfile().completed,true);assert.equal(values.size,1);
});
test('storage failure allows current session without falsely claiming persistence',async()=>{
  globalThis.localStorage={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('full')}};
  const p=await module();assert.equal(p.localProfile(),null);assert.equal(p.saveLocalProfile('Ana'),false);assert.equal(p.localProfile().name,'Ana');
});
