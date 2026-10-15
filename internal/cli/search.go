package cli

import (
	"context"
	"fmt"
	"time"

	"github.com/spf13/cobra"
)

// newSearchCmd creates the `anibr search [query]` subcommand.
// When a query is provided as an argument, it goes directly to search results.
// Without a query, it launches the TUI home screen.
func newSearchCmd() *cobra.Command {
	return &cobra.Command{
		Use:     "search [query]",
		Short:   "Pesquisar animes",
		Example: "  anibr search \"dragon ball\"\n  anibr search naruto",
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 {
				// No query provided — launch TUI at home screen.
				return launchTUI()
			}

			query := args[0]
			for _, a := range args[1:] {
				query += " " + a
			}

			fmt.Printf("🔍 Pesquisando: %q\n\n", query)

			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()

			results, err := container.provider.Search(ctx, query)
			if err != nil {
				return fmt.Errorf("pesquisa falhou: %w", err)
			}

			if len(results) == 0 {
				fmt.Println("Nenhum resultado encontrado.")
				return nil
			}

			fmt.Printf("Encontrados %d resultados:\n\n", len(results))
			for i, anime := range results {
				title := anime.Title
				if anime.TitlePTBR != "" && anime.TitlePTBR != anime.Title {
					title = fmt.Sprintf("%s (%s)", anime.TitlePTBR, anime.Title)
				}
				fmt.Printf("  %2d. %s\n", i+1, title)
				if anime.Status != "" {
					fmt.Printf("      Status: %s\n", anime.Status)
				}
			}
			fmt.Println()
			fmt.Println("Use `anibr` sem argumentos para a interface interativa completa.")

			return nil
		},
	}
}
