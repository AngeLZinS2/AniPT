import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code=ts.transpile(fs.readFileSync(new URL('../src/server-groups.ts',import.meta.url),'utf8'),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022});
const {groupServers,serverKind}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('groups audio without changing stream indexes or guessing unknown language',()=>{
  const streams=[{language:'Legendado'},{language:'Idioma não informado'},{language:'Dublado'},{language:'legendado'},{language:'Português'}];
  const groups=groupServers(streams);
  assert.deepEqual(groups.map(g=>[g.label,g.items.map(i=>i.index)]),[['Vídeo direto · Dublado',[2]],['Vídeo direto · Legendado',[0,3]],['Vídeo direto · Idioma não informado',[1,4]]]);
  assert.equal(groups[0].items[0].source,streams[2]);
});
test('does not create empty audio groups',()=>{
  assert.deepEqual(groupServers([]),[]);
  assert.deepEqual(groupServers([{language:'Legendado'}]).map(g=>g.label),['Vídeo direto · Legendado']);
});
test('separates torrents from MP4 and HLS while preserving original source indexes',()=>{
  const streams=[{language:'Legendado',format:'HLS'},{language:'Legendado',format:'Torrent'},{language:'Dublado',format:'MP4'},{language:'Legendado',format:'Torrent'}];
  assert.deepEqual(groupServers(streams).map(g=>[g.kind,g.label,g.items.map(i=>i.index)]),[
    ['direct','Vídeo direto · Dublado',[2]],['direct','Vídeo direto · Legendado',[0]],['torrent','Torrents · Legendado',[1,3]]
  ]);
  assert.equal(groupServers(streams)[0].items[0].source,streams[2]);
});
test('type comes from the actual media format, not a provider or title containing torrent',()=>{
  assert.equal(serverKind({format:' Torrent '}),'torrent');
  assert.equal(serverKind({format:'Vídeo direto',title:'Torrent release',source:'Torrentio'}),'direct');
  assert.equal(serverKind({format:'HLS'}),'direct');
});
