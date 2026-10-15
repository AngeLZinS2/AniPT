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
}
