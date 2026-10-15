import {welcome} from './welcome';
import {localProfile} from './profile';
import './app.css';
import type Hls from 'hls.js';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {api, type Anime, type Episode, type ProgressEntry} from './api';
import {imageFallback} from './images';
import {normalizeQuality, preferredQualityIndex, qualityLabel, resolutionFromDimensions, resolutionFromLabel} from './quality';
import {catalogForm} from './catalog-view';
import {filtersFromForm,type CatalogFilters} from './catalog';
import {serverKey} from './playback';
import {groupServers} from './server-groups';
import {animeKey,library,setListStatus,listStatuses,genreLabel,clock,readStored,saveSynopsis,synopsisFor,type ListStatus} from './personal';
import {seasonScreen,libraryScreen,agendaScreen,settingsScreen,discoveryScreen,rankingScreen,editProgress,notifyFollowed,enhanceDetails,releasesScreen} from './screens';
import {activateDialog} from './ui';

type Page='home'|'releases'|'catalog'|'search'|'season'|'ranking'|'favorites'|'history'|'settings'|'details'|'library'|'agenda'|'discover';
const emptyAnime:Anime={id:'',title:'',subtitle:'',description:'',year:0,rating:0,episodes:0,color:'#3157ff',tags:[]};
let page:Page='home', selected:Anime=emptyAnime, query='', currentItems:Anime[]=[];
let currentEpisodes:Episode[]=[];
let heroTimer:number|undefined;
let renderVersion=0,playerRequest=0,searchTimer:number|undefined;
let catalogFilters:CatalogFilters={page:1,sort:'POPULARITY_DESC',isAdult:false};
type NavigationState={page:Page;query:string;filters:CatalogFilters;scroll:number;anime:Anime};
const navigation:NavigationState[]=[];
let pendingScroll:number|undefined,favoriteKeys=new Set<string>();
const $=(s:string)=>document.querySelector(s) as HTMLElement|null;
const esc=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const initials=(title:string)=>title.split(/\s+/).slice(0,2).map(x=>x[0]).join('');
const titleKey=(title:string)=>title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const releaseAge=(timestamp=0)=>{if(!timestamp)return 'Horário confirmado';const minutes=Math.max(0,Math.floor(Date.now()/1000-timestamp)/60);if(minutes<60)return `há ${Math.max(1,Math.floor(minutes))} min`;const hours=Math.floor(minutes/60);return hours<24?`há ${hours} h`:`há ${Math.floor(hours/24)} d`};

function mount(content:string){
  const app=$('#app')!,existing=app.querySelector('.topbar');
  if(!existing)app.innerHTML=shell(content);
  else {
    const template=document.createElement('template');template.innerHTML=shell(content);
    if((existing as HTMLElement).dataset.view!==page){existing.querySelector('nav')!.innerHTML=template.content.querySelector('.topbar nav')!.innerHTML;(existing as HTMLElement).dataset.view=page;}
    app.querySelector('main')!.replaceChildren(...template.content.querySelector('main')!.childNodes);
    app.querySelector('footer')?.replaceWith(template.content.querySelector('footer')!);
    const input=existing.querySelector<HTMLInputElement>('.top-search input');if(input&&document.activeElement!==input)input.value=query;
  }
  if(pendingScroll!==undefined&&!content.includes('page-loading')&&!content.includes('empty-home')){const y=pendingScroll;pendingScroll=undefined;requestAnimationFrame(()=>window.scrollTo(0,y));}
}
function remember(){navigation.push({page,query,filters:{...catalogFilters},scroll:window.scrollY,anime:selected});if(navigation.length>30)navigation.shift();}
function navigate(target:Page,anime?:Anime){remember();window.clearTimeout(searchTimer);query='';page=target;if(target==='catalog')delete catalogFilters.search;if(anime)selected=anime;$('#primary-nav')?.classList.remove('open');$('.menu')?.setAttribute('aria-expanded','false');window.scrollTo(0,0);render();}
function goBack(){const previous=navigation.pop();if(previous){page=previous.page;query=previous.query;catalogFilters=previous.filters;selected=previous.anime;pendingScroll=previous.scroll}else page='catalog';render();}
const screenContext=()=>({mount:(html:string)=>{mount(html);bind()},setItems:(items:Anime[])=>currentItems=items,toast:showToast,refresh:(top=false)=>{if(top)pendingScroll=0;render()},open:(anime:Anime)=>navigate('details',anime),play:(episode:number,season:number)=>openPlayer(episode,season),card,banner});

const poster=(a:Anime,large=false)=>`<div class="poster ${large?'poster-large':''}" style="--tone:${esc(a.color)}">${a.coverUrl?`<img src="${esc(a.coverUrl)}" alt="Capa de ${esc(a.title)}" loading="${large?'eager':'lazy'}" decoding="async"/>`:''}<span class="poster-mark" aria-hidden="true">${initials(a.title)}</span>${a.progress?`<div class="progress" aria-label="${a.progress}% assistido"><i style="width:${a.progress}%"></i></div>`:''}</div>`;
const banner=(a:Anime,index=0,continuing=false)=>`<article class="banner-card"><a class="card-open" href="#anime-${encodeURIComponent(a.id)}" data-id="${esc(a.id)}" data-provider="${esc(a.provider||'multi')}" data-release-episode="${a.latestEpisode||''}" ${continuing?'data-resume="true"':''} role="link"><div class="banner-image" style="--tone:${esc(a.color)}">${a.bannerUrl||a.coverUrl?`<img src="${esc(a.bannerUrl||a.coverUrl||'')}" alt="Cena de ${esc(a.title)}" loading="lazy" decoding="async"/>`:`<span class="banner-placeholder" aria-hidden="true">${esc(initials(a.title))}</span>`}${a.confirmedRelease?'<span class="quality">Exibido</span>':''}${continuing?`<span class="continue-badge">Ep. ${a.watched||index+1}</span>`:a.confirmedRelease?'<span class="new-badge">Novo</span>':''}${a.progress!==undefined?`<div class="progress" aria-label="${a.progress}% assistido"><i style="width:${a.progress}%"></i></div>`:''}</div><div class="banner-caption"><h3>${esc(a.title)}</h3><p>${continuing?`T${a.resume?.season||1} · Episódio ${a.watched}`:a.latestEpisode?`Episódio ${a.latestEpisode}`:'Detalhes do anime'} · ${a.confirmedRelease?releaseAge(a.airedAt):esc(a.resume?.language||'Idioma não informado')}</p>${continuing?`<div class="progress-caption"><b>${a.progress!==undefined?`${a.progress}% assistido`:'Tempo salvo'}</b><span>${Math.floor((a.resume?.timestamp||0)/60)}:${String((a.resume?.timestamp||0)%60).padStart(2,'0')}</span></div>`:''}${a.confirmedRelease?'<small class="availability">Exibição AniList · vídeo ainda não verificado</small>':''}</div></a></article>`;
const card=(a:Anime)=>`<article class="anime-card"><a class="card-open" href="#anime-${encodeURIComponent(a.id)}" data-id="${esc(a.id)}" data-provider="${esc(a.provider||'multi')}">${poster(a)}<div class="card-info"><h3>${esc(a.title)}</h3><p>${a.year||'Ano não informado'} <span>Nota ${a.rating||'—'}</span></p><div class="chips"><b>${esc(genreLabel(a.tags[0]||'Anime'))}</b><em>${a.episodes?`${a.episodes} eps.`:'Episódios não informados'}</em></div>${a.status==='NOT_YET_RELEASED'?'<span class="future-badge">Ainda não lançado</span>':''}</div></a><button class="card-favorite" data-card-fav="${esc(a.id)}" data-provider="${esc(a.provider||'multi')}" aria-label="${favoriteKeys.has(animeKey(a))?'Remover dos favoritos':'Favoritar'} ${esc(a.title)}" aria-pressed="${favoriteKeys.has(animeKey(a))}">${favoriteKeys.has(animeKey(a))?'♥':'♡'}</button></article>`;
const navLink=(target:Page,label:string)=>`<button class="${page===target?'active':''}" data-page="${target}">${label}</button>`;
const heroCopy=(a:Anime)=>`<h1>${esc(a.title)}</h1><div class="hero-meta"><b>Nota ${a.rating||'—'}</b><span>${a.year||'Anime'}</span><span>${a.episodes||'—'} episódios</span></div><p>${esc(synopsisFor(a)?.text||a.description)}</p><div class="hero-actions"><button class="light-button hero-details">Ver detalhes</button><button class="text-button hero-catalog">Abrir catálogo</button></div>`;

