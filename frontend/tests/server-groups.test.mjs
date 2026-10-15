import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpile(fs.readFileSync(new URL('../src/server-groups.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {groupServers}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('groups audio without changing stream indexes or guessing unknown language',()=>{
  const streams=[{language:'Legendado'},{language:'Idioma não informado'},{language:'Dublado'},{language:'legendado'},{language:'Português'}];
  const groups=groupServers(streams);
  assert.deepEqual(groups.map(g=>[g.label,g.items.map(i=>i.index)]),[['Dublado',[2]],['Legendado',[0,3]],['Idioma não informado',[1,4]]]);
  assert.equal(groups[0].items[0].source,streams[2]);
});
test('does not create empty audio groups',()=>{
  assert.deepEqual(groupServers([]),[]);
  assert.deepEqual(groupServers([{language:'Legendado'}]).map(g=>g.label),['Legendado']);
});
