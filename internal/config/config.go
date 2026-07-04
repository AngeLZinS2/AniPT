// Package config manages the application configuration using Viper.
// Configuration is loaded from config.yaml and can be overridden by
// environment variables prefixed with ANIPT_.
package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/viper"
)

// Config holds all application configuration settings.
type Config struct {
	// Player is the media player to use: "mpv" or "vlc".
	Player string `mapstructure:"player"`
	// Quality is the preferred video quality: "best", "1080p", "720p", "480p", "360p".
	Quality string `mapstructure:"quality"`
	// Language is the preferred audio language: "dublado" or "legendado".
	Language string `mapstructure:"language"`
	// Provider is the name of the active streaming provider.
	Provider string `mapstructure:"provider"`
	// Fullscreen enables fullscreen mode in the media player.
	Fullscreen bool `mapstructure:"fullscreen"`
	// CacheEnabled enables the SQLite-backed response cache.
	CacheEnabled bool `mapstructure:"cache"`
	// CacheTTL is the cache time-to-live in seconds (default 3600 = 1 hour).
	CacheTTL int `mapstructure:"cache_ttl"`
	// HistoryEnabled enables automatic watch history recording.
	HistoryEnabled bool `mapstructure:"history"`
	// AutoNext automatically plays the next episode after the current one ends.
	AutoNext bool `mapstructure:"auto_next"`
	// DatabasePath is the path to the SQLite database file.
	DatabasePath string `mapstructure:"database_path"`
	// Debug enables verbose debug logging.
	Debug bool `mapstructure:"debug"`
}

// configFileName is the name of the configuration file without extension.
const configFileName = "config"

// Load reads the configuration from the config file and returns a Config struct.
// If the file does not exist, it creates one with default values.
func Load() (*Config, error) {
	configDir, err := getConfigDir()
	if err != nil {
		return nil, fmt.Errorf("could not determine config directory: %w", err)
	}

	setDefaults(configDir)

	viper.SetConfigName(configFileName)
	viper.SetConfigType("yaml")
	viper.AddConfigPath(configDir)
	viper.AddConfigPath(".")

	// Allow environment variable overrides prefixed with ANIPT_
	viper.SetEnvPrefix("ANIPT")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			// Config file not found — create it with defaults.
			if err := createDefaultConfig(configDir); err != nil {
				return nil, fmt.Errorf("could not create default config: %w", err)
			}
		} else {
			return nil, fmt.Errorf("could not read config file: %w", err)
		}
	}

	var cfg Config
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("could not unmarshal config: %w", err)
	}

	return &cfg, nil
}

// Save persists the current Viper configuration to disk.
func Save() error {
	return viper.WriteConfig()
}

// Set updates a configuration key and saves the config file.
func Set(key string, value interface{}) error {
	viper.Set(key, value)
	return viper.WriteConfig()
}

// setDefaults registers the default values for all configuration keys.
func setDefaults(configDir string) {
	viper.SetDefault("player", "mpv")
	viper.SetDefault("quality", "best")
	viper.SetDefault("language", "dublado")
	viper.SetDefault("provider", "all")
	viper.SetDefault("fullscreen", true)
	viper.SetDefault("cache", true)
	viper.SetDefault("cache_ttl", 3600)
	viper.SetDefault("history", true)
	viper.SetDefault("auto_next", true)
	viper.SetDefault("database_path", filepath.Join(configDir, "anipt.db"))
	viper.SetDefault("debug", false)
}

// getConfigDir returns the platform-appropriate configuration directory.
// On Linux/macOS: ~/.config/anipt
// On Windows:     %APPDATA%\anipt
func getConfigDir() (string, error) {
	var baseDir string

	// Prefer XDG_CONFIG_HOME on Unix-like systems.
	if xdg := os.Getenv("XDG_CONFIG_HOME"); xdg != "" {
		baseDir = xdg
	} else {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}

		// On Windows, use AppData/Roaming.
		if appData := os.Getenv("APPDATA"); appData != "" {
			baseDir = appData
		} else {
			baseDir = filepath.Join(home, ".config")
		}
	}

	configDir := filepath.Join(baseDir, "anipt")
	if err := os.MkdirAll(configDir, 0o755); err != nil {
		return "", err
	}

	return configDir, nil
}

// createDefaultConfig writes a default config.yaml to the given directory.
func createDefaultConfig(configDir string) error {
	configPath := filepath.Join(configDir, configFileName+".yaml")

	content := `# AniPT Configuration
# Anime CLI PT-BR — https://github.com/angeloneri/anipt

# Media player: "mpv" or "vlc"
player: mpv

# Preferred video quality: "best", "1080p", "720p", "480p", "360p"
quality: best

# Preferred language: "dublado" (dubbed) or "legendado" (subbed)
language: dublado

# Active streaming provider: "multi" (busca em todos), "animefire", "goyabu", "mock"
provider: multi

# Open the player in fullscreen mode
fullscreen: true

# Enable SQLite response cache (reduces network requests)
cache: true

# Cache time-to-live in seconds (3600 = 1 hour)
cache_ttl: 3600

# Enable automatic watch history recording
history: true

# Automatically play the next episode when the current one ends
auto_next: true

# Enable verbose debug output
debug: false
`
	return os.WriteFile(configPath, []byte(content), 0o644)
}
