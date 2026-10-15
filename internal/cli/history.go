package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

// newHistoryCmd creates the `anibr history` subcommand.
func newHistoryCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "history",
		Short: "Ver e gerenciar histórico de visualização",
		RunE: func(cmd *cobra.Command, args []string) error {
			entries, err := container.historySvc.List(20)
			if err != nil {
				return fmt.Errorf("falha ao carregar histórico: %w", err)
			}

			if len(entries) == 0 {
				fmt.Println("Histórico vazio.")
				return nil
			}

			fmt.Println("📋 Histórico de visualização:")
			fmt.Println()
			for _, e := range entries {
				lang := "DUB"
				if e.Language == "legendado" {
					lang = "LEG"
				}
				completed := " "
				if e.Completed {
					completed = "✓"
				}
				fmt.Printf(
					"  [%s] %s — S%02dE%05.1f [%s] [%s] — %s\n",
					completed,
					e.AnimeTitle,
					e.Season, e.Episode,
					lang, e.Quality,
					e.WatchedAt.Format("02/01/2006 15:04"),
				)
			}
			return nil
		},
	}

	// Subcommand: clear history.
	clearCmd := &cobra.Command{
		Use:   "clear",
		Short: "Limpar todo o histórico",
		RunE: func(cmd *cobra.Command, args []string) error {
			if err := container.historySvc.Clear(); err != nil {
				return fmt.Errorf("falha ao limpar histórico: %w", err)
			}
			fmt.Println("✓ Histórico limpo com sucesso.")
			return nil
		},
	}

	cmd.AddCommand(clearCmd)
	return cmd
}
