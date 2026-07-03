// Package repositories provides SQLite-backed implementations of the domain repositories.
package repositories

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/angeloneri/anipt/internal/models"
)

// FavoriteRepository defines the interface for favorite persistence operations.
type FavoriteRepository interface {
	Add(favorite *models.Favorite) error
	Remove(animeID, provider string) error
	List() ([]models.Favorite, error)
	IsFavorite(animeID, provider string) (bool, error)
	FindByTitle(query string) ([]models.Favorite, error)
}

// sqliteFavoriteRepository implements FavoriteRepository using SQLite.
type sqliteFavoriteRepository struct {
	db *sql.DB
}

// NewFavoriteRepository constructs a new SQLite-backed FavoriteRepository.
func NewFavoriteRepository(db *sql.DB) FavoriteRepository {
	return &sqliteFavoriteRepository{db: db}
}

// Add inserts or replaces a favorite entry.
func (r *sqliteFavoriteRepository) Add(f *models.Favorite) error {
	_, err := r.db.Exec(`
		INSERT INTO favorites (anime_id, anime_title, provider, cover_url, synopsis, added_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(anime_id, provider) DO UPDATE SET
			anime_title = excluded.anime_title,
			cover_url   = excluded.cover_url,
			synopsis    = excluded.synopsis
	`,
		f.AnimeID, f.AnimeTitle, f.Provider, f.CoverURL, f.Synopsis,
		time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		return fmt.Errorf("favorites: add %q: %w", f.AnimeID, err)
	}
	return nil
}

// Remove deletes a favorite by anime ID and provider.
func (r *sqliteFavoriteRepository) Remove(animeID, provider string) error {
	_, err := r.db.Exec(
		"DELETE FROM favorites WHERE anime_id = ? AND provider = ?",
		animeID, provider,
	)
	if err != nil {
		return fmt.Errorf("favorites: remove %q: %w", animeID, err)
	}
	return nil
}

// List returns all favorites ordered by when they were added (most recent first).
func (r *sqliteFavoriteRepository) List() ([]models.Favorite, error) {
	rows, err := r.db.Query(`
		SELECT id, anime_id, anime_title, provider, cover_url, synopsis, added_at
		FROM favorites
		ORDER BY added_at DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("favorites: list: %w", err)
	}
	defer rows.Close()

	return scanFavorites(rows)
}

// IsFavorite checks whether the given anime is already in the favorites list.
func (r *sqliteFavoriteRepository) IsFavorite(animeID, provider string) (bool, error) {
	var count int
	err := r.db.QueryRow(
		"SELECT COUNT(*) FROM favorites WHERE anime_id = ? AND provider = ?",
		animeID, provider,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("favorites: is-favorite %q: %w", animeID, err)
	}
	return count > 0, nil
}

// FindByTitle returns favorites whose title contains the query (case-insensitive).
func (r *sqliteFavoriteRepository) FindByTitle(query string) ([]models.Favorite, error) {
	rows, err := r.db.Query(`
		SELECT id, anime_id, anime_title, provider, cover_url, synopsis, added_at
		FROM favorites
		WHERE anime_title LIKE ?
		ORDER BY added_at DESC
	`, "%"+query+"%")
	if err != nil {
		return nil, fmt.Errorf("favorites: find-by-title %q: %w", query, err)
	}
	defer rows.Close()

	return scanFavorites(rows)
}

// scanFavorites scans a *sql.Rows result set into a slice of Favorite models.
func scanFavorites(rows *sql.Rows) ([]models.Favorite, error) {
	var results []models.Favorite
	for rows.Next() {
		var f models.Favorite
		var addedAt string
		if err := rows.Scan(
			&f.ID, &f.AnimeID, &f.AnimeTitle, &f.Provider,
			&f.CoverURL, &f.Synopsis, &addedAt,
		); err != nil {
			return nil, err
		}
		if t, err := time.Parse(time.RFC3339, addedAt); err == nil {
			f.AddedAt = t
		}
		results = append(results, f)
	}
	return results, rows.Err()
}
