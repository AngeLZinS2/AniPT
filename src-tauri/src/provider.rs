use crate::models::{Anime, Episode, HomeFeeds, Season, StreamSource};
use regex::Regex;
use reqwest::Client;
use scraper::{Html, Selector};
use serde_json::Value;
use std::sync::{OnceLock,Mutex};
use std::collections::HashMap;

const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AniPT/0.2";
fn media_bytes(bytes: &[u8], content_type: &str) -> bool {
    let text = String::from_utf8_lossy(bytes).trim_start().to_ascii_lowercase();
    if text.starts_with('<') || text.starts_with('{') { return false; }
    matches!(bytes.get(4..8), Some(b"ftyp" | b"styp" | b"moof")) || bytes.starts_with(&[0x1a,0x45,0xdf,0xa3])
        || (bytes.first() == Some(&0x47) && bytes.get(188) == Some(&0x47))
        || (content_type.starts_with("video/") && !bytes.is_empty())
}
// Bounded ranged reads, not a download: follow HLS to a real media segment.
pub async fn video_available(url: &str) -> bool {
    let Ok(client) = client() else { return false; };
    let Ok(mut target) = reqwest::Url::parse(url) else { return false; };
    for _ in 0..4 {
        if !["http","https"].contains(&target.scheme()) { return false; }
        let Ok(mut response) = client.get(target.clone()).timeout(std::time::Duration::from_secs(4)).header("Range","bytes=0-8191").send().await else { return false; };
        if !response.status().is_success() { return false; }
        target = response.url().clone();
        let content_type = response.headers().get("content-type").and_then(|v|v.to_str().ok()).unwrap_or("").to_ascii_lowercase();
        let mut bytes = Vec::new();
        while bytes.len()<8192 {
            match response.chunk().await { Ok(Some(chunk)) => { let count=(8192-bytes.len()).min(chunk.len()); bytes.extend_from_slice(&chunk[..count]); }, Ok(None)=>break, Err(_)=>return false }
        }
        let text = String::from_utf8_lossy(&bytes);
        if text.trim_start().starts_with("#EXTM3U") {
            let Some(next) = text.lines().map(str::trim).find(|line| !line.is_empty()&&!line.starts_with('#')) else { return false; };
            let Ok(next) = target.join(next) else { return false; }; target=next;
        } else { return media_bytes(&bytes,&content_type); }
    }
    false
}

