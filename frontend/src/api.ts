import {invoke as tauriInvoke} from '@tauri-apps/api/core';
import {catalogQuery, optionsQuery, mediaFields, type CatalogFilters, type CatalogOptions} from './catalog';
import {progressPercent} from './playback';
import {releasedLimit,type ReleaseInfo} from './episode-release';
import {playbackSettings,readStored} from './personal';
import {normalizeQuality} from './quality';
import {translationSegments,translatedSegment} from './translation';
import {explicitSeasonNumber,numberSeasonFamily} from './season-number';
import {confirmedSchedules,type Schedule} from './release-feed';

export type Anime = {id:string;title:string;subtitle:string;description:string;year:number;rating:number;episodes:number;watched?:number;progress?:number;favorite?:boolean;color:string;tags:string[];provider?:string;coverUrl?:string;bannerUrl?:string;latestEpisode?:number;airedAt?:number;confirmedRelease?:boolean;resume?:ProgressEntry;status?:string;seasonNumber?:number;trailer?:{id:string;site:string;thumbnail?:string}|null};
type BackendAnime={id:string;title:string;title_ptbr?:string;cover_url?:string;banner_url?:string;synopsis?:string;genres?:string[];year?:number;total_episodes?:number;provider?:string;available_languages?:string[];latest_episode?:number;aired_at?:number;confirmed_release?:boolean;rating?:number;status?:string;trailer?:{id:string;site:string;thumbnail?:string}|null};
export type Episode={id:string;anime_id:string;season:number;number:number;title:string;duration:number;thumbnail:string};
export type StreamSource={url:string;quality:string;language:string;format:string;is_hls:boolean;source:string;torrent_file_index?:number|null;requires_file_selection?:boolean;title?:string;seeders?:number|null;episode_target?:{season:number;episode:number}|null};
export type StreamResolution={streams:StreamSource[];sources:{source:string;status:string}[]};
export type PlaybackSettings={quality:string;language:string;auto_next:boolean;history:boolean;density:'comfortable'|'compact';notifications:boolean;cache_quota_gb:number};
export type ProgressEntry={id?:number;anime_id:string;anime_title:string;provider:string;season:number;episode:number;episode_title:string;language:string;quality:string;watched_at?:string;timestamp:number;completed:boolean;duration?:number;episode_id?:string;stream_key?:string;cover_url?:string;banner_url?:string};
declare global {interface Window{__TAURI_INTERNALS__?:unknown}}
type Media={id:number;title:{english?:string;romaji?:string};seasonYear?:number;averageScore?:number;episodes?:number;description?:string;genres?:string[];coverImage?:{extraLarge?:string;large?:string};bannerImage?:string;status?:string;isAdult?:boolean;trailer?:{id:string;site:string;thumbnail?:string}|null};
const isDesktop=()=>!!window.__TAURI_INTERNALS__;
const invoke=<T>(command:string,args:Record<string,unknown>={})=>tauriInvoke<T>(command,args);
const normalize=(a:BackendAnime):Anime=>({id:a.id,title:a.title_ptbr||a.title,subtitle:a.title,description:a.synopsis||'Sinopse ainda não disponível.',year:a.year||0,rating:a.rating||0,episodes:a.total_episodes||0,color:'#8955ff',tags:[...(a.genres||[]),...(a.available_languages||[])],seasonNumber:explicitSeasonNumber(a.title_ptbr,a.title),provider:a.provider||'multi',coverUrl:a.cover_url,bannerUrl:a.banner_url,latestEpisode:a.latest_episode,airedAt:a.aired_at,confirmedRelease:a.confirmed_release,status:a.status});
const fromMedia=(m:Media):Anime=>({...normalize({id:`anilist:${m.id}`,title:m.title.english||m.title.romaji||'Título não informado',synopsis:(m.description||'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&'),year:m.seasonYear,rating:(m.averageScore||0)/10,total_episodes:m.episodes,genres:m.genres,cover_url:m.coverImage?.extraLarge||m.coverImage?.large,banner_url:m.bannerImage,provider:'addon:https://anime-kitsu.strem.fun|anime'}),subtitle:m.title.romaji||m.title.english||'',status:m.status,trailer:m.trailer});
const cache=new Map<string,{expires:number;value:unknown}>(),pending=new Map<string,Promise<unknown>>();
async function cached<T>(key:string,fetcher:()=>Promise<T>,ttl=300000):Promise<T>{
  const item=cache.get(key);if(item&&item.expires>Date.now())return item.value as T;
  const inflight=pending.get(key);if(inflight)return inflight as Promise<T>;
  const promise=fetcher().then(value=>{cache.set(key,{value,expires:Date.now()+ttl});return value}).finally(()=>pending.delete(key));
  pending.set(key,promise);return promise;
}
async function anilist<T>(query:string,variables:Record<string,unknown>={}):Promise<T>{
  if(isDesktop())return invoke<T>('query_anilist',{query,variables});
  const response=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,variables}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`AniList indisponível (HTTP ${response.status}). Tente novamente.`);
  const json=await response.json();if(json.errors)throw new Error(json.errors[0]?.message||'Falha na consulta AniList');return json.data;
}
function localProgress():ProgressEntry[]{return Object.keys(localStorage).filter(key=>key.startsWith('anipt-progress:')).map(key=>readStored<ProgressEntry|null>(key,null)).filter((entry):entry is ProgressEntry=>!!entry)}
function historyAnime(h:ProgressEntry):Anime{
  return {...normalize({id:h.anime_id,title:h.anime_title,provider:h.provider,cover_url:h.cover_url,banner_url:h.banner_url}),watched:h.episode,progress:progressPercent(h.timestamp,h.duration,h.completed),resume:h};
}
const progressKey=(anime:Anime,ep:Episode)=>`anipt-progress:${anime.provider}:${anime.id}:${ep.season}:${ep.number}`;

