package player

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

// VLCPlayer implements the Player interface for the VLC media player.
type VLCPlayer struct{}

// NewVLC creates a new VLCPlayer.
func NewVLC() *VLCPlayer {
	return &VLCPlayer{}
}

// Name returns the player name.
func (v *VLCPlayer) Name() string { return "vlc" }

// IsAvailable returns true if the VLC binary is found in the system PATH
// or in any of the known default installation directories.
func (v *VLCPlayer) IsAvailable() bool {
	path := vlcBinaryPath()
	return path != ""
}

// Play launches VLC with the given stream options and blocks until it exits.
func (v *VLCPlayer) Play(opts StreamOptions) error {
	if opts.URL == "" {
		return fmt.Errorf("vlc: stream URL is required")
	}

	path := vlcBinaryPath()
	if path == "" {
		return fmt.Errorf("vlc: binary not found — install VLC from https://www.videolan.org/vlc/")
	}

	args := buildVLCArgs(opts)
	cmd := exec.Command(path, args...)

	if err := cmd.Run(); err != nil {
		if _, ok := err.(*exec.ExitError); ok {
			// VLC typically exits 0 on normal quit; non-zero is usually user action.
			return nil
		}
		return fmt.Errorf("vlc exited with error: %w", err)
	}

	return nil
}

// buildVLCArgs constructs VLC command-line arguments from StreamOptions.
func buildVLCArgs(opts StreamOptions) []string {
	title := buildTitle(opts)
	args := []string{
		opts.URL,
		fmt.Sprintf("--meta-title=%s", title),
	}

	if opts.Fullscreen {
		args = append(args, "--fullscreen")
	}

	if opts.StartAt > 0 {
		args = append(args, fmt.Sprintf("--start-time=%d", opts.StartAt))
	}

	if opts.UserAgent != "" {
		args = append(args, fmt.Sprintf("--http-user-agent=%s", opts.UserAgent))
	}

	if opts.Referer != "" {
		args = append(args, fmt.Sprintf("--http-referrer=%s", opts.Referer))
	}

	// Improve network streaming performance.
	args = append(args, "--network-caching=1000")

	return args
}

// vlcBinaryPath finds the VLC binary and returns its full path, or "" if not found.
// It checks the system PATH first, then falls back to known default install paths.
func vlcBinaryPath() string {
	switch runtime.GOOS {

	case "windows":
		// 1. Try PATH first (user may have added VLC manually).
		if p, err := exec.LookPath("vlc.exe"); err == nil {
			return p
		}

		// 2. Check the standard Windows installation directories.
		candidates := []string{
			`C:\Program Files\VideoLAN\VLC\vlc.exe`,
			`C:\Program Files (x86)\VideoLAN\VLC\vlc.exe`,
		}

		// 3. Also try the user's LOCALAPPDATA (scoop / portable installs).
		if local := os.Getenv("LOCALAPPDATA"); local != "" {
			candidates = append(candidates, local+`\Programs\VLC\vlc.exe`)
		}
		if appdata := os.Getenv("APPDATA"); appdata != "" {
			candidates = append(candidates, appdata+`\VLC\vlc.exe`)
		}

		for _, c := range candidates {
			if _, err := os.Stat(c); err == nil {
				return c
			}
		}
		return ""

	case "darwin":
		// Standard macOS app bundle location.
		const macPath = "/Applications/VLC.app/Contents/MacOS/VLC"
		if _, err := os.Stat(macPath); err == nil {
			return macPath
		}
		// Homebrew Cask install.
		if p, err := exec.LookPath("vlc"); err == nil {
			return p
		}
		return ""

	default:
		// Linux / BSD: VLC is typically in PATH.
		if p, err := exec.LookPath("vlc"); err == nil {
			return p
		}
		return ""
	}
}
