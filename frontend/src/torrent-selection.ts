import {preferredQualityIndex,resolutionFromLabel} from './quality';
import {serverKind} from './server-groups';

type TorrentFile={index:number;name:string;bytes?:number};
type Source={format:string;quality:string;language:string;title?:string;source?:string;seeders?:number|null};
type Target={season:number;episode:number;title:string;aliases?:string[];packageTitle?:string};
const normalized=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();

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
  const aliases=[target.title,...target.aliases||[]].map(normalized).filter(title=>title.length>=3);
  const scores=files.flatMap(file=>{
    if(!/\.(mkv|mp4|m4v|webm|avi|mov|ts)$/i.test(file.name))return [];
    const path=file.name.replace(/\\/g,'/'),base=path.split('/').at(-1)!.replace(/\.[^.]+$/,'');
    if(/\b(sample|ncop|nced|trailer|ova|oad|movies?|specials|extras)\b/i.test(path))return [];
    if(/\b\d{1,4}\s*(?:~|-\s*(?:e|ep)?\s*)\s*\d{1,4}\b/i.test(base))return [];
    if(normalized(path).includes('final season')&&!aliases.some(alias=>alias.includes('final season')))return [];
    const seasons=[...path.matchAll(/\b(?:season|temporada|s|t)[\s._-]*0*(\d{1,3})\b/gi)].map(match=>Number(match[1]));
    if(seasons.some(season=>season!==target.season))return [];
    const explicit=[...path.matchAll(/(?:^|[^a-z0-9])(?:s|t)0*(\d{1,3})[\s._-]*(?:e|ep)0*(\d{1,4})(?=$|[^0-9])|(?:^|[^a-z0-9])(\d{1,3})x0*(\d{1,4})(?=$|[^0-9])/gi)]
      .map(match=>({season:Number(match[1]||match[3]),episode:Number(match[2]||match[4])}));
    if(explicit.length)return explicit.every(value=>value.season===target.season&&value.episode===target.episode)?[{index:file.index,score:3}]:[];
    const bare=base.match(/(?:^|\s-\s*)(?:episode|episódio|ep|e)[ ._-]*0*(\d{1,4})(?=$|[ ._\-[(])/i)
      ||base.match(/\s-\s*0*(\d{1,4})(?=$|[ ._\-[(])/)
      ||base.match(/^0*(\d{1,4})(?=$|[ ._\-[(])/);
    if(!bare||Number(bare[1])!==target.episode)return [];
    const aliasInPath=aliases.some(alias=>(' '+normalized(path)+' ').includes(' '+alias+' '));
    const packageName=normalized(target.packageTitle||'');
    const packageHasAlias=aliases.some(alias=>(' '+packageName+' ').includes(' '+alias+' '));
    const collection=/\bs0*\d+\s*[-+]\s*s?\d+|complete collection/i.test(target.packageTitle||'');
    if(collection&&!seasons.length)return [];
    const packagePart=[...(target.packageTitle||'').matchAll(/\b(?:season|temporada)[\s._-]*0*(\d+)\b/gi)].map(match=>Number(match[1]));
    const partConfirmed=seasons.length>0||(!collection&&packagePart.length>0&&packagePart.every(season=>season===target.season));
    if(!partConfirmed&&target.season!==1)return [];
    if(!aliasInPath&&!packageHasAlias&&!seasons.length)return [];
    return [{index:file.index,score:partConfirmed?2:1}];
  }).sort((a,b)=>b.score-a.score);
  if(!scores.length)return {reason:'unmatched'};
  if(scores.length>1&&scores[0].score===scores[1].score)return {reason:'ambiguous'};
  return {index:scores[0].index,reason:'matched'};
}

export function nextSourceIndex(order:number[],attempted:Set<number>,automatic=true):number|undefined{return automatic?order.find(index=>!attempted.has(index)):undefined;}
