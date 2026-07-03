package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

// newFavoritesCmd creates the `anipt favorites` subcommand.
func newFavoritesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:     "favorites",
		Aliases: []string{"fav", "favs"},
		Short:   "Gerenciar lista de favoritos",
		RunE: func(cmd *cobra.Command, args []string) error {
			favs, err := container.favoritesSvc.List()
			if err != nil {
				return fmt.Errorf("falha ao carregar favoritos: %w", err)
			}

			if len(favs) == 0 {
				fmt.Println("Lista de favoritos vazia.")
				fmt.Println("Use a interface interativa (anipt) e pressione Ctrl+F para favoritar um anime.")
				return nil
			}

			fmt.Printf("★ Favoritos (%d):\n\n", len(favs))
			for i, f := range favs {
				fmt.Printf("  %2d. %s  [%s]\n", i+1, f.AnimeTitle, f.Provider)
			}
			return nil
		},
	}

	// Subcommand: remove a favorite by title search.
	removeCmd := &cobra.Command{
		Use:   "remove [title]",
		Short: "Remover anime dos favoritos pelo título",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			query := args[0]
			results, err := container.favoritesSvc.Search(query)
			if err != nil {
				return err
			}
			if len(results) == 0 {
				fmt.Printf("Nenhum favorito encontrado com o título %q.\n", query)
				return nil
			}
			f := results[0]
			if err := container.favoritesSvc.Remove(f.AnimeID, f.Provider); err != nil {
				return err
			}
			fmt.Printf("✗ %s removido dos favoritos.\n", f.AnimeTitle)
			return nil
		},
	}

	cmd.AddCommand(removeCmd)
	return cmd
}
