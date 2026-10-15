// AniBR — Anime CLI Brasileiro
// Compatibility entry point; the canonical command lives in cmd/anibr.
package main

import (
	"fmt"
	"os"

	"github.com/angeloneri/anipt/internal/cli"
)

func main() {
	rootCmd := cli.NewRootCmd()

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
