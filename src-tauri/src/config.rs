use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Config {
    pub player: String,
    pub quality: String,
    pub language: String,
    pub provider: String,
    pub fullscreen: bool,
    pub cache: bool,
    pub cache_ttl: i64,
    pub history: bool,
    pub auto_next: bool,
    pub density: String,
    pub notifications: bool,
    pub cache_quota_gb: u64,
    pub database_path: String,
    pub debug: bool,
    pub addons: Vec<String>,
    pub addons_initialized: bool,
    #[serde(default = "legacy_addons_version")]
    pub addons_version: u8,
}

fn legacy_addons_version() -> u8 { 0 }

impl Default for Config {
    fn default() -> Self {
        let db = app_dir().join("anipt.db").to_string_lossy().into_owned();
        Self {
            player: "mpv".into(),
            quality: "best".into(),
            language: "dublado".into(),
            provider: "addon:https://anime-kitsu.strem.fun".into(),
            fullscreen: true,
            cache: true,
            cache_ttl: 3600,
            history: true,
            auto_next: true,
            density: "comfortable".into(),
            notifications: false,
            cache_quota_gb: 16,
            database_path: db,
            debug: false,
            addons: vec![
                "https://animestream-addon.keypop3750.workers.dev".into(),
                "https://anime-kitsu.strem.fun".into(),
            ],
            addons_initialized: true,
            addons_version: 4,
        }
    }
}

pub fn app_dir() -> PathBuf {
    let base = dirs::config_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let path = base.join("anipt");
    let _ = fs::create_dir_all(&path);
    path
}
pub fn load() -> Result<Config, String> {
    let path = app_dir().join("config.yaml");
    if !path.exists() {
        let cfg = Config::default();
        save(&cfg)?;
        return Ok(cfg);
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut cfg: Config = serde_yaml::from_str(&raw).map_err(|e| e.to_string())?;
    if !cfg.addons_initialized {
        for url in ["https://animestream-addon.keypop3750.workers.dev"] {
            if !cfg.addons.iter().any(|x| x == url) { cfg.addons.push(url.into()); }
        }
        cfg.addons_initialized = true;
        save(&cfg)?;
    }
    if cfg.addons_version < 3 {
        for url in [
            "https://animestream-addon.keypop3750.workers.dev",
            "https://anime-kitsu.strem.fun",
        ] {
            if !cfg.addons.iter().any(|x| x == url) { cfg.addons.push(url.into()); }
        }
        cfg.provider = "addon:https://anime-kitsu.strem.fun".into();
        cfg.addons_version = 3;
        save(&cfg)?;
    }
    if cfg.addons_version < 4 {
        remove_retired_addon(&mut cfg);
        cfg.addons_version=4;
        save(&cfg)?;
    }
    Ok(cfg)
}
fn remove_retired_addon(cfg: &mut Config) {
    let retired=|value:&str| reqwest::Url::parse(value).ok().and_then(|url|url.host_str().map(str::to_owned)).as_deref()==Some("animes-br-self.vercel.app");
    cfg.addons.retain(|addon|!retired(addon));
    if cfg.provider.strip_prefix("addon:").map(|value|retired(value.split('|').next().unwrap_or(value))).unwrap_or(false) {
        cfg.provider="addon:https://anime-kitsu.strem.fun".into();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn old_settings_get_new_defaults_without_losing_false_preferences(){
        let cfg:Config=serde_yaml::from_str("auto_next: false\nhistory: false\nlanguage: legendado\nquality: 1080p").unwrap();assert!(!cfg.auto_next);assert!(!cfg.history);assert_eq!(cfg.density,"comfortable");assert_eq!(cfg.cache_quota_gb,16);assert!(!cfg.notifications);
    }
    #[test]
    fn removes_only_retired_animesbr_and_preserves_other_sources() {
        let mut cfg=Config::default();
        assert!(cfg.addons.iter().all(|url|!url.contains("animes-br-self.vercel.app")));
        cfg.addons.push("https://animes-br-self.vercel.app/manifest.json".into());
        cfg.addons.push("https://animesub.duckdns.org/user-config".into());
        cfg.provider="addon:https://animes-br-self.vercel.app|anime".into();
        remove_retired_addon(&mut cfg);
        assert!(!cfg.addons.iter().any(|url|url.contains("animes-br-self.vercel.app")));
        assert!(cfg.addons.iter().any(|url|url.contains("animesub.duckdns.org")));
        assert!(cfg.provider.contains("anime-kitsu.strem.fun"));
    }
}
pub fn save(cfg: &Config) -> Result<(), String> {
    let raw = serde_yaml::to_string(cfg).map_err(|e| e.to_string())?;
    fs::write(app_dir().join("config.yaml"), raw).map_err(|e| e.to_string())
}
