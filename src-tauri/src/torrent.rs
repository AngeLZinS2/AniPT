use std::{sync::{Arc,Mutex},collections::HashSet,io::SeekFrom};
use axum::{Router,routing::get,extract::{State,Path},http::{HeaderMap,StatusCode},response::{Response,IntoResponse},body::Body};
use librqbit::{Session,SessionOptions,Api,AddTorrent,AddTorrentOptions};
use serde::Serialize;
use tokio::{sync::OnceCell,io::{AsyncReadExt,AsyncSeekExt}};

static ENGINE:OnceCell<Arc<Engine>>=OnceCell::const_new();
struct Engine {api:Api,token:String,port:u16,active:Mutex<Option<(usize,usize)>>,folder:std::path::PathBuf,operations:tokio::sync::Mutex<()>}
#[derive(Serialize)]
pub struct TorrentFile {index:usize,name:String,bytes:u64}
#[derive(Serialize)]
pub struct PreparedTorrent {id:usize,files:Vec<TorrentFile>}
#[derive(Serialize)]
pub struct TorrentPlayback {url:String,file:String}
fn video_file(name:&str)->bool {
    let lower=name.to_lowercase();
    [".mp4",".m4v",".webm",".mkv",".avi",".mov",".ts"].iter().any(|ext|lower.ends_with(ext))
        && !lower.contains("sample")
}
fn valid_torrent_input(input:&str)->bool {
    if let Ok(url)=reqwest::Url::parse(input){
        return matches!(url.scheme(),"http"|"https")||(url.scheme()=="magnet"&&url.query_pairs().any(|(key,value)|key=="xt"&&value.starts_with("urn:btih:")));
    }false
}
async fn engine()->Result<Arc<Engine>,String>{
    ENGINE.get_or_try_init(||async {
        #[cfg(not(test))]
        let folder=dirs::cache_dir().ok_or("Pasta de cache indisponível")?.join("anipt").join("torrents");
        #[cfg(test)]
        let folder=std::env::temp_dir().join(format!("anipt-torrent-test-{}",uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&folder).map_err(|_|"Não foi possível criar cache de torrents")?;
        let options=SessionOptions{listen:None,persistence:None,disable_local_service_discovery:true,..Default::default()};
        #[cfg(test)]
        let options=SessionOptions{dht:None,..options};
        let session=Session::new_with_opts(folder.clone(),options).await.map_err(|error|format!("Motor torrent: {error}"))?;
        let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.map_err(|_|"Não foi possível abrir streaming local")?;
        let port=listener.local_addr().map_err(|_|"Porta local indisponível")?.port();
        let engine=Arc::new(Engine{api:Api::new(session,None),token:uuid::Uuid::new_v4().simple().to_string(),port,active:Mutex::new(None),folder,operations:tokio::sync::Mutex::new(())});
        let app=Router::new().route("/{token}/{id}/{file}",get(stream_file)).with_state(engine.clone());
        tauri::async_runtime::spawn(async move{let _=axum::serve(listener,app).await;});
        Ok::<_,String>(engine)
    }).await.cloned()
}
#[tauri::command]
pub async fn prepare_torrent(input:String)->Result<PreparedTorrent,String>{
    if !valid_torrent_input(&input){return Err("Magnet ou URL torrent inválido".into());}
    let engine=engine().await?;
    let _operation=engine.operations.lock().await;
    let response=tokio::time::timeout(std::time::Duration::from_secs(90),engine.api.api_add_torrent(AddTorrent::from_url(&input),Some(AddTorrentOptions{paused:true,only_files:Some(vec![]),sub_folder:Some(uuid::Uuid::new_v4().simple().to_string()),..Default::default()}))).await.map_err(|_|"Torrent sem metadados após 90 segundos; pode não ter peers")?.map_err(|_|"Não foi possível obter metadados do torrent")?;
    let id=response.id.ok_or("Torrent sem identificação local")?;
    let handle=engine.api.mgr_handle(id.into()).map_err(|_|"Torrent indisponível")?;
    tokio::time::timeout(std::time::Duration::from_secs(45),handle.wait_until_initialized()).await.map_err(|_|"Metadados do torrent demoraram demais")?.map_err(|_|"Falha ao inicializar torrent")?;
    let details=engine.api.api_torrent_details(id.into()).map_err(|_|"Arquivos do torrent indisponíveis")?;
    let files=details.files.unwrap_or_default().into_iter().enumerate().filter(|(_,file)|video_file(&file.name)).map(|(index,file)|TorrentFile{index,name:file.name,bytes:file.length}).collect::<Vec<_>>();
    if files.is_empty(){return Err("O torrent não contém arquivos de vídeo reconhecidos".into());}
    Ok(PreparedTorrent{id,files})
}
#[tauri::command]
pub async fn start_torrent(id:usize,file:usize)->Result<TorrentPlayback,String>{
    let engine=engine().await?;
    let _operation=engine.operations.lock().await;
    let details=engine.api.api_torrent_details(id.into()).map_err(|_|"Torrent indisponível")?;
    let files=details.files.ok_or("Torrent sem lista de arquivos")?;
    let selected=files.get(file).filter(|file|video_file(&file.name)).ok_or("Escolha um arquivo de vídeo válido")?;
    if selected.length>32*1024*1024*1024{return Err("Arquivo maior que o limite de cache de 32 GB por vídeo".into());}
    #[cfg(not(test))]
    {
        let quota=crate::config::load()?.cache_quota_gb.clamp(1,256)*1024*1024*1024;
        let path=selected.components.iter().fold(std::path::PathBuf::from(&details.output_folder),|path,part|path.join(part));
        let existing=std::fs::metadata(path).map(|m|m.len()).unwrap_or(0);
        if cache_would_exceed(folder_bytes(&engine.folder)?,existing,selected.length,quota){return Err("Quota global do cache atingida. Limpe os torrents inativos ou aumente a quota nas configurações.".into());}
    }
    let previous=engine.active.lock().map_err(|_|"Estado torrent indisponível")?.take();
    if let Some((previous,_))=previous{let _=engine.api.api_torrent_action_pause(previous.into()).await;}
    engine.api.api_torrent_action_update_only_files(id.into(),&HashSet::from([file])).await.map_err(|_|"Não foi possível selecionar o arquivo")?;
    engine.api.api_torrent_action_start(id.into()).await.map_err(|_|"Não foi possível iniciar torrent")?;
    *engine.active.lock().map_err(|_|"Estado torrent indisponível")?=Some((id,file));
    Ok(TorrentPlayback{url:format!("http://127.0.0.1:{}/{}/{id}/{file}",engine.port,engine.token),file:selected.name.clone()})
}
#[tauri::command]
pub async fn stop_torrent(id:usize)->Result<(),String>{
    if let Some(engine)=ENGINE.get(){
        let active=engine.active.lock().map_err(|_|"Estado torrent indisponível")?.as_ref().map(|(active,_)|*active)==Some(id);
        if active{*engine.active.lock().map_err(|_|"Estado torrent indisponível")?=None;}
        engine.api.api_torrent_action_pause(id.into()).await.map_err(|_|"Não foi possível pausar torrent")?;
    }Ok(())
}
#[tauri::command]
pub async fn torrent_stats(id:usize)->Result<serde_json::Value,String>{
    let engine=ENGINE.get().ok_or("Torrent não iniciado")?;
    serde_json::to_value(engine.api.api_stats_v1(id.into()).map_err(|_|"Estatísticas indisponíveis")?).map_err(|_|"Estatísticas inválidas".into())
}
fn folder_bytes(folder:&std::path::Path)->Result<u64,String>{
    if !folder.exists(){return Ok(0)}
    let mut bytes=0u64;
    for entry in std::fs::read_dir(folder).map_err(|_|"Cache indisponível")?{
        let entry=entry.map_err(|_|"Entrada de cache indisponível")?;let meta=entry.path().symlink_metadata().map_err(|_|"Metadados de cache indisponíveis")?;
        if meta.file_type().is_symlink(){continue}
        if meta.is_dir(){bytes=bytes.saturating_add(folder_bytes(&entry.path())?)}else{bytes=bytes.saturating_add(meta.len())}
    }Ok(bytes)
}
fn cache_would_exceed(current:u64,existing:u64,selected:u64,quota:u64)->bool{current.saturating_sub(existing).saturating_add(selected)>quota}
fn clear_owned_folders(root:&std::path::Path)->Result<u64,String>{
    if root.symlink_metadata().map_err(|_|"Cache indisponível")?.file_type().is_symlink(){return Err("O cache não pode ser um link para outra pasta.".into());}
    let root=root.canonicalize().map_err(|_|"Cache indisponível")?;let before=folder_bytes(&root)?;
    for entry in std::fs::read_dir(&root).map_err(|_|"Cache indisponível")?{
        let entry=entry.map_err(|_|"Entrada indisponível")?;let name=entry.file_name().to_string_lossy().into_owned();let meta=entry.path().symlink_metadata().map_err(|_|"Cache indisponível")?;
        if meta.file_type().is_symlink()||!meta.is_dir()||name.len()!=32||!name.chars().all(|c|c.is_ascii_hexdigit()){continue}
        let path=entry.path().canonicalize().map_err(|_|"Pasta indisponível")?;
        if path.starts_with(&root)&&path!=root{std::fs::remove_dir_all(&path).map_err(|_|"Não foi possível limpar arquivos inativos")?;}
    }Ok(before.saturating_sub(folder_bytes(&root)?))
}
#[tauri::command]
pub fn torrent_cache_info()->Result<serde_json::Value,String>{
    let folder=ENGINE.get().map(|e|e.folder.clone()).unwrap_or(dirs::cache_dir().ok_or("Cache indisponível")?.join("anipt").join("torrents"));
    let active=ENGINE.get().map(|e|e.active.lock().map(|a|a.is_some()).unwrap_or(true)).unwrap_or(false);
    Ok(serde_json::json!({"path":folder.to_string_lossy(),"bytes":folder_bytes(&folder)?,"active":active}))
}
#[tauri::command]
pub async fn clear_torrent_cache()->Result<serde_json::Value,String>{
    let engine=engine().await?;let _operation=engine.operations.lock().await;
    if engine.active.lock().map_err(|_|"Estado do cache indisponível")?.is_some(){return Err("Feche o player antes de limpar o cache.".into());}
    if engine.folder.symlink_metadata().map_err(|_|"Cache indisponível")?.file_type().is_symlink(){return Err("O cache não pode ser um link para outra pasta.".into());}
    let root=engine.folder.canonicalize().map_err(|_|"Cache indisponível")?;
    for torrent in engine.api.api_torrent_list().torrents{
        let path=std::path::PathBuf::from(torrent.output_folder).canonicalize().map_err(|_|"Pasta do torrent indisponível")?;
        if !path.starts_with(&root)||path==root{return Err("A pasta não pertence ao cache gerenciado.".into());}
        if let Some(id)=torrent.id{engine.api.api_torrent_action_forget(id.into()).await.map_err(|_|"Não foi possível liberar um torrent inativo")?;}
    }
    Ok(serde_json::json!({"bytes":clear_owned_folders(&engine.folder)?}))
}
fn byte_range(header:Option<&str>,length:u64)->Result<(u64,u64,bool),()>{
    if length==0{return Err(());}
    let Some(header)=header else{return Ok((0,length-1,false));};
    let (start,end)=header.strip_prefix("bytes=").ok_or(())?.split_once('-').ok_or(())?;
    if end.contains(','){return Err(());}
    if start.is_empty(){let suffix=end.parse::<u64>().map_err(|_|())?;if suffix==0{return Err(());}return Ok((length.saturating_sub(suffix),length-1,true));}
    let start=start.parse::<u64>().map_err(|_|())?;let end=if end.is_empty(){length-1}else{end.parse::<u64>().map_err(|_|())?.min(length-1)};
    if start>=length||end<start{return Err(());}Ok((start,end,true))
}
async fn stream_file(State(engine):State<Arc<Engine>>,Path((token,id,file)):Path<(String,usize,usize)>,headers:HeaderMap)->Response{
    if token!=engine.token||engine.active.lock().ok().and_then(|active|*active)!=Some((id,file)){return StatusCode::NOT_FOUND.into_response();}
    let Ok(mut stream)=engine.api.api_stream(id.into(),file).await else{return StatusCode::NOT_FOUND.into_response();};
    let length=stream.len();let Ok((start,end,partial))=byte_range(headers.get("range").and_then(|v|v.to_str().ok()),length)else{return (StatusCode::RANGE_NOT_SATISFIABLE,[("Content-Range",format!("bytes */{length}"))]).into_response();};
    if stream.seek(SeekFrom::Start(start)).await.is_err(){return StatusCode::INTERNAL_SERVER_ERROR.into_response();}
    let body=Body::from_stream(tokio_util::io::ReaderStream::with_capacity(stream.take(end-start+1),65536));
    let mut response=Response::new(body);*response.status_mut()=if partial{StatusCode::PARTIAL_CONTENT}else{StatusCode::OK};
    let mime=engine.api.torrent_file_mime_type(id.into(),file).unwrap_or("application/octet-stream");
    for (key,value) in [("content-type",mime.to_string()),("accept-ranges","bytes".into()),("content-length",(end-start+1).to_string()),("cache-control","no-store".into())]{if let Ok(value)=value.parse(){response.headers_mut().insert(key,value);}}
    if partial{response.headers_mut().insert("content-range",format!("bytes {start}-{end}/{length}").parse().unwrap());}response
}
#[cfg(test)]
mod tests{
    use super::*;
    static TRANSFER_TEST_LOCK:std::sync::Mutex<()>=std::sync::Mutex::new(());
    #[test]fn quota_counts_existing_cache_without_double_counting_the_selected_file(){assert!(!cache_would_exceed(10,6,6,10));assert!(cache_would_exceed(10,6,9,10));assert!(cache_would_exceed(u64::MAX,0,100,16));}
    #[test]fn cache_cleanup_only_removes_managed_folders(){
        let root=std::env::temp_dir().join(format!("anibr-cache-test-{}",uuid::Uuid::new_v4()));let owned=root.join(uuid::Uuid::new_v4().simple().to_string());let unmanaged=root.join("user-notes");std::fs::create_dir_all(&owned).unwrap();std::fs::create_dir_all(&unmanaged).unwrap();std::fs::write(owned.join("episode.mp4"),[1u8;32]).unwrap();std::fs::write(unmanaged.join("keep.txt"),[2u8;5]).unwrap();assert_eq!(folder_bytes(&root).unwrap(),37);assert_eq!(clear_owned_folders(&root).unwrap(),32);assert!(unmanaged.join("keep.txt").exists());assert_eq!(folder_bytes(&root).unwrap(),5);std::fs::remove_dir_all(root).unwrap();
    }
    #[test]fn preparing_metadata_keeps_all_video_files_unselected(){
        let _guard=TRANSFER_TEST_LOCK.lock().unwrap();
        tauri::async_runtime::block_on(async{
            let folder=std::env::temp_dir().join(format!("anibr-metadata-test-{}",uuid::Uuid::new_v4()));std::fs::create_dir_all(&folder).unwrap();let path=folder.join("metadata-only.mp4");std::fs::write(&path,[7u8;64]).unwrap();
            let torrent=librqbit::create_torrent(&path,Default::default(),&librqbit::spawn_utils::BlockingSpawner::new(1)).await.unwrap();let bytes=torrent.as_bytes().unwrap();
            let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();let address=listener.local_addr().unwrap();let app=Router::new().route("/fixture.torrent",get(move||{let bytes=bytes.clone();async move{bytes}}));let server=tokio::spawn(async move{axum::serve(listener,app).await.unwrap()});
            let prepared=prepare_torrent(format!("http://{address}/fixture.torrent")).await.unwrap();let engine=engine().await.unwrap();let details=engine.api.api_torrent_details(prepared.id.into()).unwrap();assert!(details.files.unwrap().iter().all(|file|!file.included));assert_eq!(engine.api.api_stats_v1(prepared.id.into()).unwrap().progress_bytes,0);
            engine.api.api_torrent_action_forget(prepared.id.into()).await.unwrap();server.abort();std::fs::remove_dir_all(folder).unwrap();
        });
    }
    #[test]fn ranges_support_seek_and_suffix(){assert_eq!(byte_range(Some("bytes=10-19"),100),Ok((10,19,true)));assert_eq!(byte_range(Some("bytes=-5"),100),Ok((95,99,true)));assert!(byte_range(Some("bytes=100-"),100).is_err());assert!(byte_range(Some("bytes=0-1,5-9"),100).is_err());}
    #[test]fn only_video_inputs(){assert!(video_file("ep01.mp4"));assert!(!video_file("sample.mp4"));assert!(!video_file("setup.exe"));assert!(!valid_torrent_input("file:///C:/private.file"));}
    #[test]fn local_torrent_stream_is_seekable_private_and_stops(){
        let _guard=TRANSFER_TEST_LOCK.lock().unwrap();
        tauri::async_runtime::block_on(async {
            let engine=engine().await.unwrap();
            let folder=std::env::temp_dir().join(format!("anipt-owned-fixture-{}",uuid::Uuid::new_v4()));std::fs::create_dir_all(&folder).unwrap();
            let data=(0..32768).map(|n|(n%251)as u8).collect::<Vec<_>>();let path=folder.join("fixture.mp4");std::fs::write(&path,&data).unwrap();
            let meta=librqbit::create_torrent(&path,Default::default(),&librqbit::spawn_utils::BlockingSpawner::new(1)).await.unwrap();
            let added=engine.api.api_add_torrent(AddTorrent::from_bytes(meta.as_bytes().unwrap()),Some(AddTorrentOptions{paused:true,overwrite:true,output_folder:Some(folder.to_string_lossy().into_owned()),disable_trackers:true,..Default::default()})).await.unwrap();
            let id=added.id.unwrap();engine.api.mgr_handle(id.into()).unwrap().wait_until_initialized().await.unwrap();
            let playback=start_torrent(id,0).await.unwrap();
            let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(10)).build().unwrap();
            let response=client.get(&playback.url).header("Range","bytes=17-42").send().await.unwrap();assert_eq!(response.status().as_u16(),206);assert_eq!(response.bytes().await.unwrap().as_ref(),&data[17..43]);
            let response=client.get(&playback.url).header("Range","bytes=-10").send().await.unwrap();assert_eq!(response.bytes().await.unwrap().as_ref(),&data[data.len()-10..]);
            let forbidden=playback.url.replace(&engine.token,"wrong-token");assert_eq!(client.get(forbidden).send().await.unwrap().status().as_u16(),404);
            stop_torrent(id).await.unwrap();assert_eq!(client.get(playback.url).send().await.unwrap().status().as_u16(),404);
            // Exercise actual BitTorrent piece transfer with an isolated local peer.
            use tokio::io::AsyncWriteExt;
            let peer_listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();let peer_address=peer_listener.local_addr().unwrap();
            let peer_data=data.clone();
            let peer=tokio::spawn(async move {
                let (mut socket,_)=peer_listener.accept().await.unwrap();let mut handshake=[0u8;68];socket.read_exact(&mut handshake).await.unwrap();handshake[20..28].fill(0);handshake[48..].fill(b'T');socket.write_all(&handshake).await.unwrap();
                socket.write_all(&[0,0,0,2,5,0x80,0,0,0,1,1]).await.unwrap();
                loop {
                    let Ok(length)=socket.read_u32().await else {break};if length==0{continue}if length>1024{break}
                    let mut message=vec![0;length as usize];if socket.read_exact(&mut message).await.is_err(){break}
                    if message[0]==6&&message.len()==13{
                        let piece=u32::from_be_bytes(message[1..5].try_into().unwrap());let begin=u32::from_be_bytes(message[5..9].try_into().unwrap())as usize;let count=u32::from_be_bytes(message[9..13].try_into().unwrap())as usize;
                        assert_eq!(piece,0);assert!(begin+count<=peer_data.len());
                        socket.write_u32((count+9)as u32).await.unwrap();socket.write_all(&[7]).await.unwrap();socket.write_u32(piece).await.unwrap();socket.write_u32(begin as u32).await.unwrap();socket.write_all(&peer_data[begin..begin+count]).await.unwrap();
                    }
                }
            });
            let source=folder.join("peer-fixture.mp4");std::fs::write(&source,&data).unwrap();
            let meta=librqbit::create_torrent(&source,Default::default(),&librqbit::spawn_utils::BlockingSpawner::new(1)).await.unwrap();
            let destination=folder.join("peer-download");std::fs::create_dir_all(&destination).unwrap();
            let added=engine.api.api_add_torrent(AddTorrent::from_bytes(meta.as_bytes().unwrap()),Some(AddTorrentOptions{paused:true,only_files:Some(vec![]),output_folder:Some(destination.to_string_lossy().into_owned()),disable_trackers:true,initial_peers:Some(vec![peer_address]),..Default::default()})).await.unwrap();let id=added.id.unwrap();
            engine.api.mgr_handle(id.into()).unwrap().wait_until_initialized().await.unwrap();let playback=start_torrent(id,0).await.unwrap();
            let response=client.get(&playback.url).header("Range","bytes=17-42").send().await.unwrap();assert_eq!(response.bytes().await.unwrap().as_ref(),&data[17..43]);
            let stats=engine.api.api_stats_v1(id.into()).unwrap();assert!(stats.progress_bytes>0);assert_eq!(stats.uploaded_bytes,0);stop_torrent(id).await.unwrap();peer.abort();
        });
    }
}
