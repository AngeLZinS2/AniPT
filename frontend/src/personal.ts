import type {Anime, ProgressEntry, PlaybackSettings} from './api';

export const listStatuses={planned:'Quero assistir',watching:'Assistindo',completed:'Concluído',paused:'Pausado',dropped:'Abandonado'} as const;
export type ListStatus=keyof typeof listStatuses;
export type ListEntry={anime:Anime;status:ListStatus;updatedAt:string;notify:boolean};
export type Synopsis={text:string;source:string;language:'pt-BR'};
export const animeKey=(anime:Pick<Anime,'id'|'provider'>)=>`${anime.provider||'multi'}:${anime.id}`;
export function readStored<T>(key:string,fallback:T):T {try{return JSON.parse(localStorage.getItem(key)||'null')??fallback}catch{return fallback}}
export const library=()=>readStored<Record<string,ListEntry>>('anibr-library',{});
export function setListStatus(anime:Anime,status:ListStatus|null){const entries=library(),key=animeKey(anime);if(status)entries[key]={anime:{...anime,resume:undefined},status,updatedAt:new Date().toISOString(),notify:entries[key]?.notify||false};else delete entries[key];localStorage.setItem('anibr-library',JSON.stringify(entries));}
export function setNotify(anime:Anime,notify:boolean){const entries=library(),key=animeKey(anime);if(!entries[key])setListStatus(anime,'watching');const next=library();next[key].notify=notify;localStorage.setItem('anibr-library',JSON.stringify(next));}
export const synopsisFor=(anime:Anime)=>readStored<Record<string,Synopsis>>('anibr-synopses',{})[animeKey(anime)];
export function saveSynopsis(anime:Anime,text:string,source:string){const entries=readStored<Record<string,Synopsis>>('anibr-synopses',{});if(text.trim())entries[animeKey(anime)]={text:text.trim(),source:source.trim()||'Tradução pessoal',language:'pt-BR'};else delete entries[animeKey(anime)];localStorage.setItem('anibr-synopses',JSON.stringify(entries));}
export function currentSeason(date=new Date()){return {year:date.getFullYear(),index:Math.floor(date.getMonth()/3)}}
export function shiftSeason(year:number,index:number,delta:number){const absolute=year*4+index+delta;return {year:Math.floor(absolute/4),index:((absolute%4)+4)%4}}
export function playbackSettings(value:Partial<PlaybackSettings>):PlaybackSettings{return {quality:value.quality||'auto',language:value.language||'legendado',auto_next:value.auto_next??true,history:value.history??true,density:value.density==='compact'?'compact':'comfortable',notifications:value.notifications??false,cache_quota_gb:Math.max(1,Math.min(256,Number(value.cache_quota_gb)||16))}}
export function publicSource(url:string){try{const parsed=new URL(url);return parsed.host}catch{return 'Fonte externa'}}
export function portableProvider(provider:string){
  if(!provider.startsWith('addon:'))return provider;
  const [base,kind]=provider.slice(6).split('|'),suffix=kind===undefined?'':`|${kind}`;
  try{const url=new URL(base);if(url.pathname!=='/'||url.search||url.hash||url.username||url.password)return `addon-private:${url.host}${suffix}`;return provider}catch{return 'multi'}
}
export function restoreProvider(provider:string,addons:string[]){
  if(!provider.startsWith('addon-private:'))return provider;
  const [host,kind]=provider.slice(14).split('|'),matches=addons.filter(url=>publicSource(url)===host);
  if(matches.length!==1)throw new Error(`Reinstale uma única configuração da fonte ${host} antes de importar este backup.`);
  return `addon:${matches[0]}${kind===undefined?'':`|${kind}`}`;
}
export const clock=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.floor(Math.max(0,seconds))%60).padStart(2,'0')}`;
export const genres:Record<string,string>={Action:'Ação',Adventure:'Aventura',Comedy:'Comédia',Drama:'Drama',Ecchi:'Ecchi',Fantasy:'Fantasia',Hentai:'Adulto',Horror:'Terror',MahouShoujo:'Garotas mágicas','Mahou Shoujo':'Garotas mágicas',Mecha:'Mecha',Music:'Música',Mystery:'Mistério',Psychological:'Psicológico',Romance:'Romance','Sci-Fi':'Ficção científica','Slice of Life':'Cotidiano',Sports:'Esportes',Supernatural:'Sobrenatural',Thriller:'Suspense'};
export const genreLabel=(value:string)=>genres[value]||value;
export function recommendationScore(candidate:Anime,entries:ListEntry[]){const seeds=entries.filter(e=>e.status==='watching'||e.status==='completed');return new Set(candidate.tags.filter(tag=>seeds.some(e=>e.anime.tags.includes(tag)))).size}

export type Backup={schema:'anibr-backup';version:1;exportedAt:string;favorites:Anime[];progress:ProgressEntry[];library:Record<string,ListEntry>;synopses:Record<string,Synopsis>};
export function mapBackupProviders(data:Backup,map:(provider:string)=>string):Backup{
  const key=(value:string)=>{const match=/^(addon:.*|addon-private:.*):((?:anilist|kitsu):.*)$/.exec(value);return match?`${map(match[1])}:${match[2]}`:value};
  const anime=(a:Anime)=>({...a,provider:map(a.provider||'multi'),resume:undefined});
  return {...data,favorites:data.favorites.map(anime),progress:data.progress.map(p=>({...p,provider:map(p.provider)})),library:Object.fromEntries(Object.values(data.library).map(e=>{const entry={...e,anime:anime(e.anime)};return [animeKey(entry.anime),entry]})),synopses:Object.fromEntries(Object.entries(data.synopses).map(([k,v])=>[key(k),v]))};
}
export function validateBackup(value:unknown):Backup{
  const data=value as Backup;
  if(!data||data.schema!=='anibr-backup'||data.version!==1||!Array.isArray(data.favorites)||!Array.isArray(data.progress)||!data.library||typeof data.library!=='object'||Array.isArray(data.library)||!data.synopses||typeof data.synopses!=='object'||Array.isArray(data.synopses))throw new Error('Arquivo de backup AniBR inválido ou de versão não suportada.');
  if(data.favorites.length>10000||data.progress.length>100000||Object.keys(data.library).length>10000)throw new Error('O backup excede o limite de itens.');
  const validAnime=(a:Anime)=>a&&typeof a.id==='string'&&a.id.length>0&&typeof a.title==='string'&&typeof a.provider==='string'&&typeof a.description==='string'&&typeof a.subtitle==='string'&&typeof a.color==='string'&&/^#[0-9a-f]{6}$/i.test(a.color)&&Number.isFinite(a.year)&&Number.isFinite(a.rating)&&Number.isFinite(a.episodes)&&Array.isArray(a.tags)&&a.tags.every(t=>typeof t==='string');
  if(data.favorites.some(a=>!validAnime(a))||Object.entries(data.library).some(([key,e])=>!e||!validAnime(e.anime)||key!==animeKey(e.anime)||!Object.hasOwn(listStatuses,e.status)||typeof e.notify!=='boolean'||!Number.isFinite(Date.parse(e.updatedAt)))||data.progress.some(p=>!p||typeof p.anime_id!=='string'||typeof p.anime_title!=='string'||typeof p.provider!=='string'||typeof p.language!=='string'||typeof p.quality!=='string'||!Number.isInteger(p.season)||p.season<1||!Number.isFinite(p.episode)||p.episode<=0||!Number.isInteger(p.timestamp)||p.timestamp<0||(p.duration!==undefined&&(!Number.isInteger(p.duration)||p.duration<0))||typeof p.completed!=='boolean'))throw new Error('O backup contém itens ou progresso inválidos.');
  if(Object.values(data.synopses).some(s=>!s||typeof s.text!=='string'||typeof s.source!=='string'||s.language!=='pt-BR'))throw new Error('Sinopses inválidas no backup.');
  return data;
}
