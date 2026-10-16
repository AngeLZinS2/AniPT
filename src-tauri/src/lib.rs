mod config;
mod database;
mod episode_ids;
mod models;
mod player;
mod provider;
mod stream_identity;
mod torrent;
mod translation;
use database::Database;
use models::*;
use std::sync::RwLock;
use tauri::State;
pub struct AppState {
    config: RwLock<config::Config>,
    db: Database,
}

#[tauri::command]
fn get_config(s: State<AppState>) -> Result<config::Config, String> {
    s.config
        .read()
        .map(|x| x.clone())
        .map_err(|_| "config lock poisoned".into())
}
#[tauri::command]
fn update_config(cfg: config::Config, s: State<AppState>) -> Result<(), String> {
    if !(1..=256).contains(&cfg.cache_quota_gb) {return Err("A quota de cache deve estar entre 1 e 256 GB.".into());}
    if !["comfortable","compact"].contains(&cfg.density.as_str()){return Err("Densidade inválida".into());}
    config::save(&cfg)?;
    *s.config
        .write()
        .map_err(|_| "config lock poisoned".to_string())? = cfg;
    Ok(())
}
#[tauri::command]
async fn search_anime(
    query: String,
    provider: Option<String>,
    s: State<'_, AppState>,
) -> Result<Vec<Anime>, String> {
    let p = provider.unwrap_or_else(|| s.config.read().unwrap().provider.clone());
    let addons = s.config.read().map_err(|_| "config lock poisoned".to_string())?.addons.clone();
    let r = provider::search(&query, &p, &addons).await?;
    s.db.save_search(&query, &p)?;
    Ok(r)
}
#[tauri::command]
async fn recent_releases() -> Result<Vec<Anime>, String> {
    provider::recent_releases().await
}
#[tauri::command]
async fn anilist_home() -> Result<HomeFeeds, String> {
    provider::anilist_home().await
}
#[tauri::command]
async fn query_anilist(query: String, variables: serde_json::Value) -> Result<serde_json::Value, String> {
    provider::query_anilist(&query, variables).await
}
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !["https://github.com/AngeLZinS2/AniPT","https://www.linkedin.com/in/angelo-neri-3921a72b9/"].contains(&url.as_str()) {
        return Err("Link externo não permitido".into());
    }
    std::process::Command::new("explorer.exe").arg(url).spawn().map(|_|()).map_err(|e|e.to_string())
}
#[tauri::command]
async fn get_seasons(anime_id: String, provider: String) -> Result<Vec<Season>, String> {
    provider::seasons(&anime_id, &provider).await
}
#[tauri::command]
async fn get_episodes(
    anime_id: String,
    season: i64,
    provider: String,
) -> Result<Vec<Episode>, String> {
    provider::episodes(&anime_id, season, &provider).await
}
#[tauri::command]
async fn get_streams(
    anime_id: String,
    episode_id: String,
    season: i64,
    episode_number: f64,
    language: String,
    provider: String,
    s: State<'_, AppState>,
) -> Result<StreamResolution, String> {
    episode_ids::validate_requested_episode(&episode_id,season,episode_number)?;
    provider::validate_episode_identity(&anime_id,&episode_id).await?;
    let identity=provider::stream_season_identity(&anime_id).await?;
    let kind = provider.rsplit_once('|').map(|(_, kind)| kind).unwrap_or("anime");
    let mut addons = s.config.read().map_err(|_| "config lock poisoned".to_string())?.addons.clone();
    if let Some(spec)=provider.strip_prefix("addon:"){let base=spec.rsplit_once('|').map(|(base,_)|base).unwrap_or(spec);if !addons.iter().any(|item|item==base){addons.push(base.into());}}
    addons.sort_by_key(|url| if url.contains("animesub.duckdns.org") { 0 } else { 1 });
    addons.dedup();
    let mapped_episode=Ok(provider::verified_episode_mapping(&episode_id,season,episode_number).await?);
    let mut resolution=StreamResolution{streams:Vec::new(),sources:Vec::new()};
    if !provider.starts_with("addon:") {
        if let Ok(streams)=provider::streams(&episode_id,&language,&provider).await {resolution.streams.extend(streams);}
    }
    for batch in addons.chunks(4) {
        let tasks=batch.iter().map(|base|{
            let base=base.clone();let preferred=kind.to_string();let episode=episode_id.clone();let identity=identity.clone();let mapped_episode=mapped_episode.clone();
            tauri::async_runtime::spawn(async move {
                let host=reqwest::Url::parse(&base).ok().and_then(|url|url.host_str().map(str::to_string)).unwrap_or("Fonte externa".into());
                match provider::resolve_addon_episode(&base,&preferred,&episode,&mapped_episode,identity.as_ref(),season,episode_number).await {
                    Ok((streams,rejected))=>{let torrents=streams.iter().filter(|s|s.format=="Torrent").count();let mut status=if streams.is_empty(){"Respondeu sem opções compatíveis para este episódio".into()}else{format!("{} vídeos diretos · {} torrents",streams.len()-torrents,torrents)};let pending=streams.iter().filter(|stream|stream.requires_file_selection).count();if pending>0{status.push_str(&format!(" · {pending} pacotes aguardam identificação automática do episódio"));}if rejected>0{status.push_str(&format!(" · {rejected} opções incompatíveis ou sem identificação suficiente descartadas"));}(streams,SourceDiagnostic{source:host,status})},
                    Err(error)=>{let status=if error.contains("aviso de bloqueio"){"Bloqueada por limite de requisições; vídeo de aviso descartado".into()}else{error};(Vec::new(),SourceDiagnostic{source:host,status})}
                }
            })
        }).collect::<Vec<_>>();
        for task in tasks {if let Ok((streams,diagnostic))=task.await {resolution.streams.extend(streams);resolution.sources.push(diagnostic);}}
    }
    deduplicate_streams(&mut resolution.streams);
    Ok(resolution)
}
#[derive(serde::Serialize)]
struct SourceDiagnostic { source:String,status:String }
#[derive(serde::Serialize)]
struct StreamResolution { streams:Vec<StreamSource>,sources:Vec<SourceDiagnostic> }
fn deduplicate_streams(streams:&mut Vec<StreamSource>){
    let mut seen=std::collections::HashSet::new();
    streams.retain(|stream|seen.insert((stream.source.clone(),stream.url.clone(),stream.language.clone(),stream.quality.clone(),stream.torrent_file_index)));
}
#[cfg(test)]
mod source_tests {
    use super::*;
    #[test]
    fn addon_summary_includes_resource_specific_identifiers(){let summary=addon_summary(&serde_json::json!({"name":"Fixture","types":["anime"],"resources":["catalog",{"name":"stream","types":["series"],"idPrefixes":["kitsu:","tt"]}]}));assert_eq!(summary["prefixes"],serde_json::json!(["kitsu:","tt"]));assert_eq!(summary["types"],serde_json::json!(["anime","series"]));assert_eq!(summary["resources"],serde_json::json!(["catalog","stream"]));}
    #[test]
    fn keeps_multiple_sources_and_only_removes_exact_duplicate_options(){
        let make=|source:&str|StreamSource{source:source.into(),url:"https://example.test/ep.mp4".into(),quality:"1080p".into(),language:"Legendado".into(),format:"MP4".into(),is_hls:false,title:String::new(),seeders:None,episode_target:None,requires_file_selection:false,torrent_file_index:None};
        let mut streams=vec![make("Fonte A"),make("Fonte B"),make("Fonte A")];
        deduplicate_streams(&mut streams);
        assert_eq!(streams.len(),2);assert_eq!(streams[0].source,"Fonte A");assert_eq!(streams[1].source,"Fonte B");
    }
}
#[tauri::command]
async fn probe_streams(streams: Vec<StreamSource>) -> bool {
    for batch in streams.chunks(3) {
        let tasks=batch.iter().map(|stream|{let url=stream.url.clone();tauri::async_runtime::spawn(async move{provider::video_available(&url).await})}).collect::<Vec<_>>();
        for task in tasks { if task.await.unwrap_or(false){return true;} }
    }
    false
}
#[tauri::command]
fn list_favorites(s: State<AppState>) -> Result<Vec<Favorite>, String> {
    s.db.favorites()
}
#[tauri::command]
fn add_favorite(favorite: Favorite, s: State<AppState>) -> Result<(), String> {
    s.db.add_favorite(&favorite)
}
#[tauri::command]
fn remove_favorite(anime_id: String, provider: String, s: State<AppState>) -> Result<(), String> {
    s.db.remove_favorite(&anime_id, &provider)
}
#[tauri::command]
fn list_history(limit: Option<i64>, s: State<AppState>) -> Result<Vec<HistoryEntry>, String> {
    s.db.history(limit.unwrap_or(100).clamp(1, 1000))
}
#[tauri::command]
fn add_history(entry: HistoryEntry, s: State<AppState>) -> Result<(), String> {
    if !s.config.read().map_err(|_|"Configuração indisponível")?.history{return Ok(());}
    s.db.add_history(&entry)
}
#[tauri::command]
fn save_progress(entry: HistoryEntry, s: State<AppState>) -> Result<(), String> {
    if !s.config.read().map_err(|_|"Configuração indisponível")?.history{return Ok(());}
    s.db.save_progress(&entry)
}
#[tauri::command]
fn remove_progress(anime_id:String,provider:String,season:Option<i64>,episode:Option<f64>,s:State<AppState>)->Result<(),String>{s.db.remove_progress(&anime_id,&provider,season,episode)}
#[tauri::command]
fn export_progress(s:State<AppState>)->Result<Vec<HistoryEntry>,String>{s.db.history(100000)}
#[tauri::command]
fn list_anime_progress(anime_id:String,provider:String,s:State<AppState>)->Result<Vec<HistoryEntry>,String>{s.db.anime_progress(&anime_id,&provider)}
#[tauri::command]
fn import_progress(entries:Vec<HistoryEntry>,s:State<AppState>)->Result<(),String>{
    if entries.len()>100000||entries.iter().any(|e|e.anime_id.is_empty()||e.provider.is_empty()||e.season<1||!e.episode.is_finite()||e.episode<=0.0||e.timestamp<0||e.duration<0){return Err("Progresso importado inválido".into());}
    s.db.import_user_data(&entries,&[])
}
#[tauri::command]
fn import_user_data(entries:Vec<HistoryEntry>,favorites:Vec<Favorite>,s:State<AppState>)->Result<(),String>{
    if entries.len()>100000||favorites.len()>10000||entries.iter().any(|e|e.anime_id.is_empty()||e.provider.is_empty()||e.season<1||!e.episode.is_finite()||e.episode<=0.0||e.timestamp<0||e.duration<0)||favorites.iter().any(|f|f.anime_id.is_empty()||f.provider.is_empty()){return Err("Backup inválido".into());}
    s.db.import_user_data(&entries,&favorites)
}
#[tauri::command]
fn data_location(s:State<AppState>)->Result<String,String>{Ok(format!("Configuração: {} · Histórico e favoritos: {} · Lista e sinopses: armazenamento local do WebView.",config::app_dir().display(),s.config.read().map_err(|_|"Configuração indisponível")?.database_path))}
fn addon_summary(manifest:&serde_json::Value)->serde_json::Value{
    let resources:Vec<String>=manifest.get("resources").and_then(|v|v.as_array()).into_iter().flatten().filter_map(|v|v.as_str().or_else(||v.get("name").and_then(|n|n.as_str()))).map(str::to_owned).collect();
    let collect=|key:&str|{let mut values:Vec<String>=manifest.get(key).and_then(|v|v.as_array()).into_iter().flatten().chain(manifest.get("resources").and_then(|v|v.as_array()).into_iter().flatten().flat_map(|r|r.get(key).and_then(|v|v.as_array()).into_iter().flatten())).filter_map(|v|v.as_str().map(str::to_owned)).collect();values.sort();values.dedup();values};
    serde_json::json!({"name":manifest.get("name").and_then(|v|v.as_str()).unwrap_or("Fonte externa"),"resources":resources,"prefixes":collect("idPrefixes"),"types":collect("types")})
}
#[tauri::command]
async fn inspect_addon(url:String,s:State<'_,AppState>)->Result<serde_json::Value,String>{
    if !s.config.read().map_err(|_|"Configuração indisponível")?.addons.contains(&url){return Err("Fonte não instalada".into());}
    let base=url.trim_end_matches('/').trim_end_matches("/manifest.json");
    let manifest:serde_json::Value=reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build().map_err(|_|"Cliente indisponível")?.get(format!("{base}/manifest.json")).send().await.map_err(|_|"A fonte não respondeu")?.error_for_status().map_err(|_|"A fonte retornou um erro HTTP")?.json().await.map_err(|_|"Manifesto inválido")?;
    let mut summary=addon_summary(&manifest);
    if let Err(status)=provider::configured_manifest(&manifest) {summary["catalog_status"]=serde_json::Value::String(status);}
    if let Some(status)=provider::native_catalog_status(base,&manifest).await {summary["catalog_status"]=serde_json::Value::String(status);}
    Ok(summary)
}
#[tauri::command]
fn get_progress(anime_id: String, provider: String, season: i64, episode: f64, s: State<AppState>) -> Result<Option<HistoryEntry>, String> {
    s.db.progress(&anime_id, &provider, season, episode)
}
#[tauri::command]
fn clear_history(s: State<AppState>) -> Result<(), String> {
    s.db.clear_history()
}
#[tauri::command]
fn recent_searches(s: State<AppState>) -> Result<Vec<String>, String> {
    s.db.searches()
}
#[tauri::command]
fn available_players() -> Vec<String> {
    player::available()
}
#[tauri::command]
fn list_addons(s: State<AppState>) -> Result<Vec<String>, String> {
    Ok(s.config.read().map_err(|_| "config lock poisoned".to_string())?.addons.clone())
}
#[tauri::command]
async fn add_addon(url: String, s: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let base=url.trim().trim_end_matches('/').trim_end_matches("/manifest.json").to_string();
    if !(base.starts_with("https://") || base.starts_with("http://")) { return Err("Use uma URL http:// ou https:// válida".into()); }
    let manifest_url=format!("{base}/manifest.json");
    let manifest:serde_json::Value=reqwest::Client::new().get(manifest_url).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
    if manifest.get("id").and_then(|v|v.as_str()).is_none() || manifest.get("name").and_then(|v|v.as_str()).is_none() { return Err("Manifesto incompatível: id e name são obrigatórios".into()); }
    provider::configured_manifest(&manifest)?;
    let mut cfg=s.config.write().map_err(|_|"config lock poisoned".to_string())?;
    if !cfg.addons.contains(&base) {
        let is_stream_only = manifest.get("catalogs").and_then(|v|v.as_array()).map(|x|x.is_empty()).unwrap_or(false)
            && manifest.get("resources").and_then(|v|v.as_array()).map(|items|items.iter().any(|r|r.as_str()==Some("stream") || r.get("name").and_then(|v|v.as_str())==Some("stream"))).unwrap_or(false);
        if is_stream_only { cfg.addons.insert(0, base); } else { cfg.addons.push(base); }
        config::save(&cfg)?;
    }
    Ok(manifest)
}
#[tauri::command]
fn remove_addon(url: String, s: State<AppState>) -> Result<(), String> {
    let mut cfg=s.config.write().map_err(|_|"config lock poisoned".to_string())?;
    cfg.addons.retain(|x|x!=&url); config::save(&cfg)
}
#[tauri::command]
fn play_stream(options: PlayerOptions, s: State<AppState>) -> Result<(), String> {
    let d = s
        .config
        .read()
        .map_err(|_| "config lock poisoned".to_string())?
        .player
        .clone();
    player::play(options, &d)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = config::load().expect("failed to load AniPT config");
    let db = Database::open(&cfg.database_path).expect("failed to open AniPT database");
    tauri::Builder::default()
        .manage(AppState {
            config: RwLock::new(cfg),
            db,
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            query_anilist,
            open_external,
            update_config,
            remove_progress,
            export_progress,
            list_anime_progress,
            import_progress,
            import_user_data,
            data_location,
            inspect_addon,
            translation::translate_synopsis_segment,
            torrent::torrent_cache_info,
            torrent::clear_torrent_cache,
            search_anime,
            recent_releases,
            anilist_home,
            get_seasons,
            get_episodes,
            get_streams,
            probe_streams,
            torrent::prepare_torrent,
            torrent::start_torrent,
            torrent::stop_torrent,
            torrent::torrent_stats,
            list_favorites,
            add_favorite,
            remove_favorite,
            list_history,
            add_history,
            save_progress,
            get_progress,
            clear_history,
            recent_searches,
            available_players,
            list_addons,
            add_addon,
            remove_addon,
            play_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running AniPT");
}
