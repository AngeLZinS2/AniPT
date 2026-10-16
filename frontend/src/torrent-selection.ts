import {preferredQualityIndex,resolutionFromLabel} from './quality';
import {serverKind} from './server-groups';

type TorrentFile={index:number;name:string;bytes?:number};
type Source={format:string;quality:string;language:string;title?:string;source?:string;seeders?:number|null};
type Target={season:number;episode:number;title:string;aliases?:string[];packageTitle?:string};
const normalized=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

type PartMarker={kind:'season'|'part';number:number};
const markerText=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[._]/g,' ');
const markerNumber=(value:string):number=>{
  if(/^\d+$/.test(value))return Number(value);
  if(!/^(?=[ivxlcdm]+$)m{0,3}(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/.test(value))return 0;
  const digits:Record<string,number>={i:1,v:5,x:10,l:50,c:100,d:500,m:1000};
  return [...value].reduce((total,char,index)=>total+(digits[char]<(digits[value[index+1]]||0)?-digits[char]:digits[char]),0);
};
function partContext(value:string):{markers:PartMarker[];collection:boolean;withoutParts:string}{
  let text=markerText(value),collection=/\b(?:complete collection|all seasons|todas as temporadas)\b/.test(text);
  // A collection's range describes its contents, not the selected file's season.
  text=text.replace(/\b(?:(?:seasons?|temporadas?)\s*0*\d+\s*[-+~&]\s*(?:(?:seasons?|temporadas?)\s*)?0*\d+|[st]\s*0*\d+\s*[-+~&]\s*(?:[st]\s*)?0*\d+)\b/g,()=>{collection=true;return ' ';});
  const markers:PartMarker[]=[];
  const add=(kind:string,number:string)=>{const parsed=markerNumber(number);if(parsed>0)markers.push({kind:/^(?:part|parte)$/.test(kind)?'part':'season',number:parsed});return ' ';};
  let withoutParts=text.replace(/\b(\d{1,3})(?:st|nd|rd|th|a|o)[\s-]*(season|temporada|part|parte)\b/g,(_match,number,kind)=>add(kind,number));
  withoutParts=withoutParts.replace(/\b([ivxlcdm]+)[\s-]+(season|temporada|part|parte)\b/g,(_match,number,kind)=>add(kind,number));
  withoutParts=withoutParts.replace(/\b(season|temporada|part|parte)[\s-]*(\d{1,3}|[ivxlcdm]+)\b/g,(_match,kind,number)=>add(kind,number));
  withoutParts=withoutParts.replace(/\b[st][\s-]*0*(\d{1,3})\b/g,(_match,number)=>add('season',number));
  return {markers,collection,withoutParts};
}

function matchesWorkTitle(value:string,aliases:string[]):boolean{return [value,...value.replace(/\\/g,'/').split('/')].some(segment=>{
    const clean=partContext(segment.split(/\r?\n/)[0].replace(/\[[^\]]*\]|\([^)]*\)/g,' ').replace(/\.[a-z0-9]{2,4}$/i,'')).withoutParts;
    const title=clean.split(/\b[st]0*\d+[\s-]*(?:e|ep)0*\d+|\b\d+x0*\d+|\s-\s*\d+|\b(?:\d{3,4}p|hevc|avc|x26[45]|dual[ -]audio|multi[ -]subs?|batch|complete collection|all seasons)\b/i)[0];
    const name=normalized(title).replace(/\s(?:19|20)\d{2}$/,'');
    return aliases.includes(name);
  })}

export function torrentPackageConflicts(packageTitle:string,title:string,otherAliases:string[]=[]):boolean{
  const aliases=[title,...otherAliases].flatMap(value=>[normalized(value),normalized(partContext(value).withoutParts)]).filter(value=>value.length>=3);
  const label=' '+normalized(packageTitle)+' ';
  // A known franchise name followed by a different story title is evidence of
  // a different work. Generic addon labels still wait for real file metadata.
  return aliases.some(alias=>label.includes(' '+alias+' '))&&!matchesWorkTitle(packageTitle,aliases);
}