function shell(content:string){return `<header class="topbar" data-view="${page}"><button class="logo" data-page="home" aria-label="Ir para o início"><img class="brand-icon" src="/anibr-icon.png" alt="" aria-hidden="true"/><strong>AniBR</strong></button><button class="menu" aria-label="Abrir menu" aria-controls="primary-nav" aria-expanded="false">Menu</button><nav id="primary-nav">${navLink('home','Início')}<div class="explore-wrap"><button class="explore-toggle ${page==='catalog'||page==='search'?'active':''}">Explorar</button><div class="explore-menu"><div><small>Navegar</small><button data-page="catalog">Catálogo</button><button data-page="releases">Episódios exibidos</button><button data-page="season">Temporada</button><button data-page="agenda">Agenda</button><button data-page="discover">Descobrir</button><button data-page="search">Buscar</button></div><div><small>Gêneros populares</small><section>${[['Action','Ação'],['Fantasy','Fantasia'],['Adventure','Aventura'],['Comedy','Comédia'],['Drama','Drama'],['Sci-Fi','Ficção científica'],['Romance','Romance'],['Supernatural','Sobrenatural']].map(([value,label])=>`<button data-genre="${value}">${label}</button>`).join('')}</section></div></div></div>${navLink('library','Minha lista')}${navLink('favorites','Favoritos')}${navLink('history','Histórico')}</nav><label class="top-search"><span aria-hidden="true">⌕</span><input value="${esc(query)}" placeholder="Buscar anime" aria-label="Buscar anime"/><kbd>Ctrl K</kbd></label><span class="language" aria-label="Idioma da interface">PT-BR</span><button class="profile" data-page="settings" aria-label="Abrir configurações">⚙</button></header><main>${content}</main><footer><div class="footer-copy"><div class="logo footer-logo"><i>A</i><strong>AniBR</strong></div><p>Desenvolvido por Angelo Neri · Conteúdo de fontes externas</p><nav class="footer-social" aria-label="Redes do desenvolvedor"><a href="https://github.com/AngeLZinS2/AniPT" data-external>GitHub ↗</a><a href="https://www.linkedin.com/in/angelo-neri-3921a72b9/" data-external>LinkedIn ↗</a></nav></div></footer>`}
function sectionTitle(title:string,sub:string,action='Ver todos'){const target=title==='Continuar assistindo'?'data-page="history"':title==='Novos episódios'?'data-page="releases"':title==='Adicionados recentemente'?'data-sort="ID_DESC"':title==='Em alta'?'data-sort="TRENDING_DESC"':'data-sort="POPULARITY_DESC"';return `<div class="section-title"><div><h2>${title}</h2><p>${sub}</p></div><button class="text-button" ${target}>${action}</button></div>`}

async function render(){
  const version=++renderVersion;
  if(page==='home'&&!$('#app')!.children.length)mount('<section class="page-loading" role="status">Carregando o AniBR…</section>');
  else if(page!=='details'){mount('<section class="page-loading" aria-live="polite"><i></i><span>Carregando…</span></section>');bind();}
  try{
  favoriteKeys=new Set((await api.favorites().catch(()=>[])).map(animeKey));
  if(version!==renderVersion)return;
  selected.favorite=favoriteKeys.has(animeKey(selected));
  if(heroTimer!==undefined){window.clearInterval(heroTimer);heroTimer=undefined}
  if(page==='home'){await renderHome(version);return}
  if(page==='details'){await renderDetails(version);return} if(page==='settings'){await renderSettings(version);return}
  if(page==='search'||page==='catalog'){await renderCatalog(version);return} if(page==='season'){await seasonScreen(screenContext(),()=>version!==renderVersion);return} if(page==='ranking'){await rankingScreen(screenContext(),()=>version!==renderVersion);return} if(page==='library'){libraryScreen(screenContext());return} if(page==='agenda'){await agendaScreen(screenContext(),()=>version!==renderVersion);return} if(page==='discover'){await discoveryScreen(screenContext(),()=>version!==renderVersion);return}
  if(page==='releases'){await releasesScreen(screenContext(),()=>version!==renderVersion);return}
  const items=page==='favorites'?await api.favorites():await api.history();if(version!==renderVersion)return;currentItems=items;renderListing(items);
  }catch(error){if(version!==renderVersion)return;mount(`<section class="page-error"><h2>Não foi possível carregar</h2><p>${esc(error instanceof Error?error.message:'A fonte não respondeu.')}</p><button class="purple-button retry-page">Tentar novamente</button></section>`);bind();$('.retry-page')?.addEventListener('click',()=>render())}
}

async function renderHome(version:number){
  const saved=readStored<{feeds:{trending:Anime[];popular:Anime[];recent:Anime[]};releases:Anime[];updatedAt?:string}>('anibr-home-cache',{feeds:{trending:[],popular:[],recent:[]},releases:[]});
  let feeds=saved.feeds,releases=saved.releases,history:Anime[]=[],cacheShown=!!saved.updatedAt,feedTimestamp=saved.updatedAt;
  const errors=new Map<string,string>(),loading=new Set(['history','feeds','releases']);
  const draw=()=>{
    if(version!==renderVersion)return;
    if(heroTimer!==undefined){clearInterval(heroTimer);heroTimer=undefined}
    const artwork=[...feeds.trending,...feeds.popular,...feeds.recent,...releases];
    const unique=new Set<string>(),hidden=readStored<Record<string,string>>('anibr-hidden-continue',{});
    const continuing=history.filter(a=>{const key=animeKey(a);if(unique.has(key))return false;unique.add(key);return !a.resume?.completed&&!!a.resume?.timestamp&&hidden[key]!==a.resume?.watched_at}).slice(0,6).map(a=>{const match=artwork.find(m=>m.id===a.id);return {...match,...a,coverUrl:a.coverUrl||match?.coverUrl,bannerUrl:a.bannerUrl||match?.bannerUrl}});
    currentItems=[...artwork,...continuing];const slides=feeds.trending.slice(0,5),feature=slides[0]||feeds.popular[0]||releases[0];
    const error=(name:string)=>errors.has(name)?`<div class="section-error" role="status"><p>${esc(errors.get(name)!)}</p><button class="outline-button" data-home-retry="${name}">Tentar novamente</button></div>`:'';
    const hero=feature?`<section class="hero portal-hero"><div class="hero-media">${feature.bannerUrl||feature.coverUrl?`<img class="hero-backdrop" src="${esc(feature.bannerUrl||feature.coverUrl||'')}" alt="Arte de ${esc(feature.title)}"/>`:''}</div><div class="hero-copy">${heroCopy(feature)}</div><div class="hero-tabs" aria-label="Escolher destaque">${slides.map((a,i)=>`<button class="${i===0?'active':''}" data-slide="${i}" aria-label="Mostrar ${esc(a.title)}"><span>${esc(a.title)}</span></button>`).join('')}</div></section>`:`<section class="portal-empty-hero"><div><h1>Seu próximo anime começa aqui</h1><p>${loading.has('feeds')?'Carregando o catálogo…':'O catálogo está indisponível. Sua lista e seu histórico continuam acessíveis.'}</p><button class="purple-button" data-page="library">Minha lista</button><button class="outline-button" data-page="catalog">Explorar catálogo</button></div></section>`;
    const continueSection=`<section class="media-section continue-section">${sectionTitle('Continuar assistindo','Retome o episódio no ponto salvo')}${error('history')}<div class="continue-row">${continuing.map((a,i)=>`<div class="continue-item">${banner(a,i,true)}<button class="text-button" data-hide-continue="${i}">Retirar da retomada</button></div>`).join('')||`<div class="empty-row"><div><b>${loading.has('history')?'Carregando progresso…':'Nada em andamento'}</b><small>Comece um episódio ou escolha uma obra na sua lista.</small></div><button data-page="library">Minha lista</button></div>`}</div></section>`;
    const news=`<section class="media-section release-section">${sectionTitle('Novos episódios','As exibições mais recentes do catálogo')}${error('releases')}<div class="dense-banner-grid">${releases.slice(0,6).map((a,i)=>banner(a,i)).join('')||`<p>${loading.has('releases')?'Carregando exibições…':'Nenhuma exibição nesta seleção.'}</p>`}</div></section>`;
    mount(`<div class="home-layout"><div class="home-feed">${localProfile()?.name?`<p class="home-greeting">Olá, ${esc(localProfile()!.name)}. <span>Qual história vamos viver hoje?</span></p>`:''}${hero}${continueSection}${cacheShown?`<p class="cache-note" role="status">Catálogo salvo em ${esc(new Date(saved.updatedAt!).toLocaleString('pt-BR'))} · ${loading.has('feeds')?'Atualizando…':'A atualização falhou; os dados salvos foram mantidos.'}</p>`:''}${error('feeds')}${news}<section class="media-section">${sectionTitle('Mais populares','Popularidade no catálogo AniList')}<div class="compact-posters">${feeds.popular.slice(0,12).map(card).join('')}</div></section><section class="media-section">${sectionTitle('Em alta','Tendências atuais')}<div class="compact-posters">${feeds.trending.slice(0,8).map(card).join('')}</div></section><section class="media-section">${sectionTitle('Adicionados recentemente','Novas entradas no catálogo; podem incluir obras ainda não lançadas')}<div class="compact-posters">${feeds.recent.slice(0,10).map(card).join('')}</div></section><section class="home-discover"><h2>Encontre sua próxima história</h2><p>Coleções por duração, formato e gêneros que você acompanha.</p><button class="purple-button" data-page="discover">Descobrir animes</button><button class="outline-button" data-page="agenda">Ver agenda</button><button class="outline-button" data-page="ranking">Ranking</button></section></div></div>`);bind();
    if(slides.length)startHeroCarousel(slides);else if(feature)document.querySelector<HTMLButtonElement>('.hero-details')!.onclick=()=>navigate('details',feature);
    document.querySelectorAll<HTMLButtonElement>('[data-home-retry]').forEach(button=>button.onclick=()=>{api.clearCatalogCache();load(button.dataset.homeRetry!)});
    document.querySelectorAll<HTMLButtonElement>('[data-hide-continue]').forEach(button=>button.onclick=()=>{const a=continuing[Number(button.dataset.hideContinue)],next=readStored<Record<string,string>>('anibr-hidden-continue',{});next[animeKey(a)]=a.resume?.watched_at||'';localStorage.setItem('anibr-hidden-continue',JSON.stringify(next));draw();showToast('Retirado da retomada. O histórico foi preservado.')});
  };
  const load=async(name:string)=>{loading.add(name);errors.delete(name);draw();try{if(name==='history')history=await api.history();else if(name==='feeds'){feeds=await api.homeFeeds();cacheShown=false;feedTimestamp=new Date().toISOString()}else releases=await api.recentReleases();if(version!==renderVersion)return;localStorage.setItem('anibr-home-cache',JSON.stringify({feeds,releases,updatedAt:feedTimestamp}));}catch{errors.set(name,name==='history'?'Não foi possível carregar o histórico.':name==='feeds'?'Não foi possível atualizar o catálogo.':'Não foi possível atualizar as exibições.')}finally{loading.delete(name);draw()}};
  draw();await Promise.allSettled(['history','feeds','releases'].map(load));
}

