use serde_json::Value;
use std::collections::HashMap;

// Compare decimal coordinates as decimal strings, never with an epsilon or a
// lossy conversion of the ID suffix to f64. JSON numbers can use an exponent;
// Kitsu IDs themselves use the plain decimal representation.
fn decimal_coordinate(raw: &str, exponent_allowed: bool) -> Option<String> {
    if raw.is_empty() || raw.len() > 512 { return None; }
    let (mantissa, exponent) = if let Some(position) = raw.find(['e', 'E']) {
        if !exponent_allowed { return None; }
        let (mantissa, exponent) = raw.split_at(position);
        (mantissa, exponent[1..].parse::<i32>().ok()?)
    } else { (raw, 0) };
    if !(-324..=308).contains(&exponent) { return None; }
    let (whole, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    if whole.is_empty() || !whole.bytes().all(|byte| byte.is_ascii_digit())
        || !fraction.bytes().all(|byte| byte.is_ascii_digit())
        || (mantissa.contains('.') && fraction.is_empty()) { return None; }
    let digits = format!("{whole}{fraction}");
    let point = whole.len() as i32 + exponent;
    let expanded = if point <= 0 {
        format!("0.{}{digits}", "0".repeat((-point) as usize))
    } else if point as usize >= digits.len() {
        format!("{digits}{}", "0".repeat(point as usize - digits.len()))
    } else {
        format!("{}.{}", &digits[..point as usize], &digits[point as usize..])
    };
    let (whole, fraction) = expanded.split_once('.').unwrap_or((&expanded, ""));
    let whole = whole.trim_start_matches('0');
    let fraction = fraction.trim_end_matches('0');
    if whole.is_empty() && fraction.is_empty() { return None; }
    Some(if fraction.is_empty() { whole.to_owned() } else {
        format!("{}.{fraction}", if whole.is_empty() { "0" } else { whole })
    })
}

fn json_coordinate(value: &Value) -> Option<String> {
    let number = value.as_number()?;
    let finite = number.as_f64()?;
    if !finite.is_finite() || finite <= 0.0 { return None; }
    decimal_coordinate(&number.to_string(), true)
}

fn local_season(video: &Value) -> Result<i64, String> {
    match video.get("season") {
        None => Ok(1),
        Some(value) => json_coordinate(value)
            .filter(|number| !number.contains('.'))
            .and_then(|number| number.parse::<i64>().ok())
            .ok_or_else(|| "A fonte retornou uma temporada local inválida".into()),
    }
}

fn kitsu_episode_id(episode_id: &str) -> Result<Option<(&str, String)>, String> {
    if !episode_id.starts_with("kitsu:") { return Ok(None); }
    let mut parts = episode_id.split(':');
    parts.next();
    let kitsu = parts.next().unwrap_or("");
    let number = parts.next().unwrap_or("");
    if kitsu.is_empty() || !kitsu.bytes().all(|byte| byte.is_ascii_digit())
        || parts.next().is_some() { return Err("Identificador de episódio Kitsu inválido".into()); }
    let number = decimal_coordinate(number, false).ok_or("Número de episódio Kitsu inválido")?;
    let canonical = &episode_id[..episode_id.rfind(':').unwrap()];
    Ok(Some((canonical, number)))
}

/// Coordinates shown by the UI must agree with the requested video ID.
/// A Kitsu ID identifies a part and local episode; it does not encode the
/// franchise's global season. The metadata check below validates that season.
pub fn validate_requested_episode(episode_id: &str, season: i64, episode: f64) -> Result<(), String> {
    if episode_id.trim().is_empty() || season <= 0 || !episode.is_finite() || episode <= 0.0 {
        return Err("Temporada ou episódio solicitado inválido".into());
    }
    let expected = serde_json::Number::from_f64(episode)
        .and_then(|number| decimal_coordinate(&number.to_string(), true))
        .ok_or("Número de episódio solicitado inválido")?;
    if let Some((_, actual)) = kitsu_episode_id(episode_id)? {
        if actual != expected { return Err("O identificador do episódio não corresponde ao número solicitado".into()); }
    }
    Ok(())
}

/// Validate the part-local video contract before presenting or resolving it.
/// Repeated identical entries are harmless; competing IDs/coordinates or
/// different metadata for one ID are ambiguous and cannot be selected by order.
pub fn validate_metadata_episodes(meta: &Value, canonical_id: &str) -> Result<Vec<Value>, String> {
    let videos = match meta.get("videos") {
        None => Vec::new(),
        Some(Value::Array(videos)) => videos.clone(),
        Some(_) => return Err("A fonte retornou uma lista de episódios inválida".into()),
    };
    if !canonical_id.starts_with("kitsu:") { return Ok(videos); }
    if meta.get("id").and_then(Value::as_str) != Some(canonical_id) {
        return Err("Os metadados pertencem a outra parte".into());
    }
    let mut identifiers: HashMap<String, Value> = HashMap::new();
    let mut coordinates: HashMap<(i64, String), String> = HashMap::new();
    let mut validated = Vec::new();
    for mut video in videos {
        let id = video.get("id").and_then(Value::as_str).ok_or("Episódio sem identificador verificável")?.to_owned();
        let (canonical, suffix) = kitsu_episode_id(&id)?
            .ok_or("A fonte retornou um episódio sem ID Kitsu verificável")?;
        if canonical != canonical_id { return Err("A fonte retornou episódios de outra parte".into()); }
        let number = video.get("episode").and_then(json_coordinate)
            .ok_or("A fonte retornou um número de episódio inválido")?;
        if suffix != number { return Err("O ID do episódio não corresponde ao número informado pela fonte".into()); }
        let season = local_season(&video)?;
        video["season"] = Value::from(season);
        if let Some(previous) = identifiers.get(&id) {
            if previous != &video { return Err("A fonte retornou metadados conflitantes para o mesmo episódio".into()); }
            continue;
        }
        if coordinates.insert((season, number), id.clone()).is_some() {
            return Err("A fonte retornou IDs conflitantes para o mesmo episódio".into());
        }
        identifiers.insert(id, video.clone());
        validated.push(video);
    }
    Ok(validated)
}

pub fn validate_requested_metadata(meta: &Value, episode_id: &str, season: i64, episode: f64) -> Result<(), String> {
    validate_requested_episode(episode_id, season, episode)?;
    let Some((canonical, _)) = kitsu_episode_id(episode_id)? else { return Ok(()); };
    let videos = validate_metadata_episodes(meta, canonical)?;
    let video = videos.iter().find(|video| video.get("id").and_then(Value::as_str) == Some(episode_id))
        .ok_or("Os metadados não confirmam o episódio solicitado")?;
    if local_season(video)? != season { return Err("O episódio pertence a outra temporada local".into()); }
    Ok(())
}

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
    let Some((canonical, number)) = kitsu_episode_id(episode_id)? else { return Ok(None); };
    if meta.get("id").and_then(Value::as_str) != Some(canonical) {
        return Err("Os metadados de conversão pertencem a outra parte".into());
    }
    let videos = validate_metadata_episodes(meta, canonical)?;
    let Some(video) = videos.iter()
        .find(|video| video.get("id").and_then(Value::as_str) == Some(episode_id))
    else {
        return Ok(None);
    };
    // Fractional local episodes remain valid Kitsu episodes. The existing IMDb
    // target model is integral, so do not round a fractional episode into it.
    let Ok(number) = number.parse::<u64>() else { return Ok(None); };
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
        canonical_season: local_season(video)? as u64,
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

    #[test]
    fn metadata_id_and_display_number_cannot_identify_different_episodes() {
        let mut meta = metadata();
        meta["videos"][0]["id"] = json!("kitsu:50024:51");
        assert!(validate_metadata_episodes(&meta, "kitsu:50024").is_err());
        meta["videos"][0]["id"] = json!("kitsu:500240:1");
        assert!(validate_metadata_episodes(&meta, "kitsu:50024").is_err());
        meta["videos"][0]["id"] = json!("kitsu:50024:1:3");
        assert!(validate_metadata_episodes(&meta, "kitsu:50024").is_err());
    }

    #[test]
    fn requested_coordinates_are_checked_without_inferring_global_seasons() {
        assert!(validate_requested_episode("kitsu:50024:1", 1, 1.0).is_ok());
        assert!(validate_requested_episode("kitsu:50024:51", 1, 1.0).is_err());
        assert!(validate_requested_episode("kitsu:50024:1", 0, 1.0).is_err());
        for invalid in [0.0, -1.0, f64::NAN, f64::INFINITY] {
            assert!(validate_requested_episode("kitsu:50024:1", 1, invalid).is_err());
        }
        assert!(validate_requested_metadata(&metadata(), "kitsu:50024:1", 1, 1.0).is_ok());
        // IMDb season 2 in the conversion does not make this a local season 2.
        assert!(validate_requested_metadata(&metadata(), "kitsu:50024:1", 2, 1.0).is_err());
        assert!(validate_requested_metadata(&metadata(), "kitsu:50024:2", 1, 2.0).is_err());
    }

    #[test]
    fn metadata_rejects_nonpositive_or_non_numeric_episode_and_season() {
        for invalid in [json!(0), json!(-1), json!("1"), Value::Null] {
            let mut meta = metadata();
            meta["videos"][0]["episode"] = invalid.clone();
            assert!(validate_metadata_episodes(&meta, "kitsu:50024").is_err());
            let mut meta = metadata();
            meta["videos"][0]["season"] = invalid;
            assert!(validate_metadata_episodes(&meta, "kitsu:50024").is_err());
        }
        let mut meta = metadata();
        meta["videos"][0]["season"] = json!(1.5);
        assert!(validate_metadata_episodes(&meta, "kitsu:50024").is_err());
    }

    #[test]
    fn optional_local_season_defaults_to_one_and_integral_numbers_stay_integral() {
        let mut meta = metadata();
        meta["videos"][0].as_object_mut().unwrap().remove("season");
        assert_eq!(validate_metadata_episodes(&meta, "kitsu:50024").unwrap()[0]["season"], json!(1));
        meta["videos"][0]["season"] = json!(2.0);
        meta["videos"][0]["episode"] = json!(1.0);
        assert_eq!(validate_metadata_episodes(&meta, "kitsu:50024").unwrap()[0]["season"], json!(2));
    }

    #[test]
    fn duplicate_episodes_are_deduplicated_only_when_the_metadata_agrees() {
        let mut meta = metadata();
        let original = meta["videos"][0].clone();
        meta["videos"].as_array_mut().unwrap().push(original.clone());
        assert_eq!(validate_metadata_episodes(&meta, "kitsu:50024").unwrap().len(), 1);
        meta["videos"][1]["season"] = json!(2);
        assert!(validate_metadata_episodes(&meta, "kitsu:50024").is_err());
        meta["videos"][1] = original;
        meta["videos"][1]["id"] = json!("kitsu:50024:1.0");
        assert!(validate_metadata_episodes(&meta, "kitsu:50024").is_err());
    }

    #[test]
    fn fractional_episode_ids_remain_exact_without_rounding_to_another_episode() {
        let mut meta = metadata();
        meta["videos"][0]["id"] = json!("kitsu:50024:1.5");
        meta["videos"][0]["episode"] = json!(1.5);
        assert!(validate_requested_metadata(&meta, "kitsu:50024:1.5", 1, 1.5).is_ok());
        assert!(validate_requested_episode("kitsu:50024:1.50", 1, 1.5).is_ok());
        assert!(validate_requested_episode("kitsu:50024:1.5000000000000001", 1, 1.5).is_err());
        assert!(from_metadata(&meta, "kitsu:50024:1.5").unwrap().is_none());
        assert!(validate_requested_episode("kitsu:50024:1e0", 1, 1.0).is_err());
        assert!(validate_requested_episode("kitsu:50024:-1", 1, 1.0).is_err());
    }
}
