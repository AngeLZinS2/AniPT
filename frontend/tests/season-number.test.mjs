import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/season-number.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {explicitSeasonNumber,numberSeasonFamily,displaySeasonNumber}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('Black Clover sequel displays season two while keeping source episode identity intact',()=>{
  const episode={id:'kitsu:50024:1',season:1,number:1};
  const before={...episode};
  assert.equal(displaySeasonNumber({title:'Black Clover Season 2'},episode.season),2);
  assert.deepEqual(episode,before);
});
test('season title variants support Portuguese and English without treating years or part numbers as seasons',()=>{
  for(const title of ['Anime 2nd Season','Anime Season 2','Anime 2ª Temporada','Anime Temporada 02'])assert.equal(explicitSeasonNumber(title),2,title);
  assert.equal(explicitSeasonNumber('Anime 2026'),undefined);
  assert.equal(explicitSeasonNumber('Anime Part 2'),undefined);
});
test('named sequels use ordered catalog family and do not overwrite earlier objects',()=>{
  const parts=[{id:'1',title:'Example'},{id:'2',title:'Example: New story'}];
  const numbered=numberSeasonFamily(parts);
  assert.deepEqual(numbered.map(part=>displaySeasonNumber(part)),[1,2]);
  assert.equal(parts[1].seasonNumber,undefined);
});
test('split parts retain the identified season instead of incrementing it again',()=>{
  const parts=numberSeasonFamily([{id:'1',title:'Anime'},{id:'2',title:'Anime Season 2'},{id:'3',title:'Anime Season 2 Part 2'},{id:'4',title:'Anime Season 3'}]);
  assert.deepEqual(parts.map(part=>part.seasonNumber),[1,2,2,3]);
});
test('explicit catalog season takes precedence over subset position and source fallback',()=>{
  const [part]=numberSeasonFamily([{id:'3',title:'Anime 3rd Season'}]);
  assert.equal(displaySeasonNumber(part,1),3);
  assert.equal(displaySeasonNumber({title:'Unnumbered original'},1),1);
});