#[cfg(test)]
mod availability_tests {
    use super::*;
    #[test]
    fn metadata_without_streams_resolves_episode_before_video_lookup(){
        use std::{io::{Read,Write},net::TcpListener};
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();
        let base=format!("http://{}",listener.local_addr().unwrap());
        let server=std::thread::spawn(move||{
            for step in 0..3 {
                let (mut socket,_)=listener.accept().unwrap();
                socket.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
                let mut request=[0;4096];let count=socket.read(&mut request).unwrap();
                let request=String::from_utf8_lossy(&request[..count]);
                let body=match step {
                    0=>{assert!(request.starts_with("GET /meta/anime/"));serde_json::json!({"meta":{"id":"kitsu:999","videos":[{"id":"kitsu:999:1","episode":1,"season":1,"title":"Episode one"}]}})},
                    1=>{assert!(request.starts_with("GET /stream/anime/"));serde_json::json!({"streams":[{"name":"Test source","title":"Legendado 1080p","url":"https://example.test/video.mp4"},{"name":"Torrent test","title":"Dublado 720p","infoHash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","fileIdx":2}]})},
                    _=>{assert!(request.starts_with("GET /stream/anime/"));serde_json::json!({"streams":[]})}
                }.to_string();
                write!(socket,"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",body.len(),body).unwrap();
            }
        });
        tauri::async_runtime::block_on(async {
            let provider=format!("addon:{base}|anime");
            let episodes=episodes("kitsu:999",1,&provider).await.unwrap();
            assert_eq!(episodes.len(),1);assert_eq!(episodes[0].id,"kitsu:999:1");
            let sources=streams(&episodes[0].id,"legendado",&provider).await.unwrap();
            assert_eq!(sources.len(),2);assert_eq!(sources[0].format,"MP4");
            assert_eq!(sources[1].format,"Torrent");assert_eq!(sources[1].torrent_file_index,Some(2));
            assert!(streams("kitsu:999:2","legendado",&provider).await.unwrap().is_empty());
        });
        server.join().unwrap();
    }
    #[test]
    fn manifests_distinguish_metadata_ids_types_and_streams(){
        let catalog=serde_json::json!({"resources":["catalog","meta"],"types":["anime"]});
        assert!(manifest_episode_support(&catalog,"anime","kitsu:46231:1").unwrap_err().contains("Somente catálogo"));
        let imdb=serde_json::json!({"resources":["stream"],"types":["series"],"idPrefixes":["tt"]});
        assert!(manifest_episode_support(&imdb,"series","kitsu:46231:1").unwrap_err().contains("tt"));
        assert_eq!(manifest_episode_support(&imdb,"series","tt21209876:1:1"),Ok(true));
        let kitsu=serde_json::json!({"resources":[{"name":"stream","types":["series"],"idPrefixes":["kitsu"]}]});
        assert_eq!(manifest_episode_support(&kitsu,"anime","kitsu:46231:1"),Ok(false));
        assert_eq!(manifest_episode_support(&kitsu,"series","kitsu:46231:1"),Ok(true));
    }
    #[test]
    fn rate_limit_videos_are_not_episodes() {
        assert!(stream_notice(&serde_json::json!({"name":"FenixFlix 1080p","title":"Aguarde 5 Minutos\nMuitas requisições (Banned)","url":"https://example.test/warning.mp4"})));
        assert!(!stream_notice(&serde_json::json!({"name":"Fonte 1080p","title":"Episódio 1 · Legendado","url":"https://example.test/episode.mp4"})));
    }
    #[test]
    fn season_ids_are_exact_and_never_merged_by_series_title() {
        let season_one=serde_json::json!({"data":[{"attributes":{"externalSite":"anilist/anime","externalId":"16498"}},{"attributes":{"externalSite":"myanimelist/anime","externalId":"16498"}}]});
        let season_two=serde_json::json!({"data":[{"attributes":{"externalSite":"anilist/anime","externalId":"20958"}}]});
        assert_eq!(mapped_id(&season_one,"anilist/anime"),Some("16498".into()));
        assert_ne!(mapped_id(&season_two,"anilist/anime"),Some("16498".into()));
        assert_eq!(mapped_id(&season_two,"myanimelist/anime"),None);
    }
    #[test]
    #[ignore = "live authoritative Kitsu mappings; run explicitly"]
    fn live_season_mapping_accepts_correct_season_and_rejects_other() {
        tauri::async_runtime::block_on(async {
            assert!(validate_season_mapping("anilist:16498","kitsu:7442").await.is_ok());
            assert!(validate_season_mapping("anilist:20958","kitsu:7442").await.is_err());
            assert!(validate_episode_identity("anilist:16498","kitsu:8671:1").await.is_err());
        });
    }
    #[test]
    #[ignore = "live addon metadata; run explicitly"]
    fn live_episode_metadata_resolves_reported_anime_and_solo_leveling(){
        tauri::async_runtime::block_on(async {
            for (anime_id,canonical) in [("anilist:213068","kitsu:50991"),("anilist:151807","kitsu:46231")] {
                let result=episodes(anime_id,1,"addon:https://anime-kitsu.strem.fun|anime").await.unwrap();
                assert!(result.iter().any(|episode|episode.number==1.0&&episode.id==format!("{canonical}:1")));
                assert!(result.iter().all(|episode|episode.anime_id==anime_id&&episode.season==1));
            }
        });
    }
    #[test]
    #[ignore = "live source; set ANIBR_TEST_ADDON and run explicitly"]
    fn live_black_clover_sequel_excludes_prequel_video_links() {
        tauri::async_runtime::block_on(async {
            let base=std::env::var("ANIBR_TEST_ADDON").expect("Defina ANIBR_TEST_ADDON para testar uma fonte instalada");
            let provider=format!("addon:{base}|anime");
            validate_episode_identity("anilist:195604","kitsu:50024:1").await.unwrap();
            let identity=stream_season_identity("anilist:195604").await.unwrap();
            let previous=streams("kitsu:13209:1","dublado",&provider).await.unwrap();
            let mut current=streams("kitsu:50024:1","dublado",&provider).await.unwrap();
            let before=current.len();
            let rejected=crate::stream_identity::filter_streams(&mut current,identity.as_ref());
            let key=|stream:&StreamSource|reqwest::Url::parse(&stream.url).ok().map(|url|format!("{}{}",url.origin().ascii_serialization(),url.path()));
            let previous_keys=previous.iter().filter_map(key).collect::<Vec<_>>();
            assert!(!current.is_empty(),"A fonte não forneceu opções corretas da segunda temporada");
            assert!(current.iter().filter_map(key).all(|key|!previous_keys.contains(&key)),"A fonte ainda mistura os mesmos links da primeira temporada");
            println!("Segunda temporada: {before} opções recebidas, {rejected} conflitantes descartadas, {} preservadas",current.len());
        });
    }
    #[test]
    fn rejects_error_documents_even_with_video_content_type() {
        assert!(!media_bytes(b"<!doctype html><h1>Offline</h1>","video/mp4"));
        assert!(!media_bytes(b"{\"error\":\"not found\"}","video/mp4"));
        assert!(!media_bytes(b"","video/mp4"));
    }
    #[test]
    fn accepts_media_signatures_without_inventing_quality_or_codec() {
        assert!(media_bytes(b"\0\0\0\x18ftypisom","application/octet-stream"));
        assert!(media_bytes(b"\0\0\0\x18stypmsdh","application/octet-stream"));
        assert!(media_bytes(&[0x1a,0x45,0xdf,0xa3],"application/octet-stream"));
        assert!(!media_bytes(b"Not found","text/plain"));
    }
    #[test]
    fn follows_hls_to_media_and_rejects_http_errors() {
        use std::{io::{Read,Write},net::TcpListener};
        let listener=TcpListener::bind("127.0.0.1:0").unwrap();
        let base=format!("http://{}",listener.local_addr().unwrap());
        let server=std::thread::spawn(move||{
            for _ in 0..4 {
                let (mut socket,_)=listener.accept().unwrap();
                socket.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
                let mut request=[0;4096];let count=socket.read(&mut request).unwrap();
                let request=String::from_utf8_lossy(&request[..count]);
                let (status,mime,body)=if request.starts_with("GET /playlist") {
                    ("200 OK","application/vnd.apple.mpegurl",b"#EXTM3U\n#EXTINF:6,\nsegment.ts\n".to_vec())
                } else if request.starts_with("GET /segment") {
                    let mut bytes=vec![0;376];bytes[0]=0x47;bytes[188]=0x47;
                    ("206 Partial Content","video/mp2t",bytes)
                } else if request.starts_with("GET /missing") {
                    ("404 Not Found","text/plain",b"Not found".to_vec())
                } else { ("200 OK","video/mp4",b"<html>Blocked</html>".to_vec()) };
                write!(socket,"HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len()).unwrap();
                socket.write_all(&body).unwrap();
            }
        });
        tauri::async_runtime::block_on(async {
            assert!(video_available(&format!("{base}/playlist.m3u8")).await);
            assert!(!video_available(&format!("{base}/missing.mp4")).await);
            assert!(!video_available(&format!("{base}/html.mp4")).await);
        });
        server.join().unwrap();
    }
}
fn client() -> Result<Client, String> {
    static HTTP:OnceLock<Client>=OnceLock::new();
    if let Some(http)=HTTP.get(){return Ok(http.clone());}
    let http=Client::builder()
        .user_agent(UA)
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let _=HTTP.set(http.clone());Ok(http)
}
fn slug(href: &str, marker: &str) -> String {
    href.split(marker)
        .nth(1)
        .unwrap_or(href)
        .split(['/', '?'])
        .find(|s| !s.is_empty())
        .unwrap_or("")
        .to_string()
}
fn text(el: scraper::ElementRef<'_>) -> String {
    el.text().collect::<Vec<_>>().join(" ").trim().to_string()
}

async fn search_one(query: &str, provider: &str) -> Result<Vec<Anime>, String> {
    let (url, marker) = match provider {
        "goyabu" => (
            format!("https://goyabu.to/?s={}", urlencoding::encode(query)),
            "/anime/",
        ),
        _ => (
            format!(
                "https://animefire.io/pesquisar/{}",
                urlencoding::encode(&query.to_lowercase().replace(' ', "-"))
            ),
            "/animes/",
        ),
    };
    let body = client()?
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;
    let doc = Html::parse_document(&body);
    let a = Selector::parse("a[href]").unwrap();
    let img = Selector::parse("img").unwrap();
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for el in doc.select(&a) {
        let href = el.value().attr("href").unwrap_or("");
        if !href.contains(marker) {
            continue;
        }
        let id = slug(href, marker);
        if id.is_empty() || !seen.insert(id.clone()) {
            continue;
        }
        let title = el
            .value()
            .attr("title")
            .map(str::to_string)
            .unwrap_or_else(|| text(el));
        if title.trim().is_empty() || title.len() > 180 {
            continue;
        }
        let cover = el
            .select(&img)
            .next()
            .and_then(|x| x.value().attr("data-src").or_else(|| x.value().attr("src")))
            .unwrap_or("")
            .to_string();
        out.push(Anime {
            id,
            title,
            title_ptbr: String::new(),
            cover_url: cover,
            banner_url: String::new(),
            synopsis: String::new(),
            genres: vec![],
            status: "Em andamento".into(),
            total_episodes: 0,
            year: 0,
            provider: provider.into(),
            available_languages: vec!["dublado".into(), "legendado".into()],
            latest_episode: 0.0,
            aired_at: 0,
            confirmed_release: false,
            rating: 0.0,
        });
    }
    Ok(out)
}
async fn search_addon(base: &str, query: &str) -> Result<Vec<Anime>, String> {
    let root=base.trim_end_matches('/');
    let manifest:Value=client()?.get(format!("{root}/manifest.json")).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
    let catalogs=manifest.get("catalogs").and_then(Value::as_array).ok_or("Addon sem catálogos")?;
    let mut out=Vec::new();
    for catalog in catalogs.iter().take(if query.is_empty(){3}else{catalogs.len()}) {
        let supports_search=catalog.get("extra").and_then(Value::as_array).map(|e|e.iter().any(|x|x.get("name").and_then(Value::as_str)==Some("search"))).unwrap_or(false);
        if (!query.is_empty() && !supports_search) || (query.is_empty() && supports_search) { continue; }
        let kind=catalog.get("type").and_then(Value::as_str).unwrap_or("series");
        let id=catalog.get("id").and_then(Value::as_str).unwrap_or("top");
        let url=if query.is_empty(){format!("{root}/catalog/{kind}/{id}.json")}else{format!("{root}/catalog/{kind}/{id}/search={}.json",urlencoding::encode(query))};
        let Ok(response)=client()?.get(url).send().await else {continue}; let Ok(response)=response.error_for_status() else {continue}; let Ok(json)=response.json::<Value>().await else {continue};
        for m in json.get("metas").and_then(Value::as_array).into_iter().flatten() { out.push(Anime{id:m.get("id").and_then(Value::as_str).unwrap_or_default().into(),title:m.get("name").and_then(Value::as_str).unwrap_or("Sem título").into(),title_ptbr:String::new(),cover_url:m.get("poster").and_then(Value::as_str).unwrap_or_default().into(),banner_url:m.get("background").and_then(Value::as_str).unwrap_or_default().into(),synopsis:m.get("description").and_then(Value::as_str).unwrap_or_default().into(),genres:m.get("genres").and_then(Value::as_array).map(|a|a.iter().filter_map(Value::as_str).map(str::to_string).collect()).unwrap_or_default(),status:String::new(),total_episodes:0,year:m.get("releaseInfo").and_then(Value::as_str).and_then(|s|s.get(0..4)).and_then(|s|s.parse().ok()).unwrap_or(0),provider:format!("addon:{root}|{kind}"),available_languages:vec![],latest_episode:0.0,aired_at:0,confirmed_release:false,rating:0.0}); }
    }
    out.retain(|a|!a.id.is_empty()); Ok(out)
}

pub async fn recent_releases() -> Result<Vec<Anime>, String> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;
    let query = r#"query ($to:Int){Page(page:1,perPage:50){airingSchedules(airingAt_lesser:$to,sort:TIME_DESC){episode airingAt media{id title{romaji english} description(asHtml:false) genres seasonYear averageScore isAdult coverImage{extraLarge large} bannerImage}}}}"#;
    let body = serde_json::json!({"query":query,"variables":{"to":now}});
    let json: Value = client()?
        .post("https://graphql.anilist.co")
        .json(&body)
        .send().await.map_err(|e| e.to_string())?
        .error_for_status().map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let schedules = json.pointer("/data/Page/airingSchedules").and_then(Value::as_array).ok_or("AniList não retornou a agenda")?;
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for item in schedules {
        let Some(media) = item.get("media") else { continue };
        if media.get("isAdult").and_then(Value::as_bool).unwrap_or(false) { continue; }
        let id = media.get("id").and_then(Value::as_i64).unwrap_or_default();
        let episode = item.get("episode").and_then(Value::as_f64).unwrap_or_default();
        if id == 0 || episode == 0.0 || !seen.insert((id, episode as i64)) { continue; }
        let title = media.pointer("/title/english").and_then(Value::as_str)
            .or_else(|| media.pointer("/title/romaji").and_then(Value::as_str)).unwrap_or("Sem título");
        out.push(Anime {
            id: format!("anilist:{id}"), title: title.into(), title_ptbr: String::new(),
            cover_url: media.pointer("/coverImage/extraLarge").and_then(Value::as_str).or_else(||media.pointer("/coverImage/large").and_then(Value::as_str)).unwrap_or_default().into(),
            banner_url: media.get("bannerImage").and_then(Value::as_str).unwrap_or_default().into(),
            synopsis: media.get("description").and_then(Value::as_str).unwrap_or_default().into(),
            genres: media.get("genres").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect()).unwrap_or_default(),
            status: "Lançamento confirmado".into(), total_episodes: 0,
            year: media.get("seasonYear").and_then(Value::as_i64).unwrap_or_default(),
            provider: "addon:https://anime-kitsu.strem.fun|anime".into(),
            available_languages: vec!["Aguardando fonte".into()], latest_episode: episode,
            aired_at: item.get("airingAt").and_then(Value::as_i64).unwrap_or_default(), confirmed_release: true,
            rating: media.get("averageScore").and_then(Value::as_f64).unwrap_or_default() / 10.0,
        });
    }
    Ok(out)
}