function startHeroCarousel(slides:Anime[]){
  if(slides.length<2)return;const hero=$('.portal-hero');if(!hero)return;let index=0,paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const show=(next:number)=>{index=(next+slides.length)%slides.length;const anime=slides[index];hero.style.setProperty('--tone',anime.color);const backdrop=hero.querySelector<HTMLImageElement>('.hero-backdrop'),copy=hero.querySelector<HTMLElement>('.hero-copy');if(backdrop){backdrop.alt=`Cena de ${anime.title}`;imageFallback(backdrop,[anime.bannerUrl,anime.coverUrl])}if(copy){copy.innerHTML=heroCopy(anime);copy.querySelector('.hero-details')?.addEventListener('click',()=>navigate('details',anime));copy.querySelector('.hero-catalog')?.addEventListener('click',()=>navigate('catalog'))}hero.querySelectorAll('.hero-tabs button').forEach((dot,i)=>dot.classList.toggle('active',i===index))};
  hero.querySelector('.hero-details')?.addEventListener('click',()=>navigate('details',slides[0]));hero.querySelector('.hero-catalog')?.addEventListener('click',()=>navigate('catalog'));
  hero.querySelectorAll<HTMLElement>('[data-slide]').forEach(dot=>dot.onclick=()=>show(Number(dot.dataset.slide)));let hovering=false,focused=false;hero.onmouseenter=()=>hovering=true;hero.onmouseleave=()=>hovering=false;hero.addEventListener('focusin',()=>focused=true);hero.addEventListener('focusout',e=>focused=hero.contains(e.relatedTarget as Node));const pause=document.createElement('button');pause.className='hero-pause';pause.textContent=paused?'Retomar destaques':'Pausar destaques';pause.setAttribute('aria-pressed',String(paused));pause.onclick=()=>{paused=!paused;pause.textContent=paused?'Retomar destaques':'Pausar destaques';pause.setAttribute('aria-pressed',String(paused))};hero.appendChild(pause);heroTimer=window.setInterval(()=>{if(!paused&&!hovering&&!focused&&!document.hidden)show(index+1)},8000);
}

function renderListing(items:Anime[]){
  const historyPage=page==='history';
  mount(`<section class="page-heading"><h1>${historyPage?'Histórico':'Meus favoritos'}</h1><p>${historyPage?'Retome ou corrija o progresso de cada episódio.':'Sua seleção especial de obras.'}</p></section><div class="${historyPage?'history-grid':'catalog-grid'}">${items.map((anime,i)=>historyPage?`<div class="history-item" data-history-index="${i}">${banner(anime,i,true)}<div class="history-actions"><button class="outline-button" data-history-edit="${i}">Editar progresso</button><button class="text-button" data-history-remove="${i}">Remover registro</button></div></div>`:card(anime)).join('')||'<div class="empty"><b>Nenhum título por aqui ainda</b><span>Comece pelo catálogo para montar sua coleção.</span><button class="purple-button" data-page="catalog">Explorar catálogo</button></div>'}</div>`);bind();
  document.querySelectorAll<HTMLButtonElement>('[data-history-edit]').forEach(button=>button.onclick=()=>{const anime=items[Number(button.dataset.historyEdit)],saved=anime.resume!;editProgress(screenContext(),anime,{id:saved.episode_id||`catalog:${anime.id}:${saved.episode}`,anime_id:anime.id,season:saved.season,number:saved.episode,title:saved.episode_title||`Episódio ${saved.episode}`,thumbnail:'',duration:saved.duration||0},saved)});
  document.querySelectorAll<HTMLButtonElement>('[data-history-remove]').forEach(button=>button.onclick=async()=>{const anime=items[Number(button.dataset.historyRemove)];try{await api.removeProgress(anime,anime.resume!.season,anime.resume!.episode);render();showToast('Registro removido do histórico.')}catch{showToast('Não foi possível remover o registro.')}});
}

async function renderCatalog(version=renderVersion){
  const filters={...catalogFilters};if(query.trim())filters.search=query.trim();else if(page==='search')delete filters.search;
  const [options,result]=await Promise.all([api.catalogOptions(),api.catalog(filters)]);
  if(version!==renderVersion)return;currentItems=result.items;
  mount(`<section class="page-heading"><h1>${page==='search'?'Buscar anime':'Catálogo'}</h1><p>Catálogo AniList · ${result.items.length} títulos nesta página</p></section>${catalogForm(options,filters)}<div class="catalog-grid">${result.items.map(card).join('')||'<div class="empty"><b>Nenhum resultado para estes filtros</b><span>Limpe ou ajuste os filtros para tentar novamente.</span></div>'}</div><nav class="catalog-pagination"><button class="catalog-previous" ${result.page<=1?'disabled':''}>‹ Anterior</button><span>Página ${result.page}</span><button class="catalog-next" ${!result.hasNext?'disabled':''}>Próxima ›</button></nav>`);bind();
  const form=document.querySelector<HTMLFormElement>('.anilist-filters')!;
  form.querySelector('.filter-actions small')!.textContent='Combine filtros e selecione várias opções com um clique.';
  form.querySelectorAll<HTMLElement>('.filter-field').forEach(field=>{
    const select=field.querySelector<HTMLSelectElement>('select')!,details=field.querySelector<HTMLDetailsElement>('details')!;
    const sync=()=>{field.querySelectorAll<HTMLInputElement>('[data-value]').forEach(box=>{const option=Array.from(select.options).find(option=>option.value===box.dataset.value);if(option)option.selected=box.checked});const selected=Array.from(select.selectedOptions);field.querySelector('.multi-caption')!.textContent=selected.length?`${selected.length} selecionado(s)`:'Qualquer';field.querySelector('.filter-chips')!.replaceChildren(...selected.map(option=>{const chip=document.createElement('span');chip.textContent=option.text;return chip}))};
    field.querySelectorAll<HTMLInputElement>('[data-value]').forEach(box=>box.onchange=sync);
    field.querySelector<HTMLInputElement>('.multi-search')!.oninput=e=>{const term=(e.target as HTMLInputElement).value.toLowerCase();field.querySelectorAll<HTMLElement>('[data-option-label]').forEach(row=>row.hidden=!row.dataset.optionLabel?.includes(term))};
    field.querySelector<HTMLButtonElement>('.multi-clear')!.onclick=()=>{field.querySelectorAll<HTMLInputElement>('[data-value]').forEach(box=>box.checked=false);sync()};
    field.querySelector<HTMLButtonElement>('.multi-done')!.onclick=()=>details.open=false;
    details.ontoggle=()=>{if(details.open)form.querySelectorAll<HTMLDetailsElement>('.multi-filter').forEach(other=>{if(other!==details)other.open=false})};
    details.onkeydown=e=>{if(e.key==='Escape'){details.open=false;details.querySelector('summary')?.focus()}};
  });
  form.onsubmit=e=>{e.preventDefault();catalogFilters=filtersFromForm(form);query=String(catalogFilters.search||'');render()};
  form.onreset=e=>{e.preventDefault();catalogFilters={page:1,sort:'POPULARITY_DESC',isAdult:false};query='';render()};
  $('.catalog-previous')?.addEventListener('click',()=>{catalogFilters={...filters,page:Math.max(1,result.page-1)};render()});
  $('.catalog-next')?.addEventListener('click',()=>{catalogFilters={...filters,page:result.page+1};render()});
  const tagSearch=form.querySelector<HTMLInputElement>('.tag-search')!;tagSearch.oninput=()=>{const term=tagSearch.value.toLowerCase();form.querySelectorAll<HTMLElement>('.tag-filters [data-option-label]').forEach(row=>row.hidden=!row.dataset.optionLabel?.includes(term))};
}