export function streamDisplayTitle(source:Pick<Source,'title'|'quality'>,fallback:string):string{
  const line=(source.title||source.quality).split(/\r?\n/).find(line=>line.trim())||fallback;
  if(/^(?:best|auto|original|\d{3,4}p)$/i.test(line.trim()))return fallback;
  return line.replace(/https?:\/\/\S+/gi,'').replace(/^[^\p{L}\p{N}\[]+/u,'').trim()||fallback;
}

// Counts are reported by the addon. Unknown is not treated as a live peer check.
export function rankedSourceIndices(sources:Source[],language:string,quality:string):number[]{
  const eligible=sources.map((source,index)=>({source,index})).filter(({source})=>{
    const audio=source.language.toLowerCase();
    return audio===language||!['dublado','legendado'].includes(audio);
  });
  const pool=eligible.length?eligible:sources.map((source,index)=>({source,index}));
  const preferredByType=new Map<string,number|undefined>();
  for(const kind of ['direct','torrent']){const subset=pool.filter(({source})=>serverKind(source)===kind);const preferred=preferredQualityIndex(subset.map(({source})=>resolutionFromLabel(source.quality)),quality);preferredByType.set(kind,subset[preferred]?.index);}
  return [...pool].sort((a,b)=>{
    const kindA=serverKind(a.source),kindB=serverKind(b.source);
    if(kindA!==kindB)return kindA==='direct'?-1:1;
    const prefIndex=preferredByType.get(kindA);
    const seedA=kindA==='torrent'&&Number.isFinite(a.source.seeders)&&Number(a.source.seeders)>0?Number(a.source.seeders):-1;
    const seedB=kindB==='torrent'&&Number.isFinite(b.source.seeders)&&Number(b.source.seeders)>0?Number(b.source.seeders):-1;
    if(seedA!==seedB)return seedB-seedA;
    if(a.index===b.index)return 0;
    if(a.index===prefIndex)return -1;if(b.index===prefIndex)return 1;
    return a.index-b.index;
  }).map(({index})=>index);
}

// Only the actual metadata paths identify the file. An addon's fileIdx, saved
// index or position in the package never overrides a conflicting SxxExx.
export function resolveTorrentEpisode(files:TorrentFile[],target:Target):{index?:number;reason:'matched'|'ambiguous'|'unmatched'}{
  const titles=[target.title,...target.aliases||[]];
  const requestedParts=titles.flatMap(title=>partContext(title).markers);
  const expected=(kind:PartMarker['kind'])=>[...new Set(requestedParts.filter(marker=>marker.kind===kind).map(marker=>marker.number))];
  const expectedSeasons=expected('season'),expectedParts=expected('part');
  // Part ordinals belong to the selected anime. SxxExx remains in the source's
  // coordinates: a Kitsu "3rd Season" can legitimately contain local S01E01.
  if(expectedSeasons.length>1||expectedParts.length>1)return {reason:'unmatched'};
  const expectedSeason=expectedSeasons[0]??target.season,expectedPart=expectedParts[0]??1;
  const aliases=[...new Set(titles.flatMap(title=>[normalized(title),normalized(partContext(title).withoutParts)]).filter(title=>title.length>=3))];
  const matchesTitle=(value:string)=>matchesWorkTitle(value,aliases);
  const packageContext=partContext(target.packageTitle||'');
  const markerConflicts=(marker:PartMarker)=>marker.number!==(marker.kind==='season'?expectedSeason:expectedPart);
  if(packageContext.markers.some(marker=>markerConflicts(marker)&&!(packageContext.collection&&marker.kind==='season')))return {reason:'unmatched'};
  const explicitCoordinates=(value:string)=>[...value.matchAll(/(?:^|[^a-z0-9])(?:s|t)0*(\d{1,3})[\s._-]*(?:e|ep)0*(\d{1,4})(?=$|[^0-9])|(?:^|[^a-z0-9])(\d{1,3})x0*(\d{1,4})(?=$|[^0-9])/gi)]
    .map(match=>({season:Number(match[1]||match[3]),episode:Number(match[2]||match[4])}));
  if(!packageContext.collection&&explicitCoordinates(target.packageTitle||'').some(value=>value.season!==target.season||value.episode!==target.episode))return {reason:'unmatched'};
  // A package name may identify a generic file, but cannot rename a file that
  // explicitly names another work before its episode coordinates.
  const namesOtherWork=(base:string)=>{
    const clean=markerText(base).replace(/\[[^\]]*\]|\([^)]*\)/g,' ').trim();
    const episode=clean.search(/(?:^|[^a-z0-9])(?:[st]0*\d+[\s-]*(?:e|ep)0*\d+|\d+x0*\d+)|\s-\s*\d+|^\d+(?=$|[\s-])/i);
    if(episode<0)return false;
    const prefix=partContext(clean.slice(0,episode)).withoutParts;
    const name=normalized(prefix);
    return !!name&&!matchesTitle(prefix)&&! /^(?:episode|episodio|ep|e|video)$/.test(name);
  };
  const scores=files.flatMap(file=>{
    if(!/\.(mkv|mp4|m4v|webm|avi|mov|ts)$/i.test(file.name))return [];
    const path=file.name.replace(/\\/g,'/'),base=path.split('/').at(-1)!.replace(/\.[^.]+$/,'');
    if(/\b(sample|ncop|nced|trailer|ova|oad|movies?|specials|extras)\b/i.test(path))return [];
    if(/\b\d{1,4}\s*(?:~|-\s*(?:e|ep)?\s*)\s*\d{1,4}\b/i.test(base))return [];
    if(normalized(path+' '+(target.packageTitle||'')).includes('final season')&&!aliases.some(alias=>alias.includes('final season')))return [];
    const pathContexts=path.split('/').map(partContext);
    const pathMarkers=pathContexts.flatMap(context=>context.markers.filter(marker=>!context.collection||marker.kind!=='season'));
    if(pathMarkers.some(markerConflicts))return [];
    if(!matchesTitle(path)&&!matchesTitle(target.packageTitle||''))return [];
    if(namesOtherWork(base))return [];
    const explicit=explicitCoordinates(path);
    if(explicit.some(value=>value.season!==target.season||value.episode!==target.episode))return [];
    const pathSeason=pathMarkers.some(marker=>marker.kind==='season')||(explicit.length>0&&expectedSeason===target.season);
    const collection=packageContext.collection||pathContexts.some(context=>context.collection);
    if(collection&&!pathSeason)return [];
    const confirmedMarkers=[...pathMarkers,...packageContext.markers.filter(marker=>!packageContext.collection||marker.kind!=='season')];
    const seasonConfirmed=pathSeason||confirmedMarkers.some(marker=>marker.kind==='season');
    if(expectedSeasons.length&&expectedSeason!==target.season&&!seasonConfirmed)return [];
    if(expectedParts.length&&!confirmedMarkers.some(marker=>marker.kind==='part')&&!(explicit.length&&expectedSeason===target.season))return [];
    if(explicit.length)return [{index:file.index,score:3}];
    const bare=base.match(/(?:^|\s-\s*)(?:episode|episódio|ep|e)[ ._-]*0*(\d{1,4})(?=$|[ ._\-[(])/i)
      ||base.match(/\s-\s*0*(\d{1,4})(?=$|[ ._\-[(])/)
      ||base.match(/^0*(\d{1,4})(?=$|[ ._\-[(])/);
    if(!bare||Number(bare[1])!==target.episode)return [];
    if(!seasonConfirmed&&target.season!==1)return [];
    return [{index:file.index,score:seasonConfirmed?2:1}];
  }).sort((a,b)=>b.score-a.score);
  if(!scores.length)return {reason:'unmatched'};
  if(scores.length>1&&scores[0].score===scores[1].score)return {reason:'ambiguous'};
  return {index:scores[0].index,reason:'matched'};
}

export function nextSourceIndex(order:number[],attempted:Set<number>,automatic=true):number|undefined{return automatic?order.find(index=>!attempted.has(index)):undefined;}
