package utils

import (
	"os/exec"
	"runtime"
	"strings"
)

// OpenBrowser opens the specified URL in the default system browser.
func OpenBrowser(url string) error {
	// Escape characters that cmd.exe might interpret as operators, like '&' or '^'
	if runtime.GOOS == "windows" {
		escapedURL := strings.ReplaceAll(url, "&", "^&")
		return exec.Command("cmd", "/c", "start", escapedURL).Start()
	} else if runtime.GOOS == "darwin" {
		return exec.Command("open", url).Start()
	}
	return exec.Command("xdg-open", url).Start()
}
