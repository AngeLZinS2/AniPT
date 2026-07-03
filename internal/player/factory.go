package player

import "fmt"

// Factory creates a Player instance based on the configured player name.
// It also performs auto-detection if the requested player is unavailable.
type Factory struct {
	players []Player
}

// NewFactory creates a Factory pre-loaded with all supported player implementations.
func NewFactory() *Factory {
	return &Factory{
		players: []Player{
			NewMPV(),
			NewVLC(),
		},
	}
}

// Get returns the player matching the given name.
// If the requested player is not available, it falls back to the first
// available player found. Returns an error if no player is available at all.
func (f *Factory) Get(name string) (Player, error) {
	// First, try to find the exact requested player.
	for _, p := range f.players {
		if p.Name() == name && p.IsAvailable() {
			return p, nil
		}
	}

	// Fallback: return the first available player.
	for _, p := range f.players {
		if p.IsAvailable() {
			return p, nil
		}
	}

	return nil, fmt.Errorf(
		"player: no supported player found (install mpv or VLC)\n"+
			"  mpv:  https://mpv.io/installation/\n"+
			"  VLC:  https://www.videolan.org/vlc/",
	)
}

// Available returns the list of players found in the system PATH.
func (f *Factory) Available() []Player {
	var available []Player
	for _, p := range f.players {
		if p.IsAvailable() {
			available = append(available, p)
		}
	}
	return available
}
