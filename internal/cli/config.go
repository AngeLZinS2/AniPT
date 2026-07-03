package cli

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// newConfigCmd creates the `anipt config` subcommand for viewing and editing settings.
func newConfigCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "config",
		Short: "Ver e editar configurações",
		RunE: func(cmd *cobra.Command, args []string) error {
			cfg := container.cfg
			fmt.Println("⚙ Configurações atuais:")
			fmt.Println()
			fmt.Printf("  player:     %s\n", cfg.Player)
			fmt.Printf("  quality:    %s\n", cfg.Quality)
			fmt.Printf("  language:   %s\n", cfg.Language)
			fmt.Printf("  provider:   %s\n", cfg.Provider)
			fmt.Printf("  fullscreen: %v\n", cfg.Fullscreen)
			fmt.Printf("  cache:      %v (TTL: %ds)\n", cfg.CacheEnabled, cfg.CacheTTL)
			fmt.Printf("  history:    %v\n", cfg.HistoryEnabled)
			fmt.Printf("  auto_next:  %v\n", cfg.AutoNext)
			fmt.Printf("  database:   %s\n", cfg.DatabasePath)
			fmt.Println()
			fmt.Println("Use 'anipt config set <key> <value>' para alterar uma configuração.")
			return nil
		},
	}

	// Subcommand: set a config value.
	setCmd := &cobra.Command{
		Use:   "set <key> <value>",
		Short: "Alterar uma configuração",
		Args:  cobra.ExactArgs(2),
		Example: `  anipt config set player vlc
  anipt config set quality 720p
  anipt config set language legendado
  anipt config set provider animefire
  anipt config set fullscreen true`,
		RunE: func(cmd *cobra.Command, args []string) error {
			key := args[0]
			value := args[1]

			allowedKeys := map[string]bool{
				"player": true, "quality": true, "language": true,
				"provider": true, "fullscreen": true, "cache": true,
				"cache_ttl": true, "history": true, "auto_next": true,
				"debug": true,
			}

			if !allowedKeys[key] {
				return fmt.Errorf("chave inválida: %q\nChaves válidas: player, quality, language, provider, fullscreen, cache, cache_ttl, history, auto_next, debug", key)
			}

			viper.Set(key, value)
			if err := viper.WriteConfig(); err != nil {
				return fmt.Errorf("falha ao salvar configuração: %w", err)
			}

			fmt.Printf("✓ %s = %s\n", key, value)
			return nil
		},
	}

	cmd.AddCommand(setCmd)
	return cmd
}
