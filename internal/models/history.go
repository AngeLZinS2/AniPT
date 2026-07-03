package models

import "time"

// HistoryEntry represents a single viewing session recorded in the watch history.
type HistoryEntry struct {
	// ID is the auto-incremented primary key.
	ID int64 `json:"id"`
	// AnimeID is the provider-specific anime identifier.
	AnimeID string `json:"anime_id"`
	// AnimeTitle is the display name of the anime (denormalized for fast reads).
	AnimeTitle string `json:"anime_title"`
	// Provider is the name of the provider used to watch this episode.
	Provider string `json:"provider"`
	// Season is the season number watched.
	Season int `json:"season"`
	// Episode is the episode number watched (can be fractional).
	Episode float64 `json:"episode"`
	// EpisodeTitle is the title of the episode watched.
	EpisodeTitle string `json:"episode_title,omitempty"`
	// Language is the audio language used: "dublado" or "legendado".
	Language string `json:"language"`
	// Quality is the video quality used, e.g., "720p".
	Quality string `json:"quality"`
	// WatchedAt is the timestamp when the viewing session was recorded.
	WatchedAt time.Time `json:"watched_at"`
	// Timestamp is the playback position in seconds where the user stopped.
	Timestamp int `json:"timestamp"`
	// Completed indicates whether the user finished the episode.
	Completed bool `json:"completed"`
}
