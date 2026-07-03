// Package cli implements all Cobra subcommands for the AniPT CLI.
package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/angeloneri/anipt/internal/config"
	"github.com/angeloneri/anipt/internal/database"
	"github.com/angeloneri/anipt/internal/database/repositories"
	"github.com/angeloneri/anipt/internal/favorites"
	"github.com/angeloneri/anipt/internal/history"
	"github.com/angeloneri/anipt/internal/player"
	"github.com/angeloneri/anipt/internal/providers"
	"github.com/angeloneri/anipt/internal/providers/animefire"
	"github.com/angeloneri/anipt/internal/providers/goyabu"
	"github.com/angeloneri/anipt/internal/providers/multi"
	"github.com/angeloneri/anipt/internal/providers/mock"
	tea "github.com/charmbracelet/bubbletea"

	"github.com/angeloneri/anipt/internal/tui"
)

// appContainer holds all initialized application dependencies.
// It is built once during root command initialization and shared across subcommands.
type appContainer struct {
	cfg          *config.Config
	db           *database.DB
	registry     *providers.Registry
	provider     providers.Provider
	playerFact   *player.Factory
	historySvc   *history.Service
	favoritesSvc *favorites.Service
}

// container is the singleton dependency container initialized by PersistentPreRunE.
var container *appContainer

// NewRootCmd builds and returns the root Cobra command.
func NewRootCmd() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "anipt",
		Short: "AniPT — Anime CLI Brasileiro",
		Long: `
  ╔═══════════════════════════════════╗
  ║           AniPT  v1.0             ║
  ║    Anime CLI em Português (BR)    ║
  ╚═══════════════════════════════════╝

  AniPT é um cliente de terminal para assistir animes em
  português (dublado e legendado) direto no seu terminal.
  
  Repositório: https://github.com/angeloneri/anipt`,
		// Initialize all dependencies before any subcommand runs.
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			return initContainer()
		},
		// Default action: launch the interactive TUI.
		RunE: func(cmd *cobra.Command, args []string) error {
			return launchTUI()
		},
	}

	// Global flags.
	rootCmd.PersistentFlags().StringP("provider", "p", "", "Provedor de streaming (animefire, goyabu, all)")
	rootCmd.PersistentFlags().BoolP("debug", "d", false, "Habilitar logs de debug")

	// Register subcommands.
	rootCmd.AddCommand(newSearchCmd())
	rootCmd.AddCommand(newHistoryCmd())
	rootCmd.AddCommand(newFavoritesCmd())
	rootCmd.AddCommand(newConfigCmd())

	return rootCmd
}

// initContainer bootstraps all application dependencies.
func initContainer() error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("falha ao carregar configuração: %w", err)
	}

	db, err := database.Open(cfg.DatabasePath)
	if err != nil {
		return fmt.Errorf("falha ao abrir banco de dados: %w", err)
	}

	// Build provider registry.
	registry := providers.NewRegistry()
	registry.Register(mock.New())
	registry.Register(animefire.New())
	registry.Register(goyabu.New())
	registry.Register(multi.New(registry))

	// Select active provider from config.
	activeProvider, err := registry.Get(cfg.Provider)
	if err != nil {
		// Fallback to mock if the configured provider is not found.
		fmt.Fprintf(os.Stderr, "Aviso: provedor %q não encontrado, usando mock.\n", cfg.Provider)
		activeProvider, _ = registry.Get("mock")
	}

	histRepo := repositories.NewHistoryRepository(db.DB)
	favRepo := repositories.NewFavoriteRepository(db.DB)

	container = &appContainer{
		cfg:          cfg,
		db:           db,
		registry:     registry,
		provider:     activeProvider,
		playerFact:   player.NewFactory(),
		historySvc:   history.New(histRepo),
		favoritesSvc: favorites.New(favRepo),
	}

	return nil
}

// launchTUI starts the interactive BubbleTea TUI application.
func launchTUI() error {
	app := tui.New(tui.AppDeps{
		Config:       container.cfg,
		Provider:     container.provider,
		Registry:     container.registry,
		PlayerFact:   container.playerFact,
		HistorySvc:   container.historySvc,
		FavoritesSvc: container.favoritesSvc,
	})

	p := tea.NewProgram(
		app,
		tea.WithAltScreen(),       // Use the alternate terminal screen (restores on exit).
		tea.WithMouseCellMotion(), // Enable mouse support for scrolling.
	)

	if _, err := p.Run(); err != nil {
		return fmt.Errorf("erro na interface: %w", err)
	}

	return nil
}
