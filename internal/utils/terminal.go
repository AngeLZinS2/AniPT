package utils

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// TerminalSize returns the current terminal width and height in columns/rows.
// Falls back to 80x24 if the terminal size cannot be determined.
func TerminalSize() (width, height int) {
	// Try stty on Unix-like systems.
	out, err := exec.Command("stty", "size").Output()
	if err == nil {
		parts := strings.Fields(strings.TrimSpace(string(out)))
		if len(parts) == 2 {
			if h, e1 := strconv.Atoi(parts[0]); e1 == nil {
				if w, e2 := strconv.Atoi(parts[1]); e2 == nil && w > 0 {
					return w, h
				}
			}
		}
	}
	return 80, 24
}

// SupportsColor returns true if the terminal likely supports ANSI colors.
func SupportsColor() bool {
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	if os.Getenv("TERM") == "dumb" {
		return false
	}
	return true
}

// ClearScreen writes ANSI escape codes to clear the terminal and move the
// cursor to the top-left corner.
func ClearScreen() {
	fmt.Print("\033[H\033[2J")
}
