// Package providers defines the Provider interface and utilities for managing
// multiple streaming providers in AniBR.
package providers

import (
	"context"

	"github.com/angeloneri/anipt/internal/models"
)

// Provider is the core interface that every streaming provider must implement.
// Each provider encapsulates all scraping/API logic for a specific website.
// Providers must be stateless and safe for concurrent use.
type Provider interface {
	// Name returns the unique identifier for this provider (e.g., "animesbrasil").
	Name() string

	// DisplayName returns the human-readable name for UI display (e.g., "Animes Brasil").
	DisplayName() string

	// Search queries the provider for animes matching the given query string.
	// Returns a slice of matching Anime models, ordered by relevance.
	Search(ctx context.Context, query string) ([]models.Anime, error)

	// Seasons returns the list of seasons available for the given anime ID.
	Seasons(ctx context.Context, animeID string) ([]models.Season, error)

	// Episodes returns the episodes available for a given season within an anime.
	Episodes(ctx context.Context, animeID string, season int) ([]models.Episode, error)

	// Streams returns all available streaming sources for a specific episode.
	Streams(ctx context.Context, episodeID string, language string) ([]models.StreamSource, error)

	// Details returns additional metadata like Synopsis and Genres for the given anime ID.
	Details(ctx context.Context, animeID string) (*models.Anime, error)
}
