// AniBR — Anime CLI Brasileiro
// Entry point for the anibr command.
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
