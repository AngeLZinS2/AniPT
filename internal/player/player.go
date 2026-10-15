// Package player defines the Player interface and stream options for launching
// external media players (mpv, VLC) from AniBR.
package player

// StreamOptions contains all the parameters needed to launch a media player.
type StreamOptions struct {
	// URL is the direct streaming URL (HLS m3u8 or MP4).
	URL string
	// Title is the window/OSD title shown in the player.
	Title string
	// AnimeTitle is the anime series name.
	AnimeTitle string
	// Season is the season number being played.
	Season int
	// Episode is the episode number being played.
	Episode float64
	// Language is the audio language being used.
	Language string
	// Quality is the video quality label.
	Quality string
	// Fullscreen opens the player in fullscreen mode.
	Fullscreen bool
	// StartAt is the resume position in seconds (0 = from the beginning).
	StartAt int
	// UserAgent is the HTTP User-Agent header passed to the player.
	UserAgent string
	// Referer is the HTTP Referer header passed to the player.
	Referer string
}

// Player is the interface that all external media player implementations must satisfy.
type Player interface {
	// Name returns the human-readable player name (e.g., "mpv", "VLC").
	Name() string
	// IsAvailable returns true if the player binary is found in the system PATH.
	IsAvailable() bool
	// Play launches the player with the given stream options.
	// It blocks until the player process exits.
	Play(opts StreamOptions) error
}
