package database

import "fmt"

// migrate runs all schema migrations in order.
// Each migration is idempotent and uses CREATE TABLE IF NOT EXISTS.
func (d *DB) migrate() error {
	if err := d.createMigrationsTable(); err != nil {
		return err
	}

	migrations := []struct {
		version int
		up      string
	}{
		{1, migrationV1},
	}

	for _, m := range migrations {
		applied, err := d.isMigrationApplied(m.version)
		if err != nil {
			return fmt.Errorf("checking migration v%d: %w", m.version, err)
		}
		if applied {
			continue
		}
		if _, err := d.Exec(m.up); err != nil {
			return fmt.Errorf("applying migration v%d: %w", m.version, err)
		}
		if err := d.recordMigration(m.version); err != nil {
			return fmt.Errorf("recording migration v%d: %w", m.version, err)
		}
	}

	return nil
}

// createMigrationsTable ensures the schema_migrations tracking table exists.
func (d *DB) createMigrationsTable() error {
	_, err := d.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version   INTEGER PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`)
	return err
}

// isMigrationApplied returns true if the given version has been applied.
func (d *DB) isMigrationApplied(version int) (bool, error) {
	var count int
	err := d.QueryRow(
		"SELECT COUNT(*) FROM schema_migrations WHERE version = ?", version,
	).Scan(&count)
	return count > 0, err
}

// recordMigration records that the given version has been applied.
func (d *DB) recordMigration(version int) error {
	_, err := d.Exec(
		"INSERT INTO schema_migrations (version) VALUES (?)", version,
	)
	return err
}

// migrationV1 defines the initial database schema.
const migrationV1 = `
-- Favorites: animes bookmarked by the user.
CREATE TABLE IF NOT EXISTS favorites (
	id          INTEGER PRIMARY KEY AUTOINCREMENT,
	anime_id    TEXT    NOT NULL,
	anime_title TEXT    NOT NULL,
	provider    TEXT    NOT NULL DEFAULT '',
	cover_url   TEXT    NOT NULL DEFAULT '',
	synopsis    TEXT    NOT NULL DEFAULT '',
	added_at    TEXT    NOT NULL DEFAULT (datetime('now')),
	UNIQUE(anime_id, provider)
);

-- History: watch history per episode.
CREATE TABLE IF NOT EXISTS history (
	id            INTEGER PRIMARY KEY AUTOINCREMENT,
	anime_id      TEXT    NOT NULL,
	anime_title   TEXT    NOT NULL,
	provider      TEXT    NOT NULL DEFAULT '',
	season        INTEGER NOT NULL DEFAULT 1,
	episode       REAL    NOT NULL,
	episode_title TEXT    NOT NULL DEFAULT '',
	language      TEXT    NOT NULL DEFAULT 'dublado',
	quality       TEXT    NOT NULL DEFAULT 'best',
	watched_at    TEXT    NOT NULL DEFAULT (datetime('now')),
	timestamp     INTEGER NOT NULL DEFAULT 0,
	completed     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_history_anime ON history(anime_id, provider);

-- Cache: generic key-value cache with TTL.
CREATE TABLE IF NOT EXISTS cache (
	key        TEXT    PRIMARY KEY,
	value      TEXT    NOT NULL,
	expires_at TEXT    NOT NULL
);

-- Recent searches: last N search queries per provider.
CREATE TABLE IF NOT EXISTS recent_searches (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	query      TEXT    NOT NULL,
	provider   TEXT    NOT NULL DEFAULT '',
	searched_at TEXT   NOT NULL DEFAULT (datetime('now')),
	UNIQUE(query, provider)
);

-- Settings: persistent key-value application settings.
CREATE TABLE IF NOT EXISTS settings (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
`
