export function serverLanguageGroup(language:string):string {
  const value=language.trim().toLowerCase();
  if(['dublado','dubbed','dub'].includes(value))return 'Dublado';
  if(['legendado','subbed','sub'].includes(value))return 'Legendado';
  return 'Idioma não informado';
}

export function serverKind(source:{format?:string}):'torrent'|'direct'{
  return source.format?.trim().toLowerCase()==='torrent'?'torrent':'direct';
}
// Keep original indexes: grouping/filtering must not change playback identity
// or the independent automatic priority based on reported seeds.
export function groupServers<T extends {language:string;format?:string}>(streams:T[]) {
  const types=[{kind:'direct' as const,title:'Vídeo direto'},{kind:'torrent' as const,title:'Torrents'}];
  return types.flatMap(type=>['Dublado','Legendado','Idioma não informado'].map(language=>({
    kind:type.kind,label:`${type.title} · ${language}`,
    items:streams.map((source,index)=>({source,index})).filter(item=>serverKind(item.source)===type.kind&&serverLanguageGroup(item.source.language)===language)
  })).filter(group=>group.items.length));
}
