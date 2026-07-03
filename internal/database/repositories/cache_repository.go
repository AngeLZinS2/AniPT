package repositories

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// CacheRepository defines the interface for the SQLite-backed key-value cache.
type CacheRepository interface {
	Get(key string, dest interface{}) error
	Set(key string, value interface{}, ttl time.Duration) error
	Delete(key string) error
	Flush() error
	DeleteExpired() error
}

// ErrCacheMiss is returned when a key is not found or has expired.
var ErrCacheMiss = fmt.Errorf("cache miss")

// sqliteCacheRepository implements CacheRepository using SQLite.
type sqliteCacheRepository struct {
	db *sql.DB
}

// NewCacheRepository constructs a new SQLite-backed CacheRepository.
func NewCacheRepository(db *sql.DB) CacheRepository {
	return &sqliteCacheRepository{db: db}
}

// Get retrieves a cached value by key and deserializes it into dest.
// Returns ErrCacheMiss if the key does not exist or has expired.
func (r *sqliteCacheRepository) Get(key string, dest interface{}) error {
	var raw string
	var expiresAt string

	err := r.db.QueryRow(
		"SELECT value, expires_at FROM cache WHERE key = ?", key,
	).Scan(&raw, &expiresAt)

	if err == sql.ErrNoRows {
		return ErrCacheMiss
	}
	if err != nil {
		return fmt.Errorf("cache: get %q: %w", key, err)
	}

	// Check TTL expiry.
	if t, err := time.Parse(time.RFC3339, expiresAt); err == nil {
		if time.Now().After(t) {
			_ = r.Delete(key)
			return ErrCacheMiss
		}
	}

	if err := json.Unmarshal([]byte(raw), dest); err != nil {
		return fmt.Errorf("cache: unmarshal %q: %w", key, err)
	}
	return nil
}

// Set serializes the value to JSON and stores it with the given TTL.
func (r *sqliteCacheRepository) Set(key string, value interface{}, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("cache: marshal %q: %w", key, err)
	}

	expiresAt := time.Now().Add(ttl).UTC().Format(time.RFC3339)

	_, err = r.db.Exec(`
		INSERT INTO cache (key, value, expires_at)
		VALUES (?, ?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at
	`, key, string(raw), expiresAt)

	if err != nil {
		return fmt.Errorf("cache: set %q: %w", key, err)
	}
	return nil
}

// Delete removes a cache entry by key.
func (r *sqliteCacheRepository) Delete(key string) error {
	_, err := r.db.Exec("DELETE FROM cache WHERE key = ?", key)
	return err
}

// Flush removes all cache entries.
func (r *sqliteCacheRepository) Flush() error {
	_, err := r.db.Exec("DELETE FROM cache")
	return err
}

// DeleteExpired removes all expired cache entries (housekeeping).
func (r *sqliteCacheRepository) DeleteExpired() error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := r.db.Exec("DELETE FROM cache WHERE expires_at < ?", now)
	return err
}
