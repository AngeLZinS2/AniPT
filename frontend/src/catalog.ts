export type CatalogFilters = Record<string, string | number | boolean | string[] | number[]>;
export type CatalogOptions = { GenreCollection:string[]; MediaTagCollection:{name:string;category:string;isAdult:boolean}[]; ExternalLinkSourceCollection:{id:number;site:string}[] };
export const mediaFields='id title{english romaji} status seasonYear averageScore episodes description(asHtml:false) genres isAdult coverImage{extraLarge large} bannerImage trailer{id site thumbnail}';
export const catalogQuery=`query Catalog($page:Int,$search:String,$seasonYear:Int,$season:MediaSeason,$format_in:[MediaFormat],$status_in:[MediaStatus],$source_in:[MediaSource],$countryOfOrigin:CountryCode,$genre_in:[String],$genre_not_in:[String],$tag_in:[String],$tag_not_in:[String],$minimumTagRank:Int,$licensedById_in:[Int],$isLicensed:Boolean,$isAdult:Boolean,$startDate_greater:FuzzyDateInt,$startDate_lesser:FuzzyDateInt,$episodes_greater:Int,$episodes_lesser:Int,$duration_greater:Int,$duration_lesser:Int,$sort:[MediaSort]) {
  Page(page:$page,perPage:50){pageInfo{currentPage hasNextPage total} media(type:ANIME,search:$search,seasonYear:$seasonYear,season:$season,format_in:$format_in,status_in:$status_in,source_in:$source_in,countryOfOrigin:$countryOfOrigin,genre_in:$genre_in,genre_not_in:$genre_not_in,tag_in:$tag_in,tag_not_in:$tag_not_in,minimumTagRank:$minimumTagRank,licensedById_in:$licensedById_in,isLicensed:$isLicensed,isAdult:$isAdult,startDate_greater:$startDate_greater,startDate_lesser:$startDate_lesser,episodes_greater:$episodes_greater,episodes_lesser:$episodes_lesser,duration_greater:$duration_greater,duration_lesser:$duration_lesser,sort:$sort){${mediaFields}}}
}`;
export const optionsQuery='query FilterOptions {GenreCollection MediaTagCollection{name category isAdult} ExternalLinkSourceCollection(type:STREAMING,mediaType:ANIME){id site}}';
export const formats=[['TV','Série de TV'],['TV_SHORT','TV curta'],['MOVIE','Filme'],['SPECIAL','Especial'],['OVA','OVA'],['ONA','ONA'],['MUSIC','Música']];
export const seasons=[['WINTER','Inverno'],['SPRING','Primavera'],['SUMMER','Verão'],['FALL','Outono']];
export const statuses=[['RELEASING','Em lançamento'],['FINISHED','Finalizado'],['NOT_YET_RELEASED','Ainda não lançado'],['CANCELLED','Cancelado'],['HIATUS','Em pausa']];
export const origins=[['JP','Japão'],['CN','China'],['KR','Coreia do Sul'],['TW','Taiwan']];
export const sources=[['ORIGINAL','Original'],['MANGA','Mangá'],['LIGHT_NOVEL','Light novel'],['VISUAL_NOVEL','Visual novel'],['VIDEO_GAME','Videogame'],['OTHER','Outro'],['NOVEL','Romance'],['DOUJINSHI','Doujinshi'],['ANIME','Anime'],['WEB_NOVEL','Web novel'],['LIVE_ACTION','Live action'],['GAME','Jogo'],['COMIC','Comic'],['MULTIMEDIA_PROJECT','Projeto multimídia'],['PICTURE_BOOK','Livro ilustrado']];
export const sorts=[['POPULARITY_DESC','Popularidade'],['TRENDING_DESC','Em alta'],['SCORE_DESC','Melhor nota'],['START_DATE_DESC','Estreia mais recente'],['START_DATE','Estreia mais antiga'],['TITLE_ROMAJI','Título A–Z'],['TITLE_ROMAJI_DESC','Título Z–A'],['FAVOURITES_DESC','Mais favoritos'],['ID_DESC','Adicionados recentemente'],['SEARCH_MATCH','Relevância da busca']];

export function filtersFromForm(form:HTMLFormElement):CatalogFilters {
  const filters:CatalogFilters={page:1};
  for(const el of form.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input[name],select[name]')) {
    if(!el.value)continue;
    if(el instanceof HTMLSelectElement&&el.multiple){const values=[...el.selectedOptions].map(o=>o.value);if(values.length)filters[el.name]=el.name==='licensedById_in'?values.map(Number):values;continue}
    if(el.name==='yearMin'){filters.startDate_greater=Number(el.value)*10000;continue}
    if(el.name==='yearMax'){filters.startDate_lesser=(Number(el.value)+1)*10000;continue}
    if(el.name==='isAdult'||el.name==='isLicensed'){filters[el.name]=el.value==='true';continue}
    if(el.type==='number'){const n=Number(el.value);if(!Number.isFinite(n)||n<0)continue;filters[el.name]=el.name.endsWith('_greater')?n-1:el.name.endsWith('_lesser')?n+1:n;continue}
    filters[el.name]=el.value;
  }
  if(filters.sort==='SEARCH_MATCH'&&!filters.search)filters.sort='POPULARITY_DESC';
  return filters;
}