async function renderDetails(version=renderVersion){
  const anime=selected;
  api.metadata(anime).then(meta=>{if(version!==renderVersion||!meta.subtitle||meta.subtitle===anime.title)return;let alternative=document.querySelector<HTMLParagraphElement>('.detail-alternative');if(!alternative){alternative=document.createElement('p');alternative.className='detail-alternative';document.querySelector('.profile-facts')?.before(alternative)}alternative.textContent=`Também conhecido como: ${meta.subtitle}`}).catch(()=>{});
  const familyRequest=api.seasonFamily(anime).catch(()=>null);
  const episodesRequest=api.episodes(anime);
  const progressRequest=api.animeProgress(anime).catch(()=>[]);
  let episodePage=1,episodeGeneration=0;
  let episodes:Episode[]=[];currentEpisodes=[];
  const relatedRequest=api.related(anime).catch(()=>null);const related:Anime[]=[];

  const tags=(selected.tags.length?selected.tags:['Anime']).slice(0,9);
  const episodeRows=currentEpisodes.map(ep=>`<article class="detail-episode" data-episode-row data-search="${esc(`${ep.number} ${ep.title}`.toLowerCase())}"><div class="episode-thumb">${ep.thumbnail||selected.bannerUrl||selected.coverUrl?`<img src="${esc(ep.thumbnail||selected.bannerUrl||selected.coverUrl||'')}" alt="Cena do episódio ${ep.number}" loading="lazy"/>`:''}<span>Temp. ${ep.season} · Ep. ${ep.number}</span></div><div><strong>${esc(ep.title||`Episódio ${ep.number}`)}</strong><small>Episódio ${ep.number} · Temporada ${ep.season}</small></div><button data-play="${ep.number}">Assistir</button></article>`).join('');

  mount(`<div class="detail-page"><button class="back detail-back">Voltar</button><div class="detail-columns"><aside class="detail-profile"><div class="detail-cover" style="--tone:${selected.color}">${selected.coverUrl||selected.bannerUrl?`<img src="${esc(selected.coverUrl||selected.bannerUrl||'')}" alt="Capa de ${esc(selected.title)}"/>`:''}</div><section class="detail-profile-card"><h2>${esc(selected.title)}</h2>${selected.subtitle&&selected.subtitle!==selected.title?`<p>${esc(selected.subtitle)}</p>`:''}<div class="profile-facts"><span>${selected.year||'—'}</span><span>Nota ${selected.rating||'—'}</span><span>${currentEpisodes.length||selected.episodes||'—'} episódios</span></div><button class="profile-action favorite-button ${selected.favorite?'liked':''}" data-fav>${selected.favorite?'Favoritado':'Favoritar'}</button><button class="profile-action outline-button" data-plan>${library()[animeKey(selected)]?'Ver minha lista':'Quero assistir'}</button><button class="profile-action purple-button" data-play="${currentEpisodes[0]?.number||1}" ${currentEpisodes.length?'':'disabled'}>Assistir agora</button></section></aside><div class="detail-main"><section class="detail-info-panel"><div class="detail-breadcrumb">Início / Animes / ${esc(selected.title)}</div><h1>${esc(selected.title)}${selected.year?` (${selected.year})`:''}</h1><div class="genre-pills">${tags.map(t=>`<span>${esc(genreLabel(t))}</span>`).join('')}</div><p>${esc(selected.description)}</p></section><section class="detail-episodes-panel"><div class="panel-heading"><div><h2>Temporadas e episódios</h2><p>Temporada 1 · ${currentEpisodes.length} disponíveis</p></div><span>Mais antigos primeiro</span></div><label class="episode-toolbar"><span>Buscar</span><input class="episode-search" placeholder="Nome ou número do episódio"/></label><div class="detail-episode-list">${episodeRows||'<div class="episode-empty"><b>Nenhum episódio retornado</b><span>Esta fonte ainda não relacionou episódios a este título.</span></div>'}</div></section><section class="detail-about"><h2>Sobre este anime</h2><p>Dados de catálogo fornecidos pelo AniList e episódios relacionados pelo Kitsu. O AniBR não hospeda vídeos; a reprodução usa as fontes instaladas pelo usuário.</p></section></div></div><section class="detail-related">${sectionTitle('Animes relacionados','Relações reais da obra no AniList')}<div class="related-grid">${related.map(card).join('')}</div></section></div>`);bind();
  relatedRequest.then(items=>{if(version!==renderVersion)return;const grid=document.querySelector('.related-grid')!;if(items===null){grid.innerHTML='<p>Não foi possível consultar relações agora.</p>';return}currentItems.push(...items);grid.innerHTML=items.length?items.map(card).join(''):'<p>Nenhuma relação cadastrada no AniList.</p>';bindCards(grid);grid.querySelectorAll<HTMLImageElement>('img').forEach(img=>imageFallback(img,[img.getAttribute('src')||'',anime.bannerUrl,anime.coverUrl]));});
  const episodeSearch=document.querySelector<HTMLInputElement>('.episode-search');
  const familyPanel=document.createElement('section');familyPanel.className='season-family';familyPanel.innerHTML='<h2>Temporadas desta obra</h2><p>Consultando relações no AniList…</p>';
  document.querySelector('.detail-info-panel')!.after(familyPanel);
  familyRequest.then(family=>{
    if(version!==renderVersion)return;
    if(family===null){familyPanel.innerHTML='<p>Não foi possível consultar outras temporadas agora.</p>';return;}
    if(family.length<2){familyPanel.remove();return;}
    familyPanel.innerHTML=`<header><div><h2>Este anime tem outras temporadas</h2><p>Partes lançadas relacionadas no AniList. Cada uma possui seus próprios episódios e fontes.</p></div><span>${family.length} partes</span></header><div class="season-cards">${family.map(part=>`<button class="season-card ${part.id===anime.id?'current':''}" data-season-anime="${esc(part.id)}">${part.coverUrl?`<img src="${esc(part.coverUrl)}" alt="Capa de ${esc(part.title)}" loading="lazy" decoding="async"/>`:''}<span class="season-card-badge">${part.id===anime.id?'Você está aqui':'Ver temporada'}</span><strong>${esc(part.title)}</strong><small>${part.year||'Ano não informado'} · ${part.episodes?`${part.episodes} episódios previstos`:'Em exibição'}</small></button>`).join('')}</div>`;
    familyPanel.querySelectorAll<HTMLButtonElement>('[data-season-anime]').forEach(button=>{const part=family.find(part=>part.id===button.dataset.seasonAnime)!;button.disabled=part.id===anime.id;button.onclick=()=>{currentItems=[...currentItems.filter(item=>item.id!==part.id),part];navigate('details',part)};const img=button.querySelector<HTMLImageElement>('img');if(img)imageFallback(img,[part.coverUrl,part.bannerUrl])});
  });
  const list=document.querySelector<HTMLElement>('.detail-episode-list')!;
  const pagination=document.createElement('nav');pagination.className='episode-pagination';pagination.setAttribute('aria-label','Paginação de episódios');list.after(pagination);
  const count=document.querySelector<HTMLElement>('.detail-episodes-panel .panel-heading p')!;
  const profileCount=document.querySelector<HTMLElement>('.profile-facts span:last-child')!;
  const watch=document.querySelector<HTMLButtonElement>('.detail-profile-card [data-play]')!;
  const updateAvailable=(available:Episode[],checked:number)=>{
    if(version!==renderVersion)return;
    currentEpisodes=available;
    const term=episodeSearch?.value.trim().toLocaleLowerCase('pt-BR')||'';
    const matches=available.filter(ep=>`${ep.number} ${ep.title}`.toLocaleLowerCase('pt-BR').includes(term));
    const pageCount=Math.max(1,Math.ceil(matches.length/15));episodePage=Math.min(pageCount,Math.max(1,episodePage));
    const visible=matches.slice((episodePage-1)*15,episodePage*15);
    const generation=++episodeGeneration;
    const finished=checked===episodes.length;
    count.textContent=`${available.length} episódios exibidos · ${term?`${matches.length} resultados · `:''}Até 15 por página`;
    profileCount.textContent=`${available.length} exibidos`;
    watch.disabled=!available.length;
    watch.onclick=()=>{if(available[0])openPlayer(available[0].number,available[0].season)};
    const fragment=document.createElement('template');
    fragment.innerHTML=visible.map(ep=>`<article class="detail-episode" data-episode-row data-search="${esc(`${ep.number} ${ep.title}`.toLowerCase())}"><div class="episode-thumb">${ep.thumbnail||anime.bannerUrl||anime.coverUrl?`<img src="${esc(ep.thumbnail||anime.bannerUrl||anime.coverUrl||'')}" alt="Imagem de ${esc(anime.title)} · episódio ${ep.number}" loading="lazy" decoding="async"/>`:''}<span>Temp. ${ep.season} · Ep. ${ep.number}</span></div><div><strong>${esc(ep.title||`Episódio ${ep.number}`)}</strong><small>Exibido no AniList · Vídeo não verificado · Temporada ${ep.season}</small></div><button data-play="${ep.number}" data-season="${ep.season}">Assistir</button></article>`).join('')||`<div class="episode-empty"><b>${term?'Nenhum episódio encontrado':finished?'Nenhum episódio exibido confirmado':'Consultando episódios…'}</b><span>${term?'Busque pelo nome ou número em todos os episódios.':'A disponibilidade de vídeo é consultada nas fontes ao assistir.'}</span></div>`;
    list.replaceChildren(fragment.content);
    list.querySelectorAll<HTMLElement>('[data-play]').forEach(button=>button.onclick=()=>openPlayer(Number(button.dataset.play),Number(button.dataset.season)));
    list.querySelectorAll<HTMLElement>('.detail-episode small').forEach(label=>label.textContent=label.textContent?.replace('Link da fonte acessível','Fonte consultada ao assistir')||'');
    list.querySelectorAll<HTMLImageElement>('img').forEach(img=>{if(!img.dataset.fallbackReady){img.dataset.fallbackReady='true';imageFallback(img,[img.getAttribute('src')||'',anime.bannerUrl,anime.coverUrl])}});
    pagination.innerHTML=`<button class="outline-button" data-episode-prev ${episodePage<=1?'disabled':''}>‹ Anterior</button><span role="status">Página ${episodePage} de ${pageCount} · ${visible.length?`${(episodePage-1)*15+1}–${(episodePage-1)*15+visible.length}`:'0'} de ${matches.length} episódios</span><label>Ir para página<select aria-label="Página de episódios">${Array.from({length:pageCount},(_,i)=>`<option value="${i+1}" ${episodePage===i+1?'selected':''}>${i+1}</option>`).join('')}</select></label><button class="outline-button" data-episode-next ${episodePage>=pageCount?'disabled':''}>Próxima ›</button>`;
    const turnPage=(next:number)=>{episodePage=next;updateAvailable(available,checked);document.querySelector('.detail-episodes-panel')?.scrollIntoView({block:'start'})};
    pagination.querySelector<HTMLButtonElement>('[data-episode-prev]')!.onclick=()=>turnPage(episodePage-1);
    pagination.querySelector<HTMLButtonElement>('[data-episode-next]')!.onclick=()=>turnPage(episodePage+1);
    pagination.querySelector<HTMLSelectElement>('select')!.onchange=e=>turnPage(Number((e.target as HTMLSelectElement).value));
    enhanceDetails(screenContext(),anime,available,()=>version!==renderVersion||generation!==episodeGeneration).catch(()=>{});
  };
  if(episodeSearch)episodeSearch.oninput=()=>{episodePage=1;updateAvailable(episodes,episodes.length)};
  updateAvailable([],0);
  count.textContent='Consultando episódios no AniList…';
  list.innerHTML='<div class="episode-empty"><span>Carregando lista de episódios do AniList…</span></div>';
  try{
    episodes=await episodesRequest;const latest=(await progressRequest)[0];if(version!==renderVersion)return;
    if(latest){const index=episodes.findIndex(ep=>ep.season===latest.season&&ep.number===(latest.completed?latest.episode+1:latest.episode));if(index>=0)episodePage=Math.floor(index/15)+1;}else if(anime.latestEpisode){const index=episodes.findIndex(ep=>ep.number===anime.latestEpisode);if(index>=0)episodePage=Math.floor(index/15)+1;}
    updateAvailable(episodes,episodes.length);
    api.providerEpisodes(anime).then(metadata=>{if(version!==renderVersion)return;episodes=episodes.map(ep=>{const match=metadata.find(item=>item.anime_id===anime.id&&item.season===ep.season&&item.number===ep.number);return match?{...ep,...match}:ep});updateAvailable(episodes,episodes.length)}).catch(()=>{});
    if(!episodes.length)list.innerHTML='<div class="episode-empty"><b>Nenhum episódio exibido confirmado no AniList</b></div>';
  }catch(error){if(version!==renderVersion)return;count.textContent='AniList não respondeu';list.innerHTML='<div class="episode-empty"><b>Não foi possível obter a lista de episódios</b><span></span></div>';list.querySelector('span')!.textContent=error instanceof Error?error.message:String(error);}
}

