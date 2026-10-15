type Part={id:string;title:string;subtitle?:string;seasonNumber?:number};

export function explicitSeasonNumber(...titles:(string|undefined)[]):number|undefined {
  for(const title of titles){
    const text=title?.normalize('NFKC').toLocaleLowerCase('pt-BR')||'';
    const match=/\b(?:season|temporada)\s*(\d+)\b/.exec(text)||/\b(\d+)(?:st|nd|rd|th|a|o|ª|º)?\s*(?:season|temporada)\b/.exec(text);
    if(match){const number=Number(match[1]);if(Number.isSafeInteger(number)&&number>0)return number;}
  }
}

/** The catalog's ordered parts supply presentation numbers. Source season IDs
 * remain untouched: Kitsu may call the sequel's first episode season 1. */
export function numberSeasonFamily<T extends Part>(parts:T[]):T[]{
  let previous=0;
  return parts.map(part=>{
    const explicit=explicitSeasonNumber(part.title,part.subtitle);
    const continuation=/\b(?:part|parte|cour)\s*(?:\d+|ii|iii|iv)\b/i.test(`${part.title} ${part.subtitle||''}`);
    const seasonNumber=explicit??(continuation&&previous>0?previous:previous+1);
    previous=seasonNumber;
    return {...part,seasonNumber};
  });
}

export function displaySeasonNumber(anime:Pick<Part,'title'|'subtitle'|'seasonNumber'>,sourceSeason=1):number {
  return anime.seasonNumber??explicitSeasonNumber(anime.title,anime.subtitle)??sourceSeason;
}