fn anilist_media(media: &Value) -> Option<Anime> {
    if media.get("isAdult").and_then(Value::as_bool).unwrap_or(false) { return None; }
    let id = media.get("id").and_then(Value::as_i64)?;
    let title = media.pointer("/title/english").and_then(Value::as_str)
        .or_else(|| media.pointer("/title/romaji").and_then(Value::as_str)).unwrap_or("Sem título");
    let raw_description = media.get("description").and_then(Value::as_str).unwrap_or_default();
    let synopsis = Html::parse_fragment(raw_description).root_element().text().collect::<Vec<_>>().join(" ");
    Some(Anime {
        id: format!("anilist:{id}"), title: title.into(), title_ptbr: String::new(),
        cover_url: media.pointer("/coverImage/extraLarge").and_then(Value::as_str).or_else(||media.pointer("/coverImage/large").and_then(Value::as_str)).unwrap_or_default().into(),
        banner_url: media.get("bannerImage").and_then(Value::as_str).unwrap_or_default().into(), synopsis,
        genres: media.get("genres").and_then(Value::as_array).map(|a|a.iter().filter_map(Value::as_str).map(str::to_string).collect()).unwrap_or_default(),
        status: media.get("status").and_then(Value::as_str).unwrap_or_default().into(), total_episodes: media.get("episodes").and_then(Value::as_i64).unwrap_or_default(),
        year: media.get("seasonYear").and_then(Value::as_i64).unwrap_or_default(),
        provider: "addon:https://anime-kitsu.strem.fun|anime".into(), available_languages: vec![],
        latest_episode: 0.0, aired_at: 0, confirmed_release: false,
        rating: media.get("averageScore").and_then(Value::as_f64).unwrap_or_default() / 10.0,
    })
}