async function continuePlayback(anime:Anime){
  const saved=anime.resume;if(!saved)return;selected=anime;
  try{
    if(saved.episode_id)currentEpisodes=[{id:saved.episode_id,anime_id:anime.id,season:saved.season,number:saved.episode,title:saved.episode_title,duration:saved.duration||0,thumbnail:anime.bannerUrl||anime.coverUrl||''}];
    else {showToast('Localizando o episódio salvo…');currentEpisodes=await api.episodes(anime,saved.season)}
    await openPlayer(saved.episode,saved.season);
  }catch(error){showToast(error instanceof Error?error.message:'Não foi possível retomar o episódio.')}
}

async function openPlayer(episodeNumber:number,season?:number){
  let episode=currentEpisodes.find(e=>e.anime_id===selected.id&&e.number===episodeNumber&&(season===undefined||e.season===season));
  if(!episode){showToast('Episódio não encontrado nesta fonte.');return}
  const request=++playerRequest,anime=selected;
  const {default:Hls}=await import('hls.js');
  const waiting=document.createElement('div');waiting.className='player-overlay';waiting.innerHTML='<section class="player-shell"><div class="page-loading" role="status"><i></i><span>Buscando servidores para este episódio…</span><button class="outline-button cancel-player">Cancelar</button></div></section>';const waitingShell=waiting.querySelector<HTMLElement>('.player-shell')!;waitingShell.classList.add('player-waiting-shell');const artwork=[...new Set([anime.bannerUrl,anime.coverUrl].filter((url):url is string=>!!url))];if(artwork.length){const image=document.createElement('img');image.className='player-waiting-art';image.alt='';image.src=artwork[0];let candidate=0;image.onerror=()=>{candidate++;if(candidate<artwork.length)image.src=artwork[candidate];else image.remove()};waitingShell.prepend(image)}document.body.appendChild(waiting);
  const cancelWaiting=()=>{playerRequest++;releaseWaiting();waiting.remove()};const releaseWaiting=activateDialog(waiting,'Buscando fontes do episódio',cancelWaiting);
  waiting.querySelector('.cancel-player')?.addEventListener('click',cancelWaiting);
  let settings,streams,progress;
  let sourceDiagnostics:{source:string;status:string}[]=[];
  try{
    if(episode.id.startsWith('catalog:')){
      const resolved=(await api.providerEpisodes(anime,episode.season)).find(item=>item.anime_id===anime.id&&item.season===episode!.season&&item.number===episodeNumber);
      if(!resolved)throw new Error('A fonte não relacionou este episódio à temporada correta.');
      episode=resolved;
    }
    settings=await api.getSettings();
    const audio=settings.language.toLowerCase()==='dublado'?'dublado':'legendado';
    const [report,saved]=await Promise.all([api.streamReport(anime,episode,audio),api.getProgress(anime,episode)]);
    streams=report.streams;sourceDiagnostics=report.sources;progress=saved;
  }catch(error){releaseWaiting();waiting.remove();if(request===playerRequest)showToast(error instanceof Error?error.message:typeof error==='string'?error.replace(/https?:\/\/\S+/g,'[fonte]'):'A fonte não retornou um vídeo para este episódio.');return}
  releaseWaiting();waiting.remove();if(request!==playerRequest||selected.id!==anime.id||selected.provider!==anime.provider)return;
  const preference=normalizeQuality(settings.quality),language=settings.language.toLowerCase()==='dublado'?'dublado':'legendado';
  const diagnosticMarkup=`<details class="source-diagnostics"><summary>${sourceDiagnostics.length} fontes consultadas</summary>${sourceDiagnostics.map(item=>`<p><b>${esc(item.source)}</b><span>${esc(item.status)}</span></p>`).join('')}</details>`;
  if(!streams.length){showSourceRequired(episode.number,episode.season);const section=document.querySelector('.source-required section');if(section){section.querySelector('h2')!.textContent='Nenhuma fonte retornou vídeo ou torrent compatível';section.querySelector('p')!.textContent='Veja abaixo o resultado das fontes. Avisos de bloqueio não são episódios e foram descartados.';section.insertAdjacentHTML('beforeend',diagnosticMarkup)}return}
  let previous=currentEpisodes.filter(e=>e.number<episode.number).at(-1),next=currentEpisodes.find(e=>e.number>episode.number);
  const serverButtons=groupServers(streams).map(group=>`<h4 class="server-group-heading">${esc(group.label)}<span>${group.items.length}</span></h4>${group.items.map(({source,index:i})=>`<button class="${i===0?'active':''}" data-stream="${i}"><span>▷ ${esc(source.source||`Servidor ${i+1}`)}<small class="source-identity">${esc(qualityLabel(resolutionFromLabel(source.quality)))} · ${esc(source.format)}</small></span><em>${esc(source.language||'Idioma não informado')}</em></button>`).join('')}`).join('');
  const episodeButtons=currentEpisodes.map(ep=>`<button class="${ep.number===episode.number?'active':''}" data-jump-episode="${ep.number}">${ep.number}</button>`).join('');
  const overlay=document.createElement('div');overlay.className='player-overlay';overlay.innerHTML=`<div class="player-shell"><header><button class="player-close" aria-label="Fechar">←</button><div><b>${esc(selected.title)}</b><small>${esc(episode.title||`Episódio ${episode.number}`)}</small></div><span class="player-status">Preparando servidor…</span></header><div class="video-stage"><video controls playsinline preload="metadata"></video><div class="player-loading"><i></i><span>Preparando episódio</span></div></div><section class="server-panel"><header><div><h3>Servidores</h3><span>${streams.length} ${streams.length===1?'opção disponível':'opções disponíveis'}</span></div><button class="report-source">Ajuda com a reprodução</button></header><div class="server-help"><b>ⓘ Problema neste player?</b><span>Se esta fonte falhar, escolha outro servidor abaixo sem sair do AniBR.</span></div><div class="server-list">${serverButtons}</div></section><section class="player-episodes"><header><h3>Episódios</h3><span>${currentEpisodes.length} eps.</span></header><div>${episodeButtons}</div></section><footer class="episode-navigation"><button class="previous-episode" ${previous?'':'disabled'}>‹ Episódio anterior</button><button class="all-episodes">☷ Todos os episódios</button><button class="next-episode" ${next?'':'disabled'}>Próximo episódio ›</button></footer></div>`;document.body.appendChild(overlay);
  const video=overlay.querySelector('video')!, loading=overlay.querySelector<HTMLElement>('.player-loading')!, status=overlay.querySelector<HTMLElement>('.player-status')!;
  const stage=overlay.querySelector<HTMLElement>('.video-stage')!;
  const fullscreenButton=document.createElement('button');fullscreenButton.className='player-fullscreen';fullscreenButton.type='button';fullscreenButton.setAttribute('aria-label','Entrar em tela cheia');fullscreenButton.title='Tela cheia (F)';fullscreenButton.innerHTML='<span aria-hidden="true">⛶</span> Tela cheia';
  overlay.querySelector('.player-shell > header')!.appendChild(fullscreenButton);
  const exitFullscreenButton=document.createElement('button');exitFullscreenButton.className='fullscreen-exit';exitFullscreenButton.type='button';exitFullscreenButton.setAttribute('aria-label','Sair da tela cheia');exitFullscreenButton.textContent='⛶ Sair da tela cheia';stage.appendChild(exitFullscreenButton);
  let restoreWindowFullscreen:(()=>Promise<void>)|undefined,lastFullscreenExit=0;
  const restoreNativeFullscreen=async()=>{const restore=restoreWindowFullscreen;restoreWindowFullscreen=undefined;if(restore)await restore().catch(()=>{})};
  const fullscreenChanged=()=>{if(!document.fullscreenElement){lastFullscreenExit=Date.now();restoreNativeFullscreen()}};
  document.addEventListener('fullscreenchange',fullscreenChanged);
  const toggleFullscreen=async()=>{try{if(document.fullscreenElement){await document.exitFullscreen();await restoreNativeFullscreen()}else {if(window.__TAURI_INTERNALS__){const nativeWindow=getCurrentWindow();const wasFullscreen=await nativeWindow.isFullscreen();restoreWindowFullscreen=()=>nativeWindow.setFullscreen(wasFullscreen);await nativeWindow.setFullscreen(true)}await stage.requestFullscreen()}}catch{await restoreNativeFullscreen();showToast('Não foi possível ativar a tela cheia nesta janela.')}};
  fullscreenButton.onclick=toggleFullscreen;exitFullscreenButton.onclick=toggleFullscreen;
  overlay.querySelector('.player-episodes')!.remove();
  const episodeSelector=document.createElement('label');episodeSelector.className='player-episode-select';episodeSelector.innerHTML='<span>Episódio</span><select aria-label="Escolher episódio"></select>';
  overlay.querySelector('.episode-navigation .all-episodes')!.before(episodeSelector);
  const refreshEpisodeSelector=()=>{const select=episodeSelector.querySelector('select')!;select.innerHTML=currentEpisodes.map(ep=>`<option value="${ep.number}" ${ep.number===episode.number?'selected':''}>Episódio ${ep.number}</option>`).join('');};refreshEpisodeSelector();
  overlay.querySelector('.server-help > span')!.textContent='Se esta fonte falhar, escolha outro servidor neste painel sem sair do AniBR.';
  overlay.querySelector('.server-help')!.insertAdjacentHTML('afterend',diagnosticMarkup);
  const qualityControl=document.createElement('label');qualityControl.className='player-quality';qualityControl.innerHTML='<span>Qualidade</span><select aria-label="Qualidade do vídeo"></select>';overlay.querySelector('.player-shell > header')!.appendChild(qualityControl);
  const qualitySelect=qualityControl.querySelector('select')!;
  const extra=document.createElement('div');extra.className='player-extra-controls';extra.innerHTML='<label>Velocidade<select aria-label="Velocidade de reprodução"><option value="0.5">0,5×</option><option value="0.75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="1.75">1,75×</option><option value="2">2×</option></select></label><label hidden>Áudio<select aria-label="Faixa de áudio"></select></label><label hidden>Legendas<select aria-label="Faixa de legendas"></select></label><details class="player-shortcuts"><summary>Atalhos</summary><p>Espaço/K: pausar · ←/→: 10 segundos · ↑/↓: volume · M: silenciar · F: tela cheia · Esc: sair</p></details><button class="outline-button retry-stream">Tentar fonte novamente</button>';overlay.querySelector('.server-panel')!.appendChild(extra);
  const speed=extra.querySelector<HTMLSelectElement>('[aria-label="Velocidade de reprodução"]')!;speed.value=String(readStored('anibr-playback-speed',1));if(!speed.value)speed.value='1';video.playbackRate=Number(speed.value);speed.onchange=()=>{video.playbackRate=Number(speed.value);localStorage.setItem('anibr-playback-speed',speed.value)};
  const audio=extra.querySelector<HTMLSelectElement>('[aria-label="Faixa de áudio"]')!,subtitles=extra.querySelector<HTMLSelectElement>('[aria-label="Faixa de legendas"]')!;
  const refreshTracks=()=>{
    const audioTracks=hls?.audioTracks||[];audio.parentElement!.hidden=audioTracks.length<2;audio.innerHTML=audioTracks.map((t,i)=>`<option value="${i}">${esc(t.name||t.lang||`Faixa ${i+1}`)}</option>`).join('');if(hls)audio.value=String(hls.audioTrack);
    const subtitleTracks=hls?.subtitleTracks||Array.from(video.textTracks).map(t=>({name:t.label,lang:t.language}));subtitles.parentElement!.hidden=!subtitleTracks.length;subtitles.innerHTML='<option value="-1">Desativadas</option>'+subtitleTracks.map((t,i)=>`<option value="${i}">${esc(t.name||t.lang||`Legenda ${i+1}`)}</option>`).join('');if(hls)subtitles.value=String(hls.subtitleTrack);
  };
  audio.onchange=()=>{if(hls)hls.audioTrack=Number(audio.value)};subtitles.onchange=()=>{if(hls)hls.subtitleTrack=Number(subtitles.value);else Array.from(video.textTracks).forEach((t,i)=>t.mode=i===Number(subtitles.value)?'showing':'disabled')};video.textTracks.addEventListener('addtrack',refreshTracks);
  const streamKey=(index:number)=>serverKey(streams[index]);
  let hls:Hls|null=null,lastSaved=-1,closing=false,activeStream=0,ready=false,saveQueue:Promise<void>=Promise.resolve();
  let torrentId:number|undefined,torrentTimer:number|undefined,streamVersion=0,torrentFile:number|undefined,torrentFileBytes=0;
  const torrentInfo=document.createElement('small');torrentInfo.className='torrent-info';torrentInfo.hidden=true;overlay.querySelector('.server-panel')!.prepend(torrentInfo);
  const stopTorrent=async()=>{if(torrentTimer!==undefined)clearInterval(torrentTimer);torrentTimer=undefined;const id=torrentId;torrentId=undefined;torrentInfo.hidden=true;if(id!==undefined)await api.stopTorrent(id).catch(()=>{})};
  let resumeAt=progress&&!progress.completed?progress.timestamp:0;
  const actualQuality=()=>{const w=video.videoWidth,h=video.videoHeight;if(w>=3840&&h>0&&h<2160)return `4K (${w}×${h})`;return qualityLabel(h||resolutionFromLabel(streams[activeStream].quality))};
  const updateStatus=()=>{status.textContent=`Servidor ${activeStream+1} · ${actualQuality()} · ${streams[activeStream].language||'Idioma não informado'}`};
  const save=async(completed=false,force=false)=>{if(!ready||!Number.isFinite(video.currentTime)||video.currentTime<0)return;const second=Math.floor(video.currentTime);if(!force&&!completed&&Math.abs(second-lastSaved)<5)return;lastSaved=second;const entry:ProgressEntry={anime_id:anime.id,anime_title:anime.title,provider:anime.provider||'multi',season:episode.season,episode:episode.number,episode_title:episode.title||`Episódio ${episode.number}`,language:streams[activeStream].language||'Idioma não informado',quality:actualQuality(),timestamp:second,completed,duration:Number.isFinite(video.duration)?Math.floor(video.duration):0,episode_id:episode.id,stream_key:streamKey(activeStream),cover_url:anime.coverUrl||'',banner_url:anime.bannerUrl||''};saveQueue=saveQueue.catch(()=>{}).then(()=>api.saveProgress(entry));try{await saveQueue}catch(error){lastSaved=-1;throw error}};
  let releaseDialog=()=>{};
  const close=async()=>{if(closing)return;closing=true;streamVersion++;if(document.fullscreenElement===stage)await document.exitFullscreen().catch(()=>{});await restoreNativeFullscreen();await save(false,true).catch(()=>showToast('Não foi possível salvar o progresso.'));ready=false;hls?.destroy();video.pause();video.removeAttribute('src');video.load();await stopTorrent();releaseDialog();overlay.remove();document.removeEventListener('keydown',playerKeys);document.removeEventListener('fullscreenchange',fullscreenChanged)};
  releaseDialog=activateDialog(overlay,`${anime.title} — ${episode.title}`,()=>{if(Date.now()-lastFullscreenExit>=300)close()});
  const playerKeys=(event:KeyboardEvent)=>{if(event.ctrlKey||event.altKey||event.metaKey||(event.target as HTMLElement)?.closest('input,select,textarea,button,summary,[contenteditable]'))return;const key=event.key.toLowerCase();if(key==='f'){event.preventDefault();toggleFullscreen()}else if(key===' '||key==='k'){event.preventDefault();video.paused?video.play().catch(()=>{}):video.pause()}else if(key==='arrowright'||key==='arrowleft'){event.preventDefault();video.currentTime=Math.max(0,Math.min(Number.isFinite(video.duration)?video.duration:Infinity,video.currentTime+(key==='arrowright'?10:-10)))}else if(key==='m'){event.preventDefault();video.muted=!video.muted}else if(key==='arrowup'||key==='arrowdown'){event.preventDefault();video.volume=Math.max(0,Math.min(1,video.volume+(key==='arrowup'?.1:-.1)))}};document.addEventListener('keydown',playerKeys);
  episodeSelector.querySelector('select')!.onchange=async e=>{const number=Number((e.target as HTMLSelectElement).value);if(number===episode.number)return;await close();openPlayer(number,episode.season)};
  overlay.querySelector('.player-close')?.addEventListener('click',async()=>{await close();if(page==='home'||page==='history')render()});overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  const configureSourceQualities=()=>{qualitySelect.innerHTML=streams.map((stream,i)=>`<option value="source:${i}">Servidor ${i+1} · ${esc(qualityLabel(resolutionFromLabel(stream.quality)))}</option>`).join('');qualitySelect.value=`source:${activeStream}`;qualitySelect.disabled=streams.length<2};
  const attachStream=async(index:number)=>{
    const stream=streams[index];if(!stream)return;
    const version=++streamVersion;
    try{
      await stopTorrent();if(closing||version!==streamVersion)return;
      stage.querySelector('.torrent-picker')?.remove();
      if(ready&&video.currentTime>0){resumeAt=video.currentTime;save(false,true)}ready=false;activeStream=index;
      hls?.destroy();hls=null;video.pause();video.removeAttribute('src');video.load();
      refreshTracks();
      loading.style.display='grid';loading.classList.remove('error');loading.querySelector('span')!.textContent='Preparando episódio';
      status.textContent=`Servidor ${index+1} · ${qualityLabel(resolutionFromLabel(stream.quality))} · ${stream.language||language}`;
      overlay.querySelectorAll<HTMLElement>('[data-stream]').forEach(button=>button.classList.toggle('active',Number(button.dataset.stream)===index));configureSourceQualities();
      if(stream.format==='Torrent'){
        torrentInfo.hidden=false;torrentInfo.textContent='P2P · upload desativado · arquivos guardados no cache local';
        loading.querySelector('span')!.textContent='Obtendo metadados do torrent… pode demorar se não houver peers';
        const prepared=await api.prepareTorrent(stream.url);
        if(closing||version!==streamVersion){await api.stopTorrent(prepared.id).catch(()=>{});return;}
        torrentId=prepared.id;
        const selectionKey=`anipt-torrent-file:${anime.id}:${episode.id}:${streamKey(index)}`;
        const savedIndex=localStorage.getItem(selectionKey);
        let file=prepared.files.find(file=>file.index===(stream.torrent_file_index??(savedIndex===null?-1:Number(savedIndex))));
        if(!file&&prepared.files.length===1)file=prepared.files[0];
        if(!file){
          loading.style.display='none';
          const picker=document.createElement('section');picker.className='torrent-picker';picker.innerHTML=`<h3>Escolha o arquivo deste episódio</h3><p>Este torrent tem vários vídeos. Confira temporada e episódio antes de escolher.</p>${prepared.files.map(file=>`<button data-torrent-file="${file.index}"><span>${esc(file.name)}</span><small>${(file.bytes/1024/1024).toFixed(0)} MB</small></button>`).join('')}`;stage.appendChild(picker);
          const chosen=await new Promise<number|undefined>(resolve=>{const timer=window.setInterval(()=>{if(closing||version!==streamVersion){clearInterval(timer);resolve(undefined)}},200);picker.querySelectorAll<HTMLElement>('[data-torrent-file]').forEach(button=>button.onclick=()=>{clearInterval(timer);resolve(Number(button.dataset.torrentFile))})});
          picker.remove();if(chosen===undefined)return;file=prepared.files.find(file=>file.index===chosen);
        }
        if(!file)throw new Error('Arquivo de vídeo não selecionado');
        localStorage.setItem(selectionKey,String(file.index));
        torrentFile=file.index;torrentFileBytes=file.bytes;
        loading.style.display='grid';loading.querySelector('span')!.textContent='Buffering do torrent…';
        const playback=await api.startTorrent(prepared.id,file.index);
        if(closing||version!==streamVersion){await api.stopTorrent(prepared.id).catch(()=>{});return;}
        video.src=playback.url;
        const updateTorrent=async()=>{if(torrentId!==prepared.id)return;try{const stats=await api.torrentStats(prepared.id);if(closing||version!==streamVersion)return;const bytes=stats.file_progress?.[torrentFile!]||0;const percent=torrentFileBytes?Math.min(100,Math.floor(bytes/torrentFileBytes*100)):0;torrentInfo.textContent=`P2P · cache ${percent}% · upload desativado`;if(stats.error){loading.style.display='grid';loading.classList.add('error');loading.querySelector('span')!.textContent='O torrent falhou ou ficou sem peers. Escolha outra fonte.'}}catch{}};
        torrentTimer=window.setInterval(updateTorrent,2000);updateTorrent();
      }else if(stream.is_hls||stream.url.includes('.m3u8')){
        if(Hls.isSupported()){
          const engine=new Hls({enableWorker:true,capLevelToPlayerSize:false});hls=engine;
          engine.on(Hls.Events.MANIFEST_PARSED,()=>{
            if(hls!==engine||closing)return;
            const heights=engine.levels.map(level=>resolutionFromDimensions(level.width,level.height));
            qualitySelect.innerHTML='<option value="auto">Automática</option>'+heights.map((height,i)=>`<option value="level:${i}">${esc(qualityLabel(height))}</option>`).join('');qualitySelect.disabled=false;
            const preferred=preferredQualityIndex(heights,preference);engine.currentLevel=preferred;qualitySelect.value=preferred<0?'auto':`level:${preferred}`;
            video.play().catch(()=>{});
            refreshTracks();
          });
          engine.on(Hls.Events.AUDIO_TRACKS_UPDATED,refreshTracks);engine.on(Hls.Events.SUBTITLE_TRACKS_UPDATED,refreshTracks);
          engine.on(Hls.Events.LEVEL_SWITCHED,updateStatus);
          engine.on(Hls.Events.ERROR,(_e,data)=>{if(data.fatal&&hls===engine){ready=false;status.textContent=`Servidor ${index+1} falhou`;loading.style.display='grid';loading.classList.add('error');loading.querySelector('span')!.textContent='Escolha outro servidor no painel à direita.'}});
          engine.loadSource(stream.url);engine.attachMedia(video);
        }else if(video.canPlayType('application/vnd.apple.mpegurl'))video.src=stream.url;else throw new Error('HLS não compatível');
      }else video.src=stream.url;
    }catch(error){if(closing||version!==streamVersion)return;await stopTorrent();status.textContent='Não foi possível reproduzir';loading.style.display='grid';loading.classList.add('error');loading.querySelector('span')!.textContent=error instanceof Error?error.message:'Erro desconhecido'}
  };
  qualitySelect.addEventListener('change',()=>{const value=qualitySelect.value;if(value.startsWith('source:'))attachStream(Number(value.slice(7)));else if(hls)hls.currentLevel=value==='auto'?-1:Number(value.slice(6))});
  extra.querySelector<HTMLButtonElement>('.retry-stream')!.onclick=()=>attachStream(activeStream);
  video.addEventListener('loadedmetadata',()=>{if(resumeAt>0&&(!Number.isFinite(video.duration)||resumeAt<video.duration-15))video.currentTime=resumeAt;resumeAt=0;ready=true;loading.style.display='none';updateStatus();refreshTracks();if(settings.history)setListStatus(anime,'watching');video.play().catch(()=>{})});
  video.addEventListener('resize',updateStatus);
  video.addEventListener('waiting',()=>{if(torrentId!==undefined&&!closing){loading.style.display='grid';loading.querySelector('span')!.textContent='Buffering do torrent… aguardando peças dos peers';}});
  video.addEventListener('playing',()=>{loading.style.display='none';if(!settings.history)return;const checks=readStored<Record<string,{at:string;text:string}>>('anibr-availability',{});checks[`${animeKey(anime)}:${episode.season}:${episode.number}`]={at:new Date().toISOString(),text:`Reprodução iniciada · ${streams[activeStream].language||'Idioma não informado'}`};localStorage.setItem('anibr-availability',JSON.stringify(checks))});
  video.addEventListener('timeupdate',()=>{save(false).catch(()=>showToast('Não foi possível salvar o progresso.'))});video.addEventListener('pause',()=>save(false,true).catch(()=>showToast('Não foi possível salvar o progresso.')));video.addEventListener('ended',async()=>{await save(true,true).catch(()=>showToast('Não foi possível salvar a conclusão do episódio.'));ready=false;await stopTorrent();status.textContent='Episódio concluído';if(settings.auto_next&&next){await close();await openPlayer(next.number,next.season)}else if(next){const button=document.createElement('button');button.className='purple-button';button.textContent='Assistir próximo episódio';button.onclick=async()=>{await close();openPlayer(next!.number,next!.season)};stage.appendChild(button)}});
  video.addEventListener('error',()=>{ready=false;loading.style.display='grid';loading.classList.add('error');loading.querySelector('span')!.textContent=streams[activeStream].format==='Torrent'?'Este arquivo ou codec não é compatível com o player interno. A transferência foi pausada; escolha outra versão.':'Este servidor retornou um vídeo indisponível ou incompatível. Escolha outra opção.';stopTorrent()});
  overlay.querySelectorAll<HTMLElement>('[data-stream]').forEach(button=>button.onclick=()=>attachStream(Number(button.dataset.stream)));
  overlay.querySelectorAll<HTMLElement>('[data-jump-episode]').forEach(button=>button.onclick=async()=>{await close();openPlayer(Number(button.dataset.jumpEpisode))});
  overlay.querySelector('.previous-episode')?.addEventListener('click',async()=>{if(!previous)return;await close();openPlayer(previous.number)});overlay.querySelector('.next-episode')?.addEventListener('click',async()=>{if(!next)return;await close();openPlayer(next.number)});overlay.querySelector('.all-episodes')?.addEventListener('click',async()=>{await close();navigate('details',anime)});overlay.querySelector('.report-source')?.addEventListener('click',()=>showToast('Selecione outro servidor à direita ou confira suas fontes nas configurações.'));
  if(anime.resume?.episode_id&&currentEpisodes.length===1)api.episodes(anime,episode.season).then(episodes=>{if(closing||request!==playerRequest)return;currentEpisodes=episodes;previous=episodes.filter(e=>e.number<episode.number).at(-1);next=episodes.find(e=>e.number>episode.number);overlay.querySelector<HTMLButtonElement>('.previous-episode')!.disabled=!previous;overlay.querySelector<HTMLButtonElement>('.next-episode')!.disabled=!next;refreshEpisodeSelector()}).catch(()=>{});
  const previousServer=progress?.stream_key?streams.findIndex((_,i)=>streamKey(i)===progress.stream_key):-1;
  const matchingAudio=streams.map((stream,index)=>({stream,index})).filter(item=>item.stream.language.toLowerCase()===language);
  const candidates=matchingAudio.length?matchingAudio:streams.map((stream,index)=>({stream,index}));
  const candidateIndex=Math.max(0,preferredQualityIndex(candidates.map(item=>resolutionFromLabel(item.stream.quality)),preference));
  attachStream(previousServer>=0?previousServer:candidates[candidateIndex].index);
}
function showSourceRequired(number:number,season:number){
  document.querySelector('.source-required')?.remove();const overlay=document.createElement('div');overlay.className='source-required';overlay.innerHTML='<section><button class="source-close" aria-label="Fechar">×</button><h2>Falta uma fonte de reprodução</h2><p>O catálogo encontrou esta obra, mas nenhuma fonte retornou mídia compatível com o episódio. Consulte o diagnóstico ou instale uma fonte compatível.</p><div><button class="outline-button source-dismiss">Agora não</button><button class="purple-button source-settings">Configurar fontes</button><button class="outline-button source-retry">Tentar novamente</button></div><small>Exibição no catálogo não garante vídeo disponível.</small></section>';document.body.appendChild(overlay);let release=()=>{};const close=()=>{release();overlay.remove()};release=activateDialog(overlay,'Fontes de reprodução',close);overlay.querySelector('.source-close')?.addEventListener('click',close);overlay.querySelector('.source-dismiss')?.addEventListener('click',close);overlay.querySelector('.source-settings')?.addEventListener('click',()=>{close();navigate('settings')});overlay.querySelector('.source-retry')?.addEventListener('click',()=>{close();api.clearCatalogCache();openPlayer(number,season)});overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
}
function showToast(message:string){const old=document.querySelector('.toast');old?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);el.setAttribute('role','status');el.setAttribute('aria-live','polite');setTimeout(()=>el.remove(),Math.min(14000,Math.max(6000,message.length*65)))}