export const api={
  async translateSynopsis(text:string):Promise<string>{return cached('translation:'+text,async()=>{const results:string[]=[];for(const segment of translationSegments(text)){if(isDesktop())results.push(await invoke('translate_synopsis_segment',{text:segment}));else{const url=new URL('https://api.mymemory.translated.net/get');url.searchParams.set('q',segment);url.searchParams.set('langpair','en|pt-BR');const response=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error('O serviço de tradução não respondeu. O original foi preservado.');results.push(translatedSegment(await response.json()))}}return results.join(' ');},86400000)},
  async metadata(anime:Anime):Promise<Anime>{const id=Number(anime.id.replace('anilist:',''));if(!Number.isFinite(id))return anime;return cached(`metadata:${id}`,async()=>{const data=await anilist<{Media:Media}>(`query Details($id:Int!){Media(id:$id,type:ANIME){${mediaFields}}}`,{id});return fromMedia(data.Media)})},
  clearCatalogCache(){cache.clear()},
  async removeProgress(anime:Anime,season?:number,episode?:number):Promise<void>{if(isDesktop())await invoke('remove_progress',{animeId:anime.id,provider:anime.provider||'multi',season:season??null,episode:episode??null});else for(const key of Object.keys(localStorage).filter(k=>k.startsWith('anipt-progress:'))){const entry=readStored<ProgressEntry|null>(key,null);if(entry?.anime_id===anime.id&&entry.provider===(anime.provider||'multi')&&(season===undefined||entry.season===season)&&(episode===undefined||entry.episode===episode))localStorage.removeItem(key)}},
  async allProgress():Promise<ProgressEntry[]>{return isDesktop()?invoke('export_progress'):localProgress()},
  async animeProgress(anime:Anime):Promise<ProgressEntry[]>{return isDesktop()?invoke('list_anime_progress',{animeId:anime.id,provider:anime.provider||'multi'}):localProgress().filter(p=>p.anime_id===anime.id&&p.provider===(anime.provider||'multi')).sort((a,b)=>(b.watched_at||'').localeCompare(a.watched_at||''))},
  async importProgress(entries:ProgressEntry[]):Promise<void>{if(isDesktop())await invoke('import_progress',{entries});else for(const entry of entries)localStorage.setItem(progressKey({id:entry.anime_id,provider:entry.provider} as Anime,{season:entry.season,number:entry.episode} as Episode),JSON.stringify(entry))},
  async importUserData(favorites:Anime[],progress:ProgressEntry[]):Promise<void>{if(isDesktop()){await invoke('import_user_data',{favorites:favorites.map(a=>({id:0,anime_id:a.id,anime_title:a.title,provider:a.provider||'multi',cover_url:a.coverUrl||'',synopsis:a.description||'',added_at:''})),entries:progress});return}const keys=['anipt-favorites',...progress.map(p=>progressKey({id:p.anime_id,provider:p.provider} as Anime,{season:p.season,number:p.episode} as Episode))],previous=new Map(keys.map(k=>[k,localStorage.getItem(k)]));try{await api.importProgress(progress);for(const favorite of favorites)await api.putFavorite(favorite)}catch(error){for(const [key,value] of previous){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}throw error}},
  async putFavorite(anime:Anime):Promise<void>{const f={id:0,anime_id:anime.id,anime_title:anime.title,provider:anime.provider||'multi',cover_url:anime.coverUrl||'',synopsis:anime.description,added_at:''};if(isDesktop())await invoke('add_favorite',{favorite:f});else {const favorites=readStored<typeof f[]>('anipt-favorites',[]).filter(item=>item.anime_id!==f.anime_id||item.provider!==f.provider);localStorage.setItem('anipt-favorites',JSON.stringify([...favorites,f]))}},
  async addonInfo(url:string):Promise<{name:string;resources:string[];prefixes:string[];types:string[];catalog_status?:string}>{if(!isDesktop())throw new Error('Teste as fontes no aplicativo desktop.');return invoke('inspect_addon',{url})},
  async cacheInfo():Promise<{path:string;bytes:number;active:boolean}>{return isDesktop()?invoke('torrent_cache_info'):{path:'Cache de torrents disponível no app desktop',bytes:0,active:false}},
  async clearTorrentCache():Promise<{bytes:number}>{return invoke('clear_torrent_cache')},
  async dataLocation():Promise<string>{return isDesktop()?invoke('data_location'):'Armazenamento local deste navegador'},
  async airingAgenda(from:number,to:number):Promise<{anime:Anime;episode:number;airingAt:number}[]>{return cached(`agenda:${from}:${to}`,async()=>{const schedules:{anime:Anime;episode:number;airingAt:number}[]=[];for(let page=1;page<=10;page++){const data=await anilist<{Page:{pageInfo:{hasNextPage:boolean};airingSchedules:{episode:number;airingAt:number;media:Media}[]}}>(`query Agenda($from:Int,$to:Int,$page:Int){Page(page:$page,perPage:50){pageInfo{hasNextPage} airingSchedules(airingAt_greater:$from,airingAt_lesser:$to,sort:TIME){episode airingAt media{${mediaFields}}}}}`,{from,to,page});schedules.push(...data.Page.airingSchedules.filter(s=>!s.media.isAdult).map(s=>({anime:fromMedia(s.media),episode:s.episode,airingAt:s.airingAt})));if(!data.Page.pageInfo.hasNextPage)break;}return schedules;},120000)},
  async related(anime:Anime):Promise<Anime[]>{const id=Number(anime.id.replace('anilist:',''));if(!Number.isFinite(id))return [];return cached(`related:${id}`,async()=>{const data=await anilist<{Media:{relations:{edges:{node:Media&{type:string;isAdult:boolean}}[]}}}>(`query Related($id:Int!){Media(id:$id,type:ANIME){relations{edges{node{${mediaFields} type}}}}}`,{id});return data.Media.relations.edges.filter(e=>e.node.type==='ANIME'&&!e.node.isAdult).map(e=>fromMedia(e.node));})},
  async prepareTorrent(input:string):Promise<{id:number;files:{index:number;name:string;bytes:number}[]}>{return invoke('prepare_torrent',{input})},
  async startTorrent(id:number,file:number):Promise<{url:string;file:string}>{return invoke('start_torrent',{id,file})},
  async stopTorrent(id:number):Promise<void>{return invoke('stop_torrent',{id})},
  async torrentStats(id:number):Promise<{progress_bytes:number;file_progress:number[];total_bytes:number;error?:string;finished:boolean}>{return invoke('torrent_stats',{id})},
  async search(query=''):Promise<Anime[]>{return cached('search:'+query,async()=>isDesktop()?(await invoke<BackendAnime[]>('search_anime',{query})).map(normalize):(await api.catalog({search:query||'',sort:'POPULARITY_DESC'})).items)},
  async catalog(filters:CatalogFilters):Promise<{items:Anime[];hasNext:boolean;page:number;total:number}>{
    return cached('catalog:'+JSON.stringify(filters),async()=>{const data=await anilist<{Page:{media:Media[];pageInfo:{currentPage:number;hasNextPage:boolean;total:number}}}>(catalogQuery,filters);return {items:data.Page.media.map(fromMedia),hasNext:data.Page.pageInfo.hasNextPage,page:data.Page.pageInfo.currentPage,total:data.Page.pageInfo.total}});
  },
  async catalogOptions():Promise<CatalogOptions>{return cached('filter-options',()=>anilist<CatalogOptions>(optionsQuery),86400000)},
  async releasesPage(page=1,cutoff=Math.floor(Date.now()/1000)):Promise<{items:Anime[];hasNext:boolean;page:number}>{return cached(`releases:${page}:${Math.floor(cutoff/120)}`,async()=>{const data=await anilist<{Page:{pageInfo:{currentPage:number;hasNextPage:boolean};airingSchedules:Schedule<Media>[]}}>(`query Releases($to:Int,$page:Int){Page(page:$page,perPage:50){pageInfo{currentPage hasNextPage} airingSchedules(airingAt_lesser:$to,sort:TIME_DESC){episode airingAt media{${mediaFields}}}}}`,{to:cutoff+1,page});return {items:confirmedSchedules(data.Page.airingSchedules,cutoff).map(s=>({...fromMedia(s.media),latestEpisode:s.episode,airedAt:s.airingAt,confirmedRelease:true})),hasNext:data.Page.pageInfo.hasNextPage,page:data.Page.pageInfo.currentPage};},120000)},
  async recentReleases():Promise<Anime[]>{return (await api.releasesPage()).items},
  async homeFeeds():Promise<{trending:Anime[];popular:Anime[];recent:Anime[]}>{return cached('home-feeds',async()=>{
    if(isDesktop()){const data=await invoke<{trending:BackendAnime[];popular:BackendAnime[];recent:BackendAnime[]}>('anilist_home');return {trending:data.trending.map(normalize),popular:data.popular.map(normalize),recent:data.recent.map(normalize)}}
    const data=await anilist<{trending:{media:Media[]};popular:{media:Media[]};recent:{media:Media[]}}>(`query Home{trending:Page(perPage:24){media(type:ANIME,isAdult:false,sort:TRENDING_DESC){${mediaFields}}}popular:Page(perPage:24){media(type:ANIME,isAdult:false,sort:POPULARITY_DESC){${mediaFields}}}recent:Page(perPage:24){media(type:ANIME,isAdult:false,sort:ID_DESC){${mediaFields}}}}`);
    return {trending:data.trending.media.map(fromMedia),popular:data.popular.media.map(fromMedia),recent:data.recent.media.map(fromMedia)};
  })},
  async favorites():Promise<Anime[]>{const entries=isDesktop()?await invoke<{anime_id:string;anime_title:string;provider:string;cover_url?:string;synopsis?:string}[]>('list_favorites'):readStored('anipt-favorites',[]);return entries.map((f:{anime_id:string;anime_title:string;provider:string;cover_url?:string;synopsis?:string})=>({...normalize({id:f.anime_id,title:f.anime_title,provider:f.provider,cover_url:f.cover_url,synopsis:f.synopsis}),favorite:true}))},
  async history():Promise<Anime[]>{return (isDesktop()?await invoke<ProgressEntry[]>('list_history',{limit:100}):localProgress().sort((a,b)=>(b.watched_at||'').localeCompare(a.watched_at||''))).map(historyAnime)},
  async episodes(anime:Anime,season=1):Promise<Episode[]>{return cached(`anilist-episode-list:${anime.id}:${season}`,async()=>{
    const limit=await api.releasedEpisodeLimit(anime);
    return Array.from({length:limit},(_,index)=>({id:`catalog:${anime.id}:${index+1}`,anime_id:anime.id,season,number:index+1,title:`Episódio ${index+1}`,duration:0,thumbnail:''}));
  },60000)},
  async providerEpisodes(anime:Anime,season=1):Promise<Episode[]>{return cached(`episodes:${anime.provider}:${anime.id}:${season}`,async()=>{
    if(isDesktop()){const [episodes,limit]=await Promise.all([invoke<Episode[]>('get_episodes',{animeId:anime.id,season,provider:anime.provider||'multi'}),api.releasedEpisodeLimit(anime)]);return episodes.filter(ep=>ep.number>0&&ep.number<=limit)}
    const limit=await api.releasedEpisodeLimit(anime);
    const spec=anime.provider?.replace(/^addon:/,'');if(!spec)throw new Error('Esta fonte precisa do app desktop.');
    const [base,kind='anime']=spec.split('|');const response=await fetch(`${base}/meta/${kind}/${encodeURIComponent(anime.id)}.json`,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('A fonte não encontrou os episódios deste identificador.');
    const data=await response.json();return (data.meta?.videos||[]).filter((v:{season?:number;episode:number})=>(v.season||1)===season&&v.episode>0&&v.episode<=limit).map((v:{id:string;episode:number;season?:number;title?:string;thumbnail?:string})=>({id:v.id,anime_id:anime.id,season:v.season||1,number:v.episode,title:v.title||`Episódio ${v.episode}`,duration:0,thumbnail:v.thumbnail||''}));
  },120000)},
  async releasedEpisodeLimit(anime:Anime):Promise<number>{
    const match=/^anilist:(\d+)$/.exec(anime.id);
    if(!match)throw new Error('Este título não tem identificação AniList para confirmar os episódios exibidos.');
    return cached(`aired-limit:${anime.id}`,async()=>{
      const now=Math.floor(Date.now()/1000);
      const data=await anilist<{Media:ReleaseInfo;Page:{airingSchedules:{episode:number;airingAt:number}[]}}>(`query ReleasedEpisodes($id:Int!,$now:Int!){Media(id:$id,type:ANIME){status episodes nextAiringEpisode{episode airingAt}} Page(page:1,perPage:1){airingSchedules(mediaId:$id,airingAt_lesser:$now,sort:TIME_DESC){episode airingAt}}}`,{id:Number(match[1]),now:now+1});
      return releasedLimit(data.Media,data.Page.airingSchedules[0]||null,now);
    },60000);
  },
  async seasonFamily(anime:Anime):Promise<Anime[]>{
    const match=/^anilist:(\d+)$/.exec(anime.id);if(!match)return [];
    type Entry=Media&{type:string;format:string;status:string;relations:{edges:{relationType:string;node:Entry}[]}};
    return cached(`season-family:${anime.id}`,async()=>{
      const entries=new Map<number,Entry>(),visited=new Set<number>(),queue=[Number(match[1])];
      while(queue.length&&visited.size<24){
        const id=queue.shift()!;if(visited.has(id))continue;visited.add(id);
        const data=await cached(`season-relations:${id}`,()=>anilist<{Media:Entry}>(`query SeasonFamily($id:Int!){Media(id:$id,type:ANIME){${mediaFields} type format status relations{edges{relationType node{${mediaFields} type format status}}}}}`,{id}),1800000);
        entries.set(id,data.Media);
        for(const edge of data.Media.relations?.edges||[]){
          if(!['PREQUEL','SEQUEL'].includes(edge.relationType)||edge.node.type!=='ANIME')continue;
          entries.set(edge.node.id,edge.node);if(!visited.has(edge.node.id))queue.push(edge.node.id);
        }
      }
      return numberSeasonFamily([...entries.values()].filter(entry=>['TV','TV_SHORT','ONA'].includes(entry.format)&&entry.status!=='NOT_YET_RELEASED').sort((a,b)=>(a.seasonYear||0)-(b.seasonYear||0)||a.id-b.id).map(fromMedia));
    },300000);
  },
  async streamReport(anime:Anime,episode:Episode,language='legendado'):Promise<StreamResolution>{if(!isDesktop())throw new Error('Abra o AniBR desktop para usar as fontes de reprodução.');if(episode.anime_id!==anime.id)throw new Error('Este episódio pertence a outra temporada.');const addons=await api.listAddons();return cached(`streams:${JSON.stringify(addons)}:${anime.id}:${anime.provider}:${episode.id}:${language}`,()=>invoke<StreamResolution>('get_streams',{animeId:anime.id,episodeId:episode.id,language,provider:anime.provider||'multi'}),60000)},
  async streams(anime:Anime,episode:Episode,language='legendado'):Promise<StreamSource[]>{return (await api.streamReport(anime,episode,language)).streams},
  async episodeAvailable(anime:Anime,episode:Episode):Promise<boolean>{
    if(!isDesktop())return false;
    const addons=await api.listAddons();
    return cached(`available:${JSON.stringify(addons)}:${anime.provider}:${episode.id}`,async()=>{
      try{const sources=await api.streams(anime,episode);return sources.length>0&&await invoke<boolean>('probe_streams',{streams:sources})}catch{return false}
    },60000);
  },
  async getSettings():Promise<PlaybackSettings>{const settings=playbackSettings(isDesktop()?await invoke('get_config'):readStored('anipt-settings',{}));return {...settings,quality:normalizeQuality(settings.quality),language:settings.language.toLowerCase()==='dublado'?'dublado':'legendado'}},
  async getProgress(anime:Anime,ep:Episode):Promise<ProgressEntry|null>{return isDesktop()?invoke('get_progress',{animeId:anime.id,provider:anime.provider||'multi',season:ep.season,episode:ep.number}):JSON.parse(localStorage.getItem(progressKey(anime,ep))||'null')},
  async saveProgress(entry:ProgressEntry):Promise<void>{if(!(await api.getSettings()).history)return;if(isDesktop())await invoke('save_progress',{entry});else localStorage.setItem(progressKey({id:entry.anime_id,provider:entry.provider} as Anime,{season:entry.season,number:entry.episode} as Episode),JSON.stringify({...entry,watched_at:new Date().toISOString()}))},
  async listAddons():Promise<string[]>{return isDesktop()?invoke('list_addons'):JSON.parse(localStorage.getItem('anipt-addons')||'[]')},
  async openExternal(url:string):Promise<void>{if(isDesktop())await invoke('open_external',{url});else window.open(url,'_blank','noopener,noreferrer')},
  async addAddon(url:string):Promise<{name?:string}>{if(!isDesktop())throw new Error('Cadastre as fontes no aplicativo desktop.');return invoke('add_addon',{url})},
  async removeAddon(url:string):Promise<void>{if(isDesktop())await invoke('remove_addon',{url})},
  async toggleFavorite(anime:Anime):Promise<void>{const favorites=await api.favorites(),provider=anime.provider||'multi';const exists=favorites.some(f=>f.id===anime.id&&f.provider===provider);if(exists){if(isDesktop())await invoke('remove_favorite',{animeId:anime.id,provider});else localStorage.setItem('anipt-favorites',JSON.stringify(readStored<{anime_id:string;provider:string}[]>('anipt-favorites',[]).filter(f=>f.anime_id!==anime.id||f.provider!==provider)))}else await api.putFavorite(anime);anime.favorite=!exists},
  async saveSettings(settings:Record<string,unknown>):Promise<void>{if(isDesktop()){const cfg=await invoke<Record<string,unknown>>('get_config');await invoke('update_config',{cfg:{...cfg,...settings}})}else localStorage.setItem('anipt-settings',JSON.stringify({...readStored('anipt-settings',{}),...settings}))}
};
