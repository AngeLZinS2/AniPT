package repositories

import (
	"database/sql"
	"fmt"
	"time"
)

// RecentSearch represents a single recent search query.
type RecentSearch struct {
	ID         int64
	Query      string
	Provider   string
	SearchedAt time.Time
}

// SearchRepository defines the interface for recent searches persistence.
type SearchRepository interface {
	Add(query, provider string) error
	List(provider string, limit int) ([]RecentSearch, error)
	Clear(provider string) error
}

// sqliteSearchRepository implements SearchRepository using SQLite.
type sqliteSearchRepository struct {
	db *sql.DB
}

// NewSearchRepository constructs a new SQLite-backed SearchRepository.
func NewSearchRepository(db *sql.DB) SearchRepository {
	return &sqliteSearchRepository{db: db}
}

// Add records a new search query. If the same query+provider already exists,
// it updates the timestamp (bringing it to the top of recent searches).
func (r *sqliteSearchRepository) Add(query, provider string) error {
	_, err := r.db.Exec(`
		INSERT INTO recent_searches (query, provider, searched_at)
		VALUES (?, ?, ?)
		ON CONFLICT(query, provider) DO UPDATE SET searched_at = excluded.searched_at
	`, query, provider, time.Now().UTC().Format(time.RFC3339))

	if err != nil {
		return fmt.Errorf("searches: add %q: %w", query, err)
	}

	// Keep only the most recent 20 searches per provider to avoid unbounded growth.
	_, _ = r.db.Exec(`
		DELETE FROM recent_searches
		WHERE provider = ? AND id NOT IN (
			SELECT id FROM recent_searches
			WHERE provider = ?
			ORDER BY searched_at DESC
			LIMIT 20
		)
	`, provider, provider)

	return nil
}

// List returns the most recent searches for a given provider, newest first.
func (r *sqliteSearchRepository) List(provider string, limit int) ([]RecentSearch, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := r.db.Query(`
		SELECT id, query, provider, searched_at
		FROM recent_searches
		WHERE provider = ?
		ORDER BY searched_at DESC
		LIMIT ?
	`, provider, limit)
	if err != nil {
		return nil, fmt.Errorf("searches: list: %w", err)
	}
	defer rows.Close()

	var results []RecentSearch
	for rows.Next() {
		var s RecentSearch
		var ts string
		if err := rows.Scan(&s.ID, &s.Query, &s.Provider, &ts); err != nil {
			return nil, err
		}
		if t, err := time.Parse(time.RFC3339, ts); err == nil {
			s.SearchedAt = t
		}
		results = append(results, s)
	}
	return results, rows.Err()
}

// Clear removes all recent searches for a given provider.
func (r *sqliteSearchRepository) Clear(provider string) error {
	_, err := r.db.Exec("DELETE FROM recent_searches WHERE provider = ?", provider)
	return err
}