pub async fn query_anilist(query: &str, variables: Value) -> Result<Value, String> {
    if !query.trim_start().starts_with("query") || query.contains("mutation") {
        return Err("Somente consultas de catálogo são permitidas".into());
    }
    let json: Value = client()?.post("https://graphql.anilist.co")
        .json(&serde_json::json!({"query":query,"variables":variables}))
        .send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?
        .json().await.map_err(|e|e.to_string())?;
    if let Some(errors) = json.get("errors") { return Err(format!("AniList: {errors}")); }
    json.get("data").cloned().ok_or("AniList não retornou dados".into())
}

pub async fn anilist_home() -> Result<HomeFeeds, String> {
    let fields = "id title{english romaji} status seasonYear averageScore episodes description(asHtml:false) genres isAdult coverImage{extraLarge large} bannerImage";
    let query = format!("query {{ trending:Page(page:1,perPage:24){{media(type:ANIME,isAdult:false,sort:TRENDING_DESC){{{fields}}}}} popular:Page(page:1,perPage:24){{media(type:ANIME,isAdult:false,sort:POPULARITY_DESC){{{fields}}}}} recent:Page(page:1,perPage:24){{media(type:ANIME,isAdult:false,sort:ID_DESC){{{fields}}}}} }}");
    let json:Value=client()?.post("https://graphql.anilist.co").json(&serde_json::json!({"query":query})).send().await.map_err(|e|e.to_string())?.error_for_status().map_err(|e|e.to_string())?.json().await.map_err(|e|e.to_string())?;
    let parse = |path:&str| json.pointer(path).and_then(Value::as_array).into_iter().flatten().filter_map(anilist_media).collect::<Vec<_>>();
    Ok(HomeFeeds { trending:parse("/data/trending/media"), popular:parse("/data/popular/media"), recent:parse("/data/recent/media") })
}
pub async fn search(query: &str, provider: &str, addons: &[String]) -> Result<Vec<Anime>, String> {
    if provider == "multi" || provider == "all" {
        let mut out = search_one(query, "animefire").await.unwrap_or_default();
        out.extend(search_one(query, "goyabu").await.unwrap_or_default());
        for addon in addons { out.extend(search_addon(addon,query).await.unwrap_or_default()); }
        Ok(out)
    } else if let Some(base)=provider.strip_prefix("addon:") {
        search_addon(base,query).await
    } else {
        search_one(query, provider).await
    }
}
async fn fetch(url: &str) -> Result<String, String> {
    client()?
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())
}
pub async fn episode_support(base: &str, kind: &str, episode_id: &str) -> Result<bool,String> {
    // An opaque scraper ID is meaningful only to its original provider.
    if !episode_id.contains(':') { return Err("ID de episódio não verificável".into()); }
    let http=client()?;
    static MANIFESTS:OnceLock<Mutex<HashMap<String,(std::time::Instant,Value)>>>=OnceLock::new();
    let cache=MANIFESTS.get_or_init(||Mutex::new(HashMap::new()));
    let existing=cache.lock().ok().and_then(|items|items.get(base).filter(|(time,_)|time.elapsed().as_secs()<300).map(|(_,value)|value.clone()));
    let manifest=if let Some(value)=existing {value} else {
        let response=http.get(format!("{}/manifest.json",base.trim_end_matches('/'))).send().await.map_err(|_|"Manifesto indisponível: erro de rede ou timeout")?;
        if !response.status().is_success(){return Err(format!("Manifesto indisponível: HTTP {}",response.status().as_u16()));}
        let manifest=response.json::<Value>().await.map_err(|_|"Manifesto inválido: não retornou JSON")?;
        if let Ok(mut items)=cache.lock(){items.insert(base.to_string(),(std::time::Instant::now(),manifest.clone()));}
        manifest
    };
    manifest_episode_support(&manifest,kind,episode_id)
}
fn manifest_episode_support(manifest:&Value,kind:&str,episode_id:&str)->Result<bool,String>{
    let resources=manifest.get("resources").and_then(Value::as_array).ok_or("Manifesto sem recursos")?;
    let is_stream=|resource:&Value|resource.as_str()==Some("stream")||resource.get("name").and_then(Value::as_str)==Some("stream");
    if !resources.iter().any(is_stream){return Err("Somente catálogo/metadados; esta fonte não fornece vídeos".into());}
    let accepts_prefix=|value:&Value| value.get("idPrefixes").and_then(Value::as_array)
        .map(|prefixes|prefixes.iter().filter_map(Value::as_str).any(|prefix|episode_id.starts_with(prefix)))
        .unwrap_or(true);
    let correct_prefix=resources.iter().filter(|r|is_stream(r)).any(|r|accepts_prefix(r)&&accepts_prefix(manifest));
    if !correct_prefix {
        let prefixes=resources.iter().filter(|r|is_stream(r)).filter_map(|r|r.get("idPrefixes").or_else(||manifest.get("idPrefixes"))).filter_map(Value::as_array).flatten().filter_map(Value::as_str).collect::<Vec<_>>();
        return Err(format!("ID Kitsu incompatível; fonte exige {}. Sem conversão verificável de temporada/episódio",prefixes.join(", ")));
    }
    Ok(resources.iter().any(|resource| {
        let types=resource.get("types").or_else(||manifest.get("types"));
        let correct_type=types.and_then(Value::as_array).map(|items|items.iter().any(|value|value.as_str()==Some(kind))).unwrap_or(true);
        is_stream(resource)&&correct_type&&accepts_prefix(resource)&&accepts_prefix(manifest)
    }))
}
pub async fn seasons(anime_id: &str, _provider: &str) -> Result<Vec<Season>, String> {
    Ok(vec![Season {
        id: anime_id.into(),
        anime_id: anime_id.into(),
        number: 1,
        title: "1ª Temporada".into(),
        episode_count: 0,
    }])
}
pub async fn episodes(anime_id: &str, season: i64, provider: &str) -> Result<Vec<Episode>, String> {
    if let Some(spec)=provider.strip_prefix("addon:") {
        let (base,kind)=spec.rsplit_once('|').unwrap_or((spec,"series"));
        let url=format!("{}/meta/{}/{}.json",base.trim_end_matches('/'),kind,urlencoding::encode(anime_id));
        let response=client()?.get(url).send().await.map_err(|_|"Falha de rede ou timeout ao consultar metadados do anime")?;
        if !response.status().is_success(){return Err(format!("Falha ao consultar metadados: HTTP {}",response.status().as_u16()));}
        let json:Value=response.json().await.map_err(|_|"Resposta de metadados inválida: não retornou JSON")?;
        let meta=json.get("meta").ok_or("A fonte não encontrou este identificador de anime")?;
        let canonical_id=meta.get("id").and_then(Value::as_str).ok_or("Metadados sem identificador verificável")?;
        validate_season_mapping(anime_id,canonical_id).await?;
        let videos=meta.get("videos").and_then(Value::as_array).cloned().unwrap_or_default();
        if canonical_id.starts_with("kitsu:")&&videos.iter().any(|video|video.get("id").and_then(Value::as_str).map(|id|!id.starts_with(&format!("{canonical_id}:"))).unwrap_or(true)) {
            return Err("A fonte retornou episódios de outro identificador de anime".into());
        }
        let mut out=videos.into_iter().filter_map(|v|{let n=v.get("episode").and_then(Value::as_f64)?;let s=v.get("season").and_then(Value::as_i64).unwrap_or(1);if s!=season{return None}Some(Episode{id:v.get("id").and_then(Value::as_str).unwrap_or_default().into(),anime_id:anime_id.into(),season_id:format!("{anime_id}:{s}"),season:s,number:n,title:v.get("title").and_then(Value::as_str).unwrap_or("Episódio").into(),duration:0,air_date:v.get("released").and_then(Value::as_str).unwrap_or_default().into(),thumbnail:v.get("thumbnail").and_then(Value::as_str).unwrap_or_default().into()})}).collect::<Vec<_>>();out.sort_by(|a,b|a.number.total_cmp(&b.number));return Ok(out)
    }
    let url = if provider == "goyabu" {
        format!("https://goyabu.to/anime/{anime_id}")
    } else {
        format!("https://animefire.io/animes/{anime_id}")
    };
    let body = fetch(&url).await?;
    let mut out = Vec::new();
    if provider == "goyabu" {
        let re = Regex::new(r#"\{\s*\"id\"\s*:\s*(\d+).*?\"episodio\"\s*:\s*\"?(\d+(?:\.\d+)?)"#)
            .unwrap();
        for c in re.captures_iter(&body) {
            let n = c[2].parse().unwrap_or(1.0);
            out.push(Episode {
                id: format!("?p={}", &c[1]),
                anime_id: anime_id.into(),
                season_id: anime_id.into(),
                season,
                number: n,
                title: format!("Episódio {n}"),
                duration: 0,
                air_date: String::new(),
                thumbnail: String::new(),
            });
        }
    } else {
        let doc = Html::parse_document(&body);
        let sel = Selector::parse("a[href]").unwrap();
        for a in doc.select(&sel) {
            let h = a.value().attr("href").unwrap_or("");
            let parts = h.trim_matches('/').split('/').collect::<Vec<_>>();
            if parts.len() == 3 && parts[0] == "animes" && parts[1] == anime_id {
                if let Ok(n) = parts[2].split('-').next().unwrap_or("").parse::<f64>() {
                    out.push(Episode {
                        id: parts.join("/"),
                        anime_id: anime_id.into(),
                        season_id: anime_id.into(),
                        season,
                        number: n,
                        title: format!("Episódio {n}"),
                        duration: 0,
                        air_date: String::new(),
                        thumbnail: String::new(),
                    });
                }
            }
        }
    }
    out.sort_by(|a, b| a.number.total_cmp(&b.number));
    out.dedup_by(|a, b| a.id == b.id);
    Ok(out)
}

fn mapped_id(mappings:&Value,site:&str)->Option<String>{
    mappings.get("data")?.as_array()?.iter().find_map(|item|{
        let attrs=item.get("attributes")?;
        if attrs.get("externalSite")?.as_str()?!=site{return None;}
        attrs.get("externalId").and_then(|value|value.as_str().map(str::to_string).or_else(||value.as_i64().map(|id|id.to_string())))
    })
}
pub async fn stream_season_identity(anime_id:&str)->Result<Option<crate::stream_identity::SeasonIdentity>,String>{
    let Some(id)=anime_id.strip_prefix("anilist:") else {return Ok(None);};
    let id=id.parse::<i64>().map_err(|_|"ID AniList inválido")?;
    static IDENTITIES:OnceLock<Mutex<HashMap<i64,(std::time::Instant,crate::stream_identity::SeasonIdentity)>>>=OnceLock::new();
    let cache=IDENTITIES.get_or_init(||Mutex::new(HashMap::new()));
    if let Some(identity)=cache.lock().ok().and_then(|items|items.get(&id).filter(|(time,_)|time.elapsed().as_secs()<3600).map(|(_,value)|value.clone())){return Ok(Some(identity));}
    let data=query_anilist("query StreamSeasonIdentity($id:Int!){Media(id:$id,type:ANIME){id title{english romaji native} relations{edges{relationType node{id type title{english romaji native}}}}}}",serde_json::json!({"id":id})).await.map_err(|_|"Não foi possível conferir a identificação das fontes no AniList. Verifique a conexão e tente novamente.")?;
    let identity=crate::stream_identity::SeasonIdentity::from_media(&data["Media"])?;
    if let Ok(mut items)=cache.lock(){items.insert(id,(std::time::Instant::now(),identity.clone()));}
    Ok(Some(identity))
}
pub async fn validate_season_mapping(anime_id:&str,canonical_id:&str)->Result<(),String>{
    static VERIFIED:OnceLock<Mutex<HashMap<String,std::time::Instant>>>=OnceLock::new();
    let cache=VERIFIED.get_or_init(||Mutex::new(HashMap::new()));
    let key=format!("{anime_id}|{canonical_id}");
    if cache.lock().ok().and_then(|items|items.get(&key).copied()).map(|time|time.elapsed().as_secs()<3600).unwrap_or(false){return Ok(());}
    let result=validate_season_mapping_uncached(anime_id,canonical_id).await;
    if result.is_ok(){if let Ok(mut items)=cache.lock(){items.insert(key,std::time::Instant::now());}}
    result
}
async fn validate_season_mapping_uncached(anime_id:&str,canonical_id:&str)->Result<(),String>{
    let Some(expected)=anime_id.strip_prefix("anilist:") else {return Ok(());};
    let kitsu=canonical_id.strip_prefix("kitsu:").filter(|id|!id.is_empty()&&id.chars().all(|c|c.is_ascii_digit())).ok_or("A fonte não forneceu um ID Kitsu verificável para esta temporada")?;
    static MAPPINGS:OnceLock<Mutex<HashMap<String,(std::time::Instant,Value)>>>=OnceLock::new();
    let cache=MAPPINGS.get_or_init(||Mutex::new(HashMap::new()));
    let existing=cache.lock().ok().and_then(|items|items.get(kitsu).filter(|(time,_)|time.elapsed().as_secs()<3600).map(|(_,value)|value.clone()));
    let mapping=if let Some(value)=existing {value} else {
        let value=client()?.get(format!("https://kitsu.io/api/edge/anime/{kitsu}/mappings?page[limit]=20")).send().await.map_err(|_|"Não foi possível acessar o Kitsu para conferir a temporada. Verifique a conexão ou bloqueios da rede e tente novamente.")?.error_for_status().map_err(|_|"Mapeamento de temporada indisponível")?.json::<Value>().await.map_err(|_|"Mapeamento de temporada inválido")?;
        if let Ok(mut items)=cache.lock(){items.insert(kitsu.into(),(std::time::Instant::now(),value.clone()));}value
    };
    if let Some(actual)=mapped_id(&mapping,"anilist/anime") {
        return if actual==expected {Ok(())} else {Err("A fonte retornou outra temporada; reprodução bloqueada para evitar episódios incorretos".into())};
    }
    if let Some(mal)=mapped_id(&mapping,"myanimelist/anime") {
        let id=expected.parse::<i64>().map_err(|_|"ID AniList inválido")?;
        let data=query_anilist("query SeasonIdentity($id:Int!){Media(id:$id,type:ANIME){idMal}}",serde_json::json!({"id":id})).await?;
        if data.pointer("/Media/idMal").and_then(Value::as_i64).map(|id|id.to_string())==Some(mal){return Ok(());}
    }
    Err("Não foi possível confirmar que a fonte pertence a esta temporada".into())
}
pub async fn validate_episode_identity(anime_id:&str,episode_id:&str)->Result<(),String>{
    if !anime_id.starts_with("anilist:"){return Ok(());}
    let parts=episode_id.split(':').collect::<Vec<_>>();
    if parts.len()<3||parts[0]!="kitsu" {return Err("O episódio não tem identificação de temporada verificável".into());}
    validate_season_mapping(anime_id,&format!("kitsu:{}",parts[1])).await
}
pub async fn streams(
    episode_id: &str,
    language: &str,
    provider: &str,
) -> Result<Vec<StreamSource>, String> {
    if let Some(spec)=provider.strip_prefix("addon:") {
        let (base,kind)=spec.rsplit_once('|').unwrap_or((spec,"series"));
        let url=format!("{}/stream/{}/{}.json",base.trim_end_matches('/'),kind,urlencoding::encode(episode_id));
        let response=client()?.get(url).send().await.map_err(|_|"Falha de rede ou timeout ao consultar os vídeos")?;
        if !response.status().is_success(){return Err(format!("Falha ao consultar vídeos: HTTP {}",response.status().as_u16()));}
        let json:Value=response.json().await.map_err(|_|"Resposta de vídeos inválida: não retornou JSON")?;
        let items=json.get("streams").and_then(Value::as_array).ok_or("Resposta inválida: falta a lista streams")?;
        if items.is_empty(){return Ok(Vec::new());}
        if json.get("streams").and_then(Value::as_array).map(|items|!items.is_empty()&&items.iter().all(|item|stream_notice(item))).unwrap_or(false){return Err("A fonte retornou um aviso de bloqueio, não um episódio".into());}
        let out=json.get("streams").and_then(Value::as_array).into_iter().flatten().filter_map(|s| {
            if stream_notice(s){return None;}
            let torrent_hash=s.get("infoHash").and_then(Value::as_str).filter(|hash|hash.len()==40&&hash.chars().all(|c|c.is_ascii_hexdigit()));
            let raw=s.get("url").and_then(Value::as_str).unwrap_or("");
            let is_torrent=torrent_hash.is_some()||raw.starts_with("magnet:")||raw.split('?').next().unwrap_or("").to_lowercase().ends_with(".torrent")||s.get("torrentFile").and_then(Value::as_str).is_some();
            let torrent_url=if let Some(hash)=torrent_hash {
                let mut url=format!("magnet:?xt=urn:btih:{}",hash.to_lowercase());
                for tracker in s.get("sources").and_then(Value::as_array).into_iter().flatten().filter_map(Value::as_str).filter_map(|value|value.strip_prefix("tracker:")){url.push_str(&format!("&tr={}",urlencoding::encode(tracker)));}url
            } else {s.get("torrentFile").and_then(Value::as_str).unwrap_or(raw).to_string()};
            let url=torrent_url.as_str();
            let parsed=reqwest::Url::parse(url).ok()?;
            if !matches!(parsed.scheme(),"http"|"https"|"magnet") {return None}
            let title=s.get("title").or_else(||s.get("description")).and_then(Value::as_str).unwrap_or("");
            let name=s.get("name").and_then(Value::as_str).unwrap_or("");
            let description=format!("{name} {title}");
            let lower=description.to_lowercase();
            let audio=if Regex::new(r"(?i)\b(dublado|dubbed|dub)\b").ok()?.is_match(&lower) {"Dublado"} else if Regex::new(r"(?i)\b(legendado|subbed|sub)\b").ok()?.is_match(&lower) {"Legendado"} else {"Idioma não informado"};
            let hls=!is_torrent&&parsed.path().to_lowercase().ends_with(".m3u8");
            let format=if is_torrent {"Torrent"} else if hls {"HLS"} else if parsed.path().to_lowercase().ends_with(".mp4") {"MP4"} else {"Vídeo direto"};
            let host=reqwest::Url::parse(base).ok().and_then(|u|u.host_str().map(str::to_owned)).unwrap_or_default();
            Some(StreamSource{url:url.into(),quality:description,language:audio.into(),format:format.into(),is_hls:hls,torrent_file_index:s.get("fileIdx").and_then(Value::as_u64).map(|index|index as usize),source:if name.is_empty(){host}else{format!("{name} · {host}")}})
        }).collect::<Vec<_>>();
        return if out.is_empty(){Err("Fonte respondeu, mas não ofereceu URL de vídeo ou torrent compatível".into())}else{Ok(out)}
    }
    let url = if provider == "goyabu" {
        if episode_id.starts_with('?') {
            format!("https://goyabu.to/{episode_id}")
        } else {
            format!("https://goyabu.to/?p={episode_id}")
        }
    } else {
        format!(
            "https://animefire.io/{}",
            episode_id.trim_start_matches('/')
        )
    };
    let body = fetch(&url).await?;
    let re = Regex::new(r#"https?://[^\"'\s\\]+(?:\.m3u8|\.mp4)[^\"'\s\\]*"#).unwrap();
    let mut out = Vec::new();
    for m in re.find_iter(&body) {
        let u = m.as_str().replace("\\/", "/");
        if out.iter().any(|s: &StreamSource| s.url == u) {
            continue;
        }
        let hls = u.contains(".m3u8");
        out.push(StreamSource {
            url: u,
            quality: "best".into(),
            language: language.into(),
            format: if hls { "m3u8".into() } else { "mp4".into() },
            is_hls: hls,
            source: provider.into(),
            torrent_file_index: None,
        });
    }
    if out.is_empty() {
        Err("Nenhuma fonte de vídeo direta encontrada".into())
    } else {
        Ok(out)
    }
}

fn stream_notice(item:&Value)->bool {
    let label=format!("{} {} {}",item.get("name").and_then(Value::as_str).unwrap_or(""),item.get("title").and_then(Value::as_str).unwrap_or(""),item.get("description").and_then(Value::as_str).unwrap_or("")).to_lowercase();
    ["muitas requisições","muitas requisicoes","too many requests","rate limit","(banned)","aguarde 5 minutos","video de aviso","vídeo de aviso"].iter().any(|hint|label.contains(hint))
}
