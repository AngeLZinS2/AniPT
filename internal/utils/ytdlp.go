package utils

import (
	"bytes"
	"context"
	"os/exec"
	"strings"
	"time"
)

// ResolveWithYTDLP attempts to extract the direct video stream URL from an embed URL using yt-dlp.
// Returns the resolved URL, or an empty string and error if yt-dlp is not available or fails.
func ResolveWithYTDLP(ctx context.Context, embedURL string) (string, error) {
	_, err := exec.LookPath("yt-dlp")
	if err != nil {
		return "", err
	}

	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "yt-dlp", "-g", embedURL)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return "", err
	}

	resolved := strings.TrimSpace(stdout.String())
	if resolved == "" {
		return "", err
	}

	// Split by newline in case yt-dlp returns multiple formats and grab the first one
	parts := strings.Split(resolved, "\n")
	return strings.TrimSpace(parts[0]), nil
}