async function renderSettings(version=renderVersion){await settingsScreen(screenContext(),()=>version!==renderVersion);}

function bindCards(root:ParentNode=document){
  root.querySelectorAll<HTMLElement>('[data-id],[data-open]').forEach(el=>{const open=()=>{const id=el.dataset.id||el.dataset.open,provider=el.dataset.provider;const historyIndex=el.closest<HTMLElement>('[data-history-index]')?.dataset.historyIndex;const anime=historyIndex!==undefined?currentItems[Number(historyIndex)]:currentItems.find(a=>a.id===id&&(!provider||a.provider===provider)&&(!el.dataset.releaseEpisode||a.latestEpisode===Number(el.dataset.releaseEpisode))&&(!el.dataset.resume||!!a.resume));if(!anime)return;if(el.dataset.resume){continuePlayback(anime);return}navigate('details',anime)};el.onclick=e=>{e.preventDefault();open()};el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}}});
  root.querySelectorAll<HTMLButtonElement>('[data-card-fav]').forEach(button=>button.onclick=async e=>{e.preventDefault();e.stopPropagation();const anime=currentItems.find(a=>a.id===button.dataset.cardFav&&(a.provider||'multi')===button.dataset.provider);if(!anime)return;try{await api.toggleFavorite(anime);if(anime.favorite)favoriteKeys.add(animeKey(anime));else favoriteKeys.delete(animeKey(anime));root.querySelectorAll<HTMLButtonElement>('[data-card-fav]').forEach(b=>{if(b.dataset.cardFav===anime.id&&b.dataset.provider===(anime.provider||'multi')){b.textContent=anime.favorite?'♥':'♡';b.setAttribute('aria-pressed',String(!!anime.favorite));b.setAttribute('aria-label',`${anime.favorite?'Remover dos favoritos':'Favoritar'} ${anime.title}`)}});showToast(anime.favorite?'Adicionado aos favoritos.':'Removido dos favoritos.')}catch{showToast('Não foi possível atualizar os favoritos.')}});
}

