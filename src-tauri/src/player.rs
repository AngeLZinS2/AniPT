use crate::models::PlayerOptions;
use std::{path::PathBuf, process::Command};
fn find(name: &str) -> Option<PathBuf> {
    let exe = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.into()
    };
    if let Some(paths) = std::env::var_os("PATH") {
        for p in std::env::split_paths(&paths) {
            let f = p.join(&exe);
            if f.is_file() {
                return Some(f);
            }
        }
    }
    if cfg!(windows) {
        let candidates = if name == "vlc" {
            vec![
                r"C:\Program Files\VideoLAN\VLC\vlc.exe",
                r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
            ]
        } else {
            vec![r"C:\mpv\mpv.exe", r"C:\Program Files\mpv\mpv.exe"]
        };
        for p in candidates {
            let f = PathBuf::from(p);
            if f.is_file() {
                return Some(f);
            }
        }
    }
    None
}
pub fn available() -> Vec<String> {
    ["mpv", "vlc"]
        .iter()
        .filter(|x| find(x).is_some())
        .map(|x| x.to_string())
        .collect()
}
pub fn play(o: PlayerOptions, default: &str) -> Result<(), String> {
    if o.url.trim().is_empty() {
        return Err("URL do vídeo é obrigatória".into());
    }
    let requested = o.player.as_deref().unwrap_or(default);
    let (name, path) = [requested, "mpv", "vlc"]
        .into_iter()
        .find_map(|n| find(n).map(|p| (n, p)))
        .ok_or("Instale mpv ou VLC para reproduzir vídeos")?;
    let title = format!(
        "{} — S{:02}E{} [{}]",
        o.anime_title, o.season, o.episode, o.quality
    );
    let mut c = Command::new(path);
    c.arg(&o.url);
    if name == "mpv" {
        c.arg(format!("--title={title}"));
        if o.fullscreen {
            c.arg("--fullscreen");
        }
        if o.start_at > 0 {
            c.arg(format!("--start={}", o.start_at));
        }
    } else {
        c.arg(format!("--meta-title={title}"));
        if o.fullscreen {
            c.arg("--fullscreen");
        }
        if o.start_at > 0 {
            c.arg(format!("--start-time={}", o.start_at));
        }
    }
    c.spawn().map_err(|e| e.to_string())?;
    Ok(())
}
