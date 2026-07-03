// Package favorites provides the business logic for managing the user's
// anime favorites (bookmarks) list.
package favorites

import (
	"fmt"

	"github.com/angeloneri/anipt/internal/database/repositories"
	"github.com/angeloneri/anipt/internal/models"
)

// Service provides favorites business logic.
type Service struct {
	repo repositories.FavoriteRepository
}

// New creates a new favorites Service with the given repository.
func New(repo repositories.FavoriteRepository) *Service {
	return &Service{repo: repo}
}

// Add marks an anime as a favorite.
func (s *Service) Add(anime *models.Anime) error {
	if anime.ID == "" {
		return fmt.Errorf("favorites: anime ID is required")
	}
	return s.repo.Add(&models.Favorite{
		AnimeID:    anime.ID,
		AnimeTitle: anime.Title,
		Provider:   anime.Provider,
		CoverURL:   anime.CoverURL,
		Synopsis:   anime.Synopsis,
	})
}

// Remove removes an anime from favorites.
func (s *Service) Remove(animeID, provider string) error {
	return s.repo.Remove(animeID, provider)
}

// List returns all favorites, most recently added first.
func (s *Service) List() ([]models.Favorite, error) {
	return s.repo.List()
}

// IsFavorite returns true if the given anime is in the favorites list.
func (s *Service) IsFavorite(animeID, provider string) (bool, error) {
	return s.repo.IsFavorite(animeID, provider)
}

// Search finds favorites whose title matches the query.
func (s *Service) Search(query string) ([]models.Favorite, error) {
	return s.repo.FindByTitle(query)
}

// Toggle adds the anime if it is not a favorite, or removes it if it is.
// Returns true if the anime is now a favorite, false if it was removed.
func (s *Service) Toggle(anime *models.Anime) (bool, error) {
	isFav, err := s.repo.IsFavorite(anime.ID, anime.Provider)
	if err != nil {
		return false, err
	}

	if isFav {
		return false, s.repo.Remove(anime.ID, anime.Provider)
	}
	return true, s.repo.Add(&models.Favorite{
		AnimeID:    anime.ID,
		AnimeTitle: anime.Title,
		Provider:   anime.Provider,
		CoverURL:   anime.CoverURL,
		Synopsis:   anime.Synopsis,
	})
}
