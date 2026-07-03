package models

// Episode represents a single episode within an anime season.
type Episode struct {
	// ID is the provider-specific unique identifier for this episode.
	ID string `json:"id"`
	// AnimeID is the parent anime's identifier.
	AnimeID string `json:"anime_id"`
	// SeasonID is the parent season's identifier.
	SeasonID string `json:"season_id"`
	// Season is the season number this episode belongs to.
	Season int `json:"season"`
	// Number is the episode number within the season (can be fractional, e.g., 5.5).
	Number float64 `json:"number"`
	// Title is the episode's name.
	Title string `json:"title,omitempty"`
	// Duration is the episode duration in seconds (0 if unknown).
	Duration int `json:"duration,omitempty"`
	// AirDate is the original broadcast date in "YYYY-MM-DD" format.
	AirDate string `json:"air_date,omitempty"`
	// Thumbnail is the URL to the episode thumbnail image.
	Thumbnail string `json:"thumbnail,omitempty"`
}
