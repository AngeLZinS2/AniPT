import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/torrent-selection.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {automaticTorrentFileIndex}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('uncertain Nyaa batch never autoplays addon index zero, saved selection or single file',()=>{
  const source={torrent_file_index:0,requires_file_selection:true};
  assert.equal(automaticTorrentFileIndex([{index:0},{index:1}],source,1),undefined);
  assert.equal(automaticTorrentFileIndex([{index:0}],source,0),undefined);
});
test('confirmed sources retain addon selection, valid saved choice and single-file behavior',()=>{
  const files=[{index:2},{index:5}];
  assert.equal(automaticTorrentFileIndex(files,{torrent_file_index:5},2),5);
  assert.equal(automaticTorrentFileIndex(files,{},2),2);
  assert.equal(automaticTorrentFileIndex([{index:4}],{},null),4);
  assert.equal(automaticTorrentFileIndex(files,{torrent_file_index:0},null),undefined);
});
