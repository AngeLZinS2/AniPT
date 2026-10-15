export function serverLanguageGroup(language:string):string {
  const value=language.trim().toLowerCase();
  if(['dublado','dubbed','dub'].includes(value))return 'Dublado';
  if(['legendado','subbed','sub'].includes(value))return 'Legendado';
  return 'Idioma não informado';
}

// Keep original indexes: grouping must not change playback/resume identity.
export function groupServers<T extends {language:string}>(streams:T[]) {
  return ['Dublado','Legendado','Idioma não informado'].map(label=>({
    label,items:streams.map((source,index)=>({source,index})).filter(item=>serverLanguageGroup(item.source.language)===label)
  })).filter(group=>group.items.length);
}
