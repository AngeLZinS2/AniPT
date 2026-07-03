package repositories

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/angeloneri/anipt/internal/models"
)

// HistoryRepository defines the interface for watch history persistence.
type HistoryRepository interface {
	Add(entry *models.HistoryEntry) error
	List(limit int) ([]models.HistoryEntry, error)
	ListByAnime(animeID, provider string) ([]models.HistoryEntry, error)
	GetLastWatched(animeID, provider string) (*models.HistoryEntry, error)
	Clear() error
}

// sqliteHistoryRepository implements HistoryRepository using SQLite.
type sqliteHistoryRepository struct {
	db *sql.DB
}

// NewHistoryRepository constructs a new SQLite-backed HistoryRepository.
func NewHistoryRepository(db *sql.DB) HistoryRepository {
	return &sqliteHistoryRepository{db: db}
}

// Add inserts a new history entry. Duplicate entries (same anime/season/episode/provider)
// are updated in place rather than creating duplicates.
func (r *sqliteHistoryRepository) Add(e *models.HistoryEntry) error {
	_, err := r.db.Exec(`
		INSERT INTO history
			(anime_id, anime_title, provider, season, episode, episode_title,
			 language, quality, watched_at, timestamp, completed)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		e.AnimeID, e.AnimeTitle, e.Provider, e.Season, e.Episode, e.EpisodeTitle,
		e.Language, e.Quality,
		time.Now().UTC().Format(time.RFC3339),
		e.Timestamp, boolToInt(e.Completed),
	)
	if err != nil {
		return fmt.Errorf("history: add: %w", err)
	}
	return nil
}

// List returns the most recent watch history entries, up to the given limit.
func (r *sqliteHistoryRepository) List(limit int) ([]models.HistoryEntry, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := r.db.Query(`
		SELECT id, anime_id, anime_title, provider, season, episode, episode_title,
		       language, quality, watched_at, timestamp, completed
		FROM history
		ORDER BY watched_at DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("history: list: %w", err)
	}
	defer rows.Close()
	return scanHistory(rows)
}

// ListByAnime returns all history entries for a specific anime.
func (r *sqliteHistoryRepository) ListByAnime(animeID, provider string) ([]models.HistoryEntry, error) {
	rows, err := r.db.Query(`
		SELECT id, anime_id, anime_title, provider, season, episode, episode_title,
		       language, quality, watched_at, timestamp, completed
		FROM history
		WHERE anime_id = ? AND provider = ?
		ORDER BY season ASC, episode ASC
	`, animeID, provider)
	if err != nil {
		return nil, fmt.Errorf("history: list-by-anime %q: %w", animeID, err)
	}
	defer rows.Close()
	return scanHistory(rows)
}

// GetLastWatched returns the most recently watched episode for an anime,
// useful for the "continue watching" feature.
func (r *sqliteHistoryRepository) GetLastWatched(animeID, provider string) (*models.HistoryEntry, error) {
	row := r.db.QueryRow(`
		SELECT id, anime_id, anime_title, provider, season, episode, episode_title,
		       language, quality, watched_at, timestamp, completed
		FROM history
		WHERE anime_id = ? AND provider = ?
		ORDER BY watched_at DESC
		LIMIT 1
	`, animeID, provider)

	var e models.HistoryEntry
	var watchedAt string
	var completed int
	err := row.Scan(
		&e.ID, &e.AnimeID, &e.AnimeTitle, &e.Provider, &e.Season, &e.Episode,
		&e.EpisodeTitle, &e.Language, &e.Quality, &watchedAt, &e.Timestamp, &completed,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("history: get-last-watched %q: %w", animeID, err)
	}
	if t, err := time.Parse(time.RFC3339, watchedAt); err == nil {
		e.WatchedAt = t
	}
	e.Completed = completed != 0
	return &e, nil
}

// Clear deletes all history entries.
func (r *sqliteHistoryRepository) Clear() error {
	_, err := r.db.Exec("DELETE FROM history")
	if err != nil {
		return fmt.Errorf("history: clear: %w", err)
	}
	return nil
}

// scanHistory scans a *sql.Rows result set into a slice of HistoryEntry models.
func scanHistory(rows *sql.Rows) ([]models.HistoryEntry, error) {
	var results []models.HistoryEntry
	for rows.Next() {
		var e models.HistoryEntry
		var watchedAt string
		var completed int
		if err := rows.Scan(
			&e.ID, &e.AnimeID, &e.AnimeTitle, &e.Provider, &e.Season, &e.Episode,
			&e.EpisodeTitle, &e.Language, &e.Quality, &watchedAt, &e.Timestamp, &completed,
		); err != nil {
			return nil, err
		}
		if t, err := time.Parse(time.RFC3339, watchedAt); err == nil {
			e.WatchedAt = t
		}
		e.Completed = completed != 0
		results = append(results, e)
	}
	return results, rows.Err()
}

// boolToInt converts a bool to SQLite's integer representation.
func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
