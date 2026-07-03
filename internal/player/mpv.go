package player

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

// MPVPlayer implements the Player interface for the mpv media player.
type MPVPlayer struct{}

// NewMPV creates a new MPVPlayer.
func NewMPV() *MPVPlayer {
	return &MPVPlayer{}
}

// Name returns the player name.
func (m *MPVPlayer) Name() string { return "mpv" }

// IsAvailable returns true if the mpv binary is found in PATH or default install paths.
func (m *MPVPlayer) IsAvailable() bool {
	return mpvBinaryPath() != ""
}

// Play launches mpv with the given stream options and blocks until it exits.
func (m *MPVPlayer) Play(opts StreamOptions) error {
	if opts.URL == "" {
		return fmt.Errorf("mpv: stream URL is required")
	}

	path := mpvBinaryPath()
	if path == "" {
		return fmt.Errorf("mpv: binary not found — install mpv from https://mpv.io/installation/")
	}

	args := buildMPVArgs(opts)
	cmd := exec.Command(path, args...)

	// Allow mpv to inherit stdin/stdout/stderr so its UI is interactive.
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		// mpv exits with code 4 on user quit — treat that as normal.
		if exitErr, ok := err.(*exec.ExitError); ok && exitErr.ExitCode() == 4 {
			return nil
		}
		return fmt.Errorf("mpv exited with error: %w", err)
	}

	return nil
}

// buildMPVArgs constructs the mpv command-line arguments from StreamOptions.
func buildMPVArgs(opts StreamOptions) []string {
	args := []string{opts.URL}

	// OSD title — shows anime name, season, episode, language, and quality.
	title := buildTitle(opts)
	args = append(args, fmt.Sprintf("--title=%s", title))
	args = append(args, fmt.Sprintf("--force-media-title=%s", title))

	// Fullscreen mode.
	if opts.Fullscreen {
		args = append(args, "--fullscreen")
	}

	// Resume from saved position.
	if opts.StartAt > 0 {
		args = append(args, fmt.Sprintf("--start=%d", opts.StartAt))
	}

	if opts.UserAgent != "" {
		args = append(args, fmt.Sprintf("--user-agent=%s", opts.UserAgent))
	}

	if opts.Referer != "" {
		args = append(args, fmt.Sprintf("--referrer=%s", opts.Referer))
	}

	// Save playback position on quit for future resume.
	args = append(args, "--save-position-on-quit=no") // AniPT handles its own history.

	// Disable mpv's built-in cache for HLS streams (AniPT manages caching).
	args = append(args, "--cache=yes")
	args = append(args, "--demuxer-max-bytes=50MiB")

	// Improve subtitle rendering.
	args = append(args, "--sub-auto=fuzzy")

	return args
}

// buildTitle constructs the OSD/window title string for the player.
func buildTitle(opts StreamOptions) string {
	lang := opts.Language
	if lang == "dublado" {
		lang = "DUB"
	} else {
		lang = "LEG"
	}

	return fmt.Sprintf(
		"%s — S%02dE%05.1f [%s] [%s]",
		opts.AnimeTitle,
		opts.Season,
		opts.Episode,
		lang,
		opts.Quality,
	)
}

// mpvBinaryPath finds the mpv binary and returns its full path, or "" if not found.
// On Windows, mpv is often installed as a portable app — no PATH entry.
func mpvBinaryPath() string {
	switch runtime.GOOS {

	case "windows":
		// 1. Try PATH first.
		if p, err := exec.LookPath("mpv.exe"); err == nil {
			return p
		}
		// 2. Common portable installation directories on Windows.
		candidates := []string{
			`C:\mpv\mpv.exe`,
			`C:\Program Files\mpv\mpv.exe`,
			`C:\Program Files (x86)\mpv\mpv.exe`,
			`C:\tools\mpv\mpv.exe`,
			`C:\tools\mpv.exe`,
		}
		// 3. Scoop package manager.
		if userProfile := os.Getenv("USERPROFILE"); userProfile != "" {
			candidates = append(candidates,
				userProfile+`\scoop\apps\mpv\current\mpv.exe`,
				userProfile+`\mpv\mpv.exe`,
			)
		}
		// 4. Chocolatey package manager.
		if choco := os.Getenv("ChocolateyInstall"); choco != "" {
			candidates = append(candidates, choco+`\bin\mpv.exe`)
		}
		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				return c
			}
		}
		return ""

	default:
		if p, err := exec.LookPath("mpv"); err == nil {
			return p
		}
		return ""
	}
}

