use crate::models::StreamSource;
use regex::Regex;
use serde_json::Value;
use std::sync::OnceLock;

/// AniList titles identify each part separately. T01 in an addon's label may
/// mean the first season *within that part*, so it cannot identify a sequel.
#[derive(Clone)]
pub struct SeasonIdentity {
    requested: Vec<String>,
    other_parts: Vec<String>,
    pub has_prequel: bool,
}

fn normalized_title(text: &str) -> String {
    static ORDINAL: OnceLock<Regex> = OnceLock::new();
    static SEASON: OnceLock<Regex> = OnceLock::new();
    static PUNCTUATION: OnceLock<Regex> = OnceLock::new();
    let text = text.to_lowercase();
    let ordinal = ORDINAL.get_or_init(|| {
        Regex::new(r"\b0*(\d+)(?:st|nd|rd|th|ª|º|a|o)?\s*(season|temporada|part|parte)\b").unwrap()
    });
    let text = ordinal.replace_all(&text, "$2 $1");
    let season = SEASON.get_or_init(|| Regex::new(r"\b(?:season|temporada)\s*0*(\d+)\b").unwrap());
    let text = season.replace_all(&text, "season $1");
    let punctuation = PUNCTUATION.get_or_init(|| Regex::new(r"[^\p{L}\p{N}]+").unwrap());
    punctuation
        .replace_all(&text, " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn titles(media: &Value) -> Vec<String> {
    ["english", "romaji", "native"]
        .iter()
        .filter_map(|key| media.get("title")?.get(*key)?.as_str())
        .map(normalized_title)
        .filter(|title| !title.is_empty())
        .collect()
}

impl SeasonIdentity {
    pub fn from_media(media: &Value) -> Result<Self, String> {
        let requested = titles(media);
        if requested.is_empty() {
            return Err(
                "O catálogo não informou o título necessário para conferir as fontes".into(),
            );
        }
        let other_parts = media
            .pointer("/relations/edges")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter(|edge| {
                matches!(
                    edge.get("relationType").and_then(Value::as_str),
                    Some("PREQUEL" | "SEQUEL")
                )
            })
            .filter_map(|edge| edge.get("node"))
            .filter(|node| node.get("type").and_then(Value::as_str) == Some("ANIME"))
            .flat_map(titles)
            // Some separate parts share an identical translated title. That
            // alias alone is not evidence of a conflicting season.
            .filter(|title| !requested.contains(title))
            .collect();
        Ok(Self {
            requested,
            other_parts,
            has_prequel: media
                .pointer("/relations/edges")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .any(|edge| edge.get("relationType").and_then(Value::as_str) == Some("PREQUEL")),
        })
    }

    fn accepts(&self, stream: &StreamSource) -> bool {
        let label = format!(" {} ", normalized_title(&stream.quality));
        let specificity = |titles: &[String]| {
            titles
                .iter()
                .filter(|title| label.contains(&format!(" {title} ")))
                .map(|title| title.chars().count())
                .max()
                .unwrap_or(0)
        };
        // A longer sequel title also contains its prequel's shorter name.
        // Prefer the most specific known title; do not guess from T01/EP01.
        specificity(&self.other_parts) <= specificity(&self.requested)
    }
}

pub fn filter_streams(streams: &mut Vec<StreamSource>, identity: Option<&SeasonIdentity>) -> usize {
    let before = streams.len();
    if let Some(identity) = identity {
        streams.retain(|stream| identity.accepts(stream));
    }
    before - streams.len()
}

/// In the Fenix IMDb path, a sequel can legitimately carry the base series
/// title. Validate its explicit S/T + episode coordinates instead. A title
/// saying "2nd Season" must never override a conflicting T01 EP01.
pub fn filter_mapped_streams(
    streams: &mut Vec<StreamSource>,
    mapped: &crate::episode_ids::ImdbEpisode,
) -> usize {
    static COORDINATES: OnceLock<Regex> = OnceLock::new();
    let coordinates=COORDINATES.get_or_init(||Regex::new(r"(?i)\b(?:season|temporada|s|t)\s*0*(\d+)\s*[._-]?\s*(?:episode|epis[oó]dio|ep|e)\s*0*(\d+)\b").unwrap());
    let before = streams.len();
    streams.retain(|stream| {
        coordinates
            .captures(&stream.quality)
            .map(|parts| {
                parts[1].parse::<u64>() == Ok(mapped.season)
                    && parts[2].parse::<u64>() == Ok(mapped.episode)
            })
            .unwrap_or(false)
    });
    before - streams.len()
}

/// Nyaa can return a whole collection instead of a single SxxExx video.
/// Retain such candidates for explicit file inspection, never autoplay its fileIdx.
/// Known conflicting parts still cannot masquerade as the requested episode.
pub fn filter_nyaa_streams(
    streams: &mut Vec<StreamSource>,
    mapped: &crate::episode_ids::ImdbEpisode,
    identity: Option<&SeasonIdentity>,
) -> usize {
    static COORDINATES: OnceLock<Regex> = OnceLock::new();
    static COLLECTION: OnceLock<Regex> = OnceLock::new();
    static SEASON: OnceLock<Regex> = OnceLock::new();
    let coordinates = COORDINATES
        .get_or_init(|| Regex::new(r"(?i)\b(?:s|t)0*(\d+)\s*[._-]?\s*(?:e|ep)0*(\d+)\b").unwrap());
    let collection = COLLECTION.get_or_init(|| {
        Regex::new(r"(?i)\bs0*\d+\s*[-+]\s*(?:s)?0*\d+\b|complete collection").unwrap()
    });
    let season =
        SEASON.get_or_init(|| Regex::new(r"(?i)\b(?:season|temporada)\s*0*(\d+)\b").unwrap());
    let before = streams.len();
    streams.retain_mut(|stream| {
        if stream.format != "Torrent" {
            return false;
        }
        let is_collection = collection.is_match(&stream.quality);
        let coords = coordinates
            .captures_iter(&stream.quality)
            .map(|parts| {
                (
                    parts[1].parse::<u64>().unwrap_or(0),
                    parts[2].parse::<u64>().unwrap_or(0),
                )
            })
            .collect::<Vec<_>>();
        if !is_collection {
            let label = format!(" {} ", normalized_title(&stream.quality));
            // These parts appeared in the live T1 response with a spurious '- 1x1'
            // suffix appended by the addon. That suffix is not episode identity.
            for marker in [
                "final season",
                "oad",
                "ova",
                "movie",
                "movies",
                "special",
                "specials",
            ] {
                let requested_has_marker = identity
                    .map(|id| {
                        id.requested
                            .iter()
                            .any(|title| format!(" {title} ").contains(&format!(" {marker} ")))
                    })
                    .unwrap_or(false);
                if label.contains(&format!(" {marker} ")) && !requested_has_marker {
                    return false;
                }
            }
            if !coords.is_empty() {
                return coords
                    .iter()
                    .all(|pair| *pair == (mapped.season, mapped.episode));
            }
            if let Some(identity) = identity {
                if !identity.accepts(stream) {
                    return false;
                }
            }
            if season
                .captures_iter(&stream.quality)
                .any(|parts| parts[1].parse::<u64>() != Ok(mapped.season))
            {
                return false;
            }
        }
        // A batch/fileIdx is only a candidate. The user's file choice must be
        // explicit even when the addon says fileIdx=0 or a previous choice exists.
        stream.torrent_file_index = None;
        stream.requires_file_selection = true;
        true
    });
    before - streams.len()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn identity(second: bool) -> SeasonIdentity {
        let first = json!({"id":97940,"type":"ANIME","title":{"english":"Black Clover","romaji":"Black Clover"}});
        let second_part = json!({"id":195604,"type":"ANIME","title":{"english":"Black Clover Season 2","romaji":"Black Clover 2nd Season"}});
        let (mut current, other, relation) = if second {
            (second_part, first, "PREQUEL")
        } else {
            (first, second_part, "SEQUEL")
        };
        current["relations"] = json!({"edges":[{"relationType":relation,"node":other}]});
        SeasonIdentity::from_media(&current).unwrap()
    }

    fn source(label: &str) -> StreamSource {
        StreamSource {
            url: "https://example.test/video.mp4".into(),
            quality: label.into(),
            language: "Dublado".into(),
            format: "MP4".into(),
            is_hls: false,
            source: "Fixture".into(),
            torrent_file_index: None,
            requires_file_selection: false,
            title:String::new(),seeders:None,episode_target:None,
        }
    }

    #[test]
    fn mixed_black_clover_response_discards_prequel_and_keeps_sequel_local_episode_one() {
        let mut streams = vec![
            source("FenixFlix 1080p 🐦‍🔥 Black Clover 2nd Season\n⏸️ T01 EP01\n🇧🇷 Dublado"),
            source("FenixFlix 1080p 🐦‍🔥 Black Clover\n⏸️ T01 EP01\n🇧🇷 Dublado"),
            source("[Erai-raws] Black Clover 2nd Season - 01 [1080p][MultiSub]"),
        ];
        assert_eq!(filter_streams(&mut streams, Some(&identity(true))), 1);
        assert_eq!(streams.len(), 2);
        assert!(streams
            .iter()
            .all(|stream| stream.quality.contains("2nd Season")));
    }

    #[test]
    fn original_series_does_not_accept_the_more_specific_sequel_title() {
        let mut streams = vec![
            source("Black Clover\nT01 EP01"),
            source("Black Clover Season 2\nT01 EP01"),
        ];
        assert_eq!(filter_streams(&mut streams, Some(&identity(false))), 1);
        assert_eq!(streams[0].quality, "Black Clover\nT01 EP01");
    }

    #[test]
    fn season_aliases_accept_portuguese_ordinals_without_interpreting_local_t01() {
        let requested = identity(true);
        for title in [
            "Black Clover 2ª Temporada",
            "Black Clover Temporada 02",
            "Black Clover 2nd Season",
            "Black Clover Season 2",
        ] {
            assert!(
                requested.accepts(&source(&format!("{title}\nT01 EP01"))),
                "{title}"
            );
        }
        assert!(requested.accepts(&source("Servidor 1080p · Episódio 1")));
    }

    #[test]
    fn identical_catalog_aliases_and_non_season_relations_are_not_conflicts() {
        let identity = SeasonIdentity::from_media(&json!({"title":{"romaji":"Shared title"},"relations":{"edges":[
            {"relationType":"PREQUEL","node":{"type":"ANIME","title":{"romaji":"Shared title"}}},
            {"relationType":"ADAPTATION","node":{"type":"MANGA","title":{"romaji":"Other title"}}}
        ]}})).unwrap();
        assert!(identity.accepts(&source("Shared title · T01 EP01")));
        assert!(identity.accepts(&source("Other title · 1080p")));
    }
    #[test]
    fn mapped_source_rejects_sequel_title_with_original_coordinates_and_accepts_base_title_with_correct_coordinates(
    ) {
        let mapped = crate::episode_ids::ImdbEpisode {
            series_id: "tt7441658".into(),
            season: 2,
            episode: 1,
            canonical_season: 1,
            canonical_episode: 1,
        };
        let mut streams = vec![
            source("Black Clover 2nd Season · T01 EP01"),
            source("Black Clover · T02 EP01 (Ep. 171)"),
            source("Black Clover · S02E02"),
            source("Black Clover 2nd Season · 1080p"),
        ];
        assert_eq!(filter_mapped_streams(&mut streams, &mapped), 3);
        assert_eq!(streams[0].quality, "Black Clover · T02 EP01 (Ep. 171)");
    }
    #[test]
    fn nyaa_aot_batches_remain_candidates_but_final_season_and_oad_do_not() {
        let id = SeasonIdentity::from_media(
            &json!({"title":{"english":"Attack on Titan","romaji":"Shingeki no Kyojin"}}),
        )
        .unwrap();
        let mapped = crate::episode_ids::ImdbEpisode {
            series_id: "tt2560140".into(),
            season: 1,
            episode: 1,
            canonical_season: 1,
            canonical_episode: 1,
        };
        let labels=[
            "[Anime Time] Attack On Titan (Complete Collection) (S01-S04+OVA+Movies) [Batch] - Batch idx=1",
            "[Erai-raws] Shingeki no Kyojin - 01 ~ 25 [1080p][BATCH] - Batch idx=1",
            "[Erai-raws] Shingeki no Kyojin - 01 ~ 25 [1080p] - 1x1",
            "[Erai-raws] Shingeki no Kyojin - The Final Season Part 2 - 01 ~ 12 - 1x1",
            "[Erai-raws] Shingeki no Kyojin - The Final Season - 01 ~ 16 - 1x1",
            "[Erai-raws] Shingeki no Kyojin - 01 ~ 25 [720p] - 1x1",
            "[Erai-raws] Shingeki no Kyojin OAD - 01 ~ 08 [Batch] - Batch idx=1",
            "[Erai-raws] Shingeki no Kyojin - The Final Season Part 2 - 01 ~ 12 [720p] - 1x1",
            "[Anime Time] Attack on Titan S01+02+03+04 (Part 1) +OVA [Batch] - Batch idx=1",
        ];
        let mut items = labels
            .iter()
            .map(|label| {
                let mut s = source(label);
                s.format = "Torrent".into();
                s.torrent_file_index = Some(0);
                s
            })
            .collect::<Vec<_>>();
        assert_eq!(filter_nyaa_streams(&mut items, &mapped, Some(&id)), 4);
        assert_eq!(items.len(), 5);
        assert!(items
            .iter()
            .all(|s| s.requires_file_selection && s.torrent_file_index.is_none()));
        assert!(items
            .iter()
            .all(|s| !s.quality.contains("Final Season") && !s.quality.contains(" Kyojin OAD")));
    }
    #[test]
    fn nyaa_explicit_wrong_episode_is_not_saved_by_an_appended_request_label() {
        let mapped = crate::episode_ids::ImdbEpisode {
            series_id: "tt7441658".into(),
            season: 2,
            episode: 1,
            canonical_season: 1,
            canonical_episode: 1,
        };
        let mut items = [
            "Black Clover S01E01 - 2x1",
            "Black Clover S02E02 - 2x1",
            "Black Clover S02E01 - 2x1",
        ]
        .iter()
        .map(|s| {
            let mut s = source(s);
            s.format = "Torrent".into();
            s
        })
        .collect::<Vec<_>>();
        assert_eq!(filter_nyaa_streams(&mut items, &mapped, None), 2);
        assert_eq!(items.len(), 1);
        assert!(!items[0].requires_file_selection);
    }
}
