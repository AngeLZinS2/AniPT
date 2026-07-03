package models

// Season represents a season (or arc) within an anime series.
type Season struct {
	// ID is the provider-specific unique identifier for this season.
	ID string `json:"id"`
	// AnimeID is the parent anime's identifier.
	AnimeID string `json:"anime_id"`
	// Number is the season number (1-based).
	Number int `json:"number"`
	// Title is the season's name, e.g., "Temporada 2" or "Arco da Guerra Ninja".
	Title string `json:"title"`
	// EpisodeCount is the number of episodes in this season.
	EpisodeCount int `json:"episode_count"`
}
