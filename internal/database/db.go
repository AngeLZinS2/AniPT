// Package database provides SQLite database initialization and migration support.
// Uses modernc.org/sqlite (Pure Go, no CGO) for cross-platform compatibility.
package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite" // Register the sqlite driver.
)

// DB wraps the standard sql.DB and provides AniBR-specific helpers.
type DB struct {
	*sql.DB
}

// Open initializes the SQLite database at the given path.
// It applies all pending migrations and configures optimal connection settings.
func Open(dbPath string) (*DB, error) {
	// Ensure the parent directory exists.
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("database: could not create directory %q: %w", dir, err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("database: could not open SQLite at %q: %w", dbPath, err)
	}

	// SQLite is best with a single writer — limit the write connection pool.
	db.SetMaxOpenConns(1)

	// Apply PRAGMA settings for performance and safety.
	pragmas := []string{
		"PRAGMA journal_mode = WAL;",   // Write-Ahead Logging for better concurrency.
		"PRAGMA foreign_keys = ON;",    // Enforce foreign key constraints.
		"PRAGMA synchronous = NORMAL;", // Balance durability vs. performance.
		"PRAGMA cache_size = -8000;",   // 8MB page cache.
		"PRAGMA temp_store = MEMORY;",  // Keep temp tables in memory.
	}

	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("database: could not apply pragma %q: %w", pragma, err)
		}
	}

	wrapped := &DB{db}

	// Run all pending migrations.
	if err := wrapped.migrate(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("database: migration failed: %w", err)
	}

	return wrapped, nil
}

// Close closes the database connection.
func (d *DB) Close() error {
	return d.DB.Close()
}
