use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anime {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub title_ptbr: String,
    #[serde(default)]
    pub cover_url: String,
    #[serde(default)]
    pub banner_url: String,
    #[serde(default)]
    pub synopsis: String,
    #[serde(default)]
    pub genres: Vec<String>,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub total_episodes: i64,
    #[serde(default)]
    pub year: i64,
    pub provider: String,
    #[serde(default)]
    pub available_languages: Vec<String>,
    #[serde(default)]
    pub latest_episode: f64,
    #[serde(default)]
    pub aired_at: i64,
    #[serde(default)]
    pub confirmed_release: bool,
    #[serde(default)]
    pub rating: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeFeeds {
    pub trending: Vec<Anime>,
    pub popular: Vec<Anime>,
    pub recent: Vec<Anime>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Season {
    pub id: String,
    pub anime_id: String,
    pub number: i64,
    pub title: String,
    pub episode_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Episode {
    pub id: String,
    pub anime_id: String,
    #[serde(default)]
    pub season_id: String,
    pub season: i64,
    pub number: f64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub duration: i64,
    #[serde(default)]
    pub air_date: String,
    #[serde(default)]
    pub thumbnail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamSource {
    pub url: String,
    pub quality: String,
    pub language: String,
    pub format: String,
    pub is_hls: bool,
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub torrent_file_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Favorite {
    #[serde(default)]
    pub id: i64,
    pub anime_id: String,
    pub anime_title: String,
    pub provider: String,
    #[serde(default)]
    pub cover_url: String,
    #[serde(default)]
    pub synopsis: String,
    #[serde(default)]
    pub added_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    #[serde(default)]
    pub id: i64,
    pub anime_id: String,
    pub anime_title: String,
    pub provider: String,
    pub season: i64,
    pub episode: f64,
    #[serde(default)]
    pub episode_title: String,
    pub language: String,
    pub quality: String,
    #[serde(default)]
    pub watched_at: String,
    #[serde(default)]
    pub timestamp: i64,
    #[serde(default)]
    pub completed: bool,
    #[serde(default)]
    pub duration: i64,
    #[serde(default)]
    pub episode_id: String,
    #[serde(default)]
    pub stream_key: String,
    #[serde(default)]
    pub cover_url: String,
    #[serde(default)]
    pub banner_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerOptions {
    pub url: String,
    #[serde(default)]
    pub anime_title: String,
    #[serde(default = "one")]
    pub season: i64,
    #[serde(default)]
    pub episode: f64,
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub quality: String,
    #[serde(default)]
    pub fullscreen: bool,
    #[serde(default)]
    pub start_at: i64,
    #[serde(default)]
    pub player: Option<String>,
}
fn one() -> i64 {
    1
}
