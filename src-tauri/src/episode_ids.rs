use serde_json::Value;

/// Per-video metadata, after the caller verifies the AniList/Kitsu part.
/// Never derive these coordinates from the display title or a series-wide ID.
#[derive(Clone, Debug, PartialEq)]
pub struct ImdbEpisode {
    pub series_id: String,
    pub season: u64,
    pub episode: u64,
    pub canonical_episode: u64,
    pub canonical_season: u64,
}

impl ImdbEpisode {
    pub fn stream_id(&self) -> String {
        format!("{}:{}:{}", self.series_id, self.season, self.episode)
    }

    pub fn changes_coordinates(&self) -> bool {
        self.season != self.canonical_season || self.episode != self.canonical_episode
    }
}

pub fn from_metadata(meta: &Value, episode_id: &str) -> Result<Option<ImdbEpisode>, String> {
    let Some((canonical, number)) = episode_id.rsplit_once(':') else {
        return Ok(None);
    };
    let Some(kitsu) = canonical.strip_prefix("kitsu:") else {
        return Ok(None);
    };
    if kitsu.is_empty() || !kitsu.chars().all(|c| c.is_ascii_digit()) {
        return Err("Identificador Kitsu inválido".into());
    }
    let number = number
        .parse::<u64>()
        .map_err(|_| "Número de episódio inválido")?;
    if meta.get("id").and_then(Value::as_str) != Some(canonical) {
        return Err("Os metadados de conversão pertencem a outra parte".into());
    }
    let Some(video) = meta
        .get("videos")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .find(|video| video.get("id").and_then(Value::as_str) == Some(episode_id))
    else {
        return Ok(None);
    };
    if video.get("episode").and_then(Value::as_u64) != Some(number) {
        return Err("A conversão de episódio não corresponde ao identificador solicitado".into());
    }
    let root_id = meta.get("imdb_id").and_then(Value::as_str);
    let video_id = video.get("imdb_id").and_then(Value::as_str);
    if root_id.zip(video_id).map(|(a, b)| a != b).unwrap_or(false) {
        return Err("A conversão de episódio retornou séries IMDb diferentes".into());
    }
    let Some(series_id) = video_id.or(root_id) else {
        return Ok(None);
    };
    if !series_id
        .strip_prefix("tt")
        .map(|id| !id.is_empty() && id.chars().all(|c| c.is_ascii_digit()))
        .unwrap_or(false)
    {
        return Err("Identificador IMDb inválido na conversão".into());
    }
    let Some(season) = video
        .get("imdbSeason")
        .and_then(Value::as_u64)
        .filter(|value| *value > 0)
    else {
        return Ok(None);
    };
    let Some(episode) = video
        .get("imdbEpisode")
        .and_then(Value::as_u64)
        .filter(|value| *value > 0)
    else {
        return Ok(None);
    };
    Ok(Some(ImdbEpisode {
        series_id: series_id.into(),
        season,
        episode,
        canonical_episode: number,
        canonical_season: video.get("season").and_then(Value::as_u64).unwrap_or(1),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn metadata() -> Value {
        json!({"id":"kitsu:50024","imdb_id":"tt7441658","videos":[
            {"id":"kitsu:50024:1","season":1,"episode":1,"imdb_id":"tt7441658","imdbSeason":2,"imdbEpisode":1,"absoluteEpisode":171}
        ]})
    }
    #[test]
    fn sequel_uses_explicit_per_episode_coordinates_instead_of_kitsu_local_season_one() {
        let mapped = from_metadata(&metadata(), "kitsu:50024:1")
            .unwrap()
            .unwrap();
        assert_eq!(mapped.stream_id(), "tt7441658:2:1");
        assert!(mapped.changes_coordinates());
        assert_eq!(mapped.canonical_season, 1);
        assert_eq!(mapped.canonical_episode, 1);
    }
    #[test]
    fn missing_mapping_never_guesses_season_from_a_title_or_absolute_number() {
        let mut meta = metadata();
        meta["videos"][0]
            .as_object_mut()
            .unwrap()
            .remove("imdbSeason");
        assert!(from_metadata(&meta, "kitsu:50024:1").unwrap().is_none());
        assert!(from_metadata(&metadata(), "kitsu:50024:2")
            .unwrap()
            .is_none());
    }
    #[test]
    fn conversion_rejects_other_parts_wrong_episode_numbers_and_conflicting_series() {
        assert!(from_metadata(&metadata(), "kitsu:13209:1").is_err());
        let mut meta = metadata();
        meta["videos"][0]["episode"] = json!(2);
        assert!(from_metadata(&meta, "kitsu:50024:1").is_err());
        let mut meta = metadata();
        meta["videos"][0]["imdb_id"] = json!("tt0000000");
        assert!(from_metadata(&meta, "kitsu:50024:1").is_err());
    }
}
