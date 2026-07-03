package models

import "time"

// Favorite represents an anime that the user has added to their favorites list.
type Favorite struct {
	// ID is the auto-incremented primary key.
	ID int64 `json:"id"`
	// AnimeID is the provider-specific anime identifier.
	AnimeID string `json:"anime_id"`
	// AnimeTitle is the display name of the anime.
	AnimeTitle string `json:"anime_title"`
	// Provider is the name of the provider this favorite belongs to.
	Provider string `json:"provider"`
	// CoverURL is the URL to the anime's cover image.
	CoverURL string `json:"cover_url,omitempty"`
	// Synopsis is a short description of the anime.
	Synopsis string `json:"synopsis,omitempty"`
	// AddedAt is the timestamp when this anime was added to favorites.
	AddedAt time.Time `json:"added_at"`
}