function bind(){
  bindCards();
  document.querySelectorAll<HTMLImageElement>('#app img').forEach(img=>{
    const owner=currentItems.find(a=>img.alt===`Capa de ${a.title}`||img.alt===`Cena de ${a.title}`||a.coverUrl===img.getAttribute('src')||a.bannerUrl===img.getAttribute('src'))||(img.closest('.detail-page')?selected:undefined);
    imageFallback(img,[img.getAttribute('src')||'',owner?.bannerUrl,owner?.coverUrl]);
  });
  document.querySelectorAll<HTMLElement>('[data-page]').forEach(el=>el.onclick=()=>navigate(el.dataset.page as Page));
  document.querySelectorAll<HTMLAnchorElement>('[data-external]').forEach(link=>link.onclick=e=>{e.preventDefault();api.openExternal(link.href).catch(()=>showToast('Não foi possível abrir o link.'))});
  document.querySelectorAll<HTMLElement>('[data-genre],[data-sort],[data-year]').forEach(button=>button.onclick=()=>{remember();query='';catalogFilters={page:1,sort:button.dataset.sort||'POPULARITY_DESC',isAdult:false};if(button.dataset.genre)catalogFilters.genre_in=[button.dataset.genre];if(button.dataset.year)catalogFilters.seasonYear=Number(button.dataset.year);page='catalog';render()});
  document.querySelectorAll<HTMLElement>('[data-play]').forEach(el=>el.onclick=()=>openPlayer(Number(el.dataset.play)));
  const back=$('.back');if(back)back.onclick=goBack;const fav=$('[data-fav]');if(fav)fav.onclick=async()=>{try{await api.toggleFavorite(selected);render()}catch{showToast('Não foi possível atualizar os favoritos.')}};
  const menu=$('.menu'),nav=$('#primary-nav');if(menu)menu.onclick=()=>{const expanded=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!expanded));nav?.classList.toggle('open',!expanded)};
  const explore=$('.explore-toggle');if(explore){explore.setAttribute('aria-expanded',String(!!explore.closest('.explore-wrap')?.classList.contains('expanded')));explore.onclick=()=>{const expanded=explore.getAttribute('aria-expanded')==='true';explore.setAttribute('aria-expanded',String(!expanded));explore.closest('.explore-wrap')?.classList.toggle('expanded',!expanded)};explore.onkeydown=e=>{if(e.key==='Escape'){explore.setAttribute('aria-expanded','false');explore.closest('.explore-wrap')?.classList.remove('expanded')}}}
  const planned=$('[data-plan]');if(planned)planned.onclick=()=>{if(library()[animeKey(selected)]){navigate('library');return}setListStatus(selected,'planned');planned.textContent='Na lista: Quero assistir';showToast('Adicionado à Minha lista.')};
  const search=document.querySelector<HTMLInputElement>('.top-search input');if(search){search.oninput=()=>{query=search.value;renderVersion++;window.clearTimeout(searchTimer);searchTimer=window.setTimeout(()=>{catalogFilters={...catalogFilters,page:1,search:query};page=query?'search':'home';render()},450)};search.onkeydown=e=>{if(e.key==='Enter'){window.clearTimeout(searchTimer);catalogFilters={...catalogFilters,page:1,search:query};page='search';render()}}}


}
document.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='k'&&!document.querySelector('[aria-modal="true"]')){e.preventDefault();document.querySelector<HTMLInputElement>('.top-search input')?.focus()}});
api.getSettings().then(settings=>document.documentElement.dataset.density=settings.density).catch(()=>{});
const notify=()=>notifyFollowed({toast:showToast}).catch(()=>{});
welcome().then(()=>{render();notify();window.setInterval(notify,5*60*1000)});
