import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/images.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {imageFallback,imageCandidates}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
function mock(src){return {src,hidden:false,complete:false,naturalWidth:0,parentElement:{classList:{add(){},remove(){}}},getAttribute(){return this.src}}}
test('image candidates are real supplied URLs, deduplicated without invented sizes',()=>assert.deepEqual(imageCandidates(' a ','a',undefined,'','b'),['a','b']));
test('failed episode thumbnail falls back to banner and then cover',()=>{
  const img=mock('thumb-a');imageFallback(img,['thumb-a','banner-a','cover-a']);
  img.onerror();assert.equal(img.src,'banner-a');img.onerror();assert.equal(img.src,'cover-a');img.onerror();assert.equal(img.hidden,true);
});
test('carousel resets fallback to the new anime, not the previous cover',()=>{
  const img=mock('old-banner');imageFallback(img,['old-banner','old-cover']);imageFallback(img,['new-banner','new-cover']);
  assert.equal(img.src,'new-banner');img.onerror();assert.equal(img.src,'new-cover');
});
