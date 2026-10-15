import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/welcome-reel-data.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {ribbonPoints}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('reveal polygons support vertical, horizontal and diagonal strips without invalid coordinates',()=>{
  for(const angle of [0,90,-28,67,5]){const points=ribbonPoints(400,300,800,600,angle,140).split(' ').map(point=>point.split(',').map(Number));assert.equal(points.length,4);assert.ok(points.flat().every(Number.isFinite));const [a,b,c,d]=points;assert.ok(Math.abs(Math.hypot(b[0]-c[0],b[1]-c[1])-140)<.02);assert.ok(Math.abs(a[0]+c[0]-800)<.02);assert.ok(Math.abs(a[1]+c[1]-600)<.02);assert.ok(Math.abs(b[0]+d[0]-800)<.02);}
  assert.equal(ribbonPoints(1,2,0,0,0,10),'0,0 0,0 0,0 0,0');
  assert.equal(ribbonPoints(NaN,2,800,600,0,10),'0,0 0,0 0,0 0,0');
});
test('inactive ribbons collapse completely and negative widths never invert the mask',()=>{
  for(const thickness of [0,-50]){const [a,b,c,d]=ribbonPoints(400,300,800,600,67,thickness).split(' ');assert.equal(a,d);assert.equal(b,c);}
});
