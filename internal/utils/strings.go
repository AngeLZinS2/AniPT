package utils

import (
	"fmt"
	"strings"
	"unicode"
)

// Truncate shortens a string to the given max length, appending "…" if needed.
func Truncate(s string, maxLen int) string {
	runes := []rune(s)
	if len(runes) <= maxLen {
		return s
	}
	if maxLen <= 1 {
		return "…"
	}
	return string(runes[:maxLen-1]) + "…"
}

// Capitalize returns the string with its first letter uppercased.
func Capitalize(s string) string {
	if s == "" {
		return ""
	}
	r := []rune(s)
	r[0] = unicode.ToUpper(r[0])
	return string(r)
}

// SlugToTitle converts a URL slug to a human-readable title.
// e.g., "dragon-ball-z" → "Dragon Ball Z"
func SlugToTitle(slug string) string {
	words := strings.Split(slug, "-")
	for i, w := range words {
		words[i] = Capitalize(w)
	}
	return strings.Join(words, " ")
}

// FormatEpisode returns a zero-padded episode string for display.
// e.g., 5.0 → "05", 5.5 → "05.5"
func FormatEpisode(n float64) string {
	if n == float64(int(n)) {
		return fmt.Sprintf("%02d", int(n))
	}
	return fmt.Sprintf("%05.1f", n)
}

// FormatDuration converts seconds to a human-readable "mm:ss" or "hh:mm:ss" format.
func FormatDuration(seconds int) string {
	if seconds <= 0 {
		return "--:--"
	}
	h := seconds / 3600
	m := (seconds % 3600) / 60
	s := seconds % 60
	if h > 0 {
		return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
	}
	return fmt.Sprintf("%02d:%02d", m, s)
}
