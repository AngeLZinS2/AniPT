// Package history provides the business logic for recording and querying
// the user's anime watch history.
package history

import (
	"fmt"

	"github.com/angeloneri/anipt/internal/database/repositories"
	"github.com/angeloneri/anipt/internal/models"
)

// Service provides watch history business logic.
type Service struct {
	repo repositories.HistoryRepository
}

// New creates a new history Service with the given repository.
func New(repo repositories.HistoryRepository) *Service {
	return &Service{repo: repo}
}

// Record saves a new watch history entry.
func (s *Service) Record(entry *models.HistoryEntry) error {
	if entry.AnimeID == "" {
		return fmt.Errorf("history: anime ID is required")
	}
	return s.repo.Add(entry)
}

// List returns the most recent history entries, up to the given limit.
func (s *Service) List(limit int) ([]models.HistoryEntry, error) {
	return s.repo.List(limit)
}

// ContinueWatching returns the last-watched episode for a specific anime,
// enabling the "continue watching" feature.
func (s *Service) ContinueWatching(animeID, provider string) (*models.HistoryEntry, error) {
	return s.repo.GetLastWatched(animeID, provider)
}

// WatchedEpisodes returns all history entries for a specific anime, ordered
// by season and episode number.
func (s *Service) WatchedEpisodes(animeID, provider string) ([]models.HistoryEntry, error) {
	return s.repo.ListByAnime(animeID, provider)
}

// Clear deletes all history entries.
func (s *Service) Clear() error {
	return s.repo.Clear()
}
