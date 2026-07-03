// Package multi implements a meta-provider that searches across all registered
// providers concurrently and aggregates the search results.
package multi

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/angeloneri/anipt/internal/models"
	"github.com/angeloneri/anipt/internal/providers"
)

const (
	providerKey = "all"
	displayName = "AnimeFire + Goyabu"
)

// videoProviders is the allowlist of providers included when searching "all".
// Only stream-capable providers with direct video access are included.
var videoProviders = map[string]bool{
	"animefire": true,
	"goyabu":    true,
}

// Provider implements providers.Provider by searching all registered providers.
type Provider struct {
	registry *providers.Registry
}

// New creates a new MultiProvider using the given provider registry.
func New(r *providers.Registry) *Provider {
	return &Provider{
		registry: r,
	}
}

// Name returns the unique provider key "all".
func (p *Provider) Name() string { return providerKey }

// DisplayName returns "Todos os Provedores".
func (p *Provider) DisplayName() string { return displayName }

// Search queries all registered providers concurrently (except mock and all itself).
func (p *Provider) Search(ctx context.Context, query string) ([]models.Anime, error) {
	allProviders := p.registry.All()

	var wg sync.WaitGroup
	var mu sync.Mutex
	var aggregated []models.Anime

	for _, prov := range allProviders {
		// Only include providers that deliver direct video streams.
		if !videoProviders[prov.Name()] {
			continue
		}

		wg.Add(1)
		go func(prov providers.Provider) {
			defer wg.Done()

			// Search with a timeout per provider so one slow provider doesn't block everything
			searchCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()

			res, err := prov.Search(searchCtx, query)
			if err != nil {
				// Silently ignore individual provider failures so the search still succeeds
				return
			}

			mu.Lock()
			// Ensure each result retains its respective provider key
			for i := range res {
				res[i].Provider = prov.Name()
			}
			aggregated = append(aggregated, res...)
			mu.Unlock()
		}(prov)
	}

	wg.Wait()

	if len(aggregated) == 0 {
		return nil, fmt.Errorf("nenhum resultado encontrado em nenhum provedor")
	}

	return aggregated, nil
}

// Seasons is a placeholder required by the interface.
// TUI resolves the specific provider dynamically using Anime.Provider instead of calling this.
func (p *Provider) Seasons(ctx context.Context, animeID string) ([]models.Season, error) {
	return nil, fmt.Errorf("multi-provider does not support direct Seasons retrieval")
}

// Episodes is a placeholder required by the interface.
// TUI resolves the specific provider dynamically using Anime.Provider instead of calling this.
func (p *Provider) Episodes(ctx context.Context, animeID string, season int) ([]models.Episode, error) {
	return nil, fmt.Errorf("multi-provider does not support direct Episodes retrieval")
}

// Streams is a placeholder required by the interface.
// TUI resolves the specific provider dynamically using Anime.Provider instead of calling this.
func (p *Provider) Streams(ctx context.Context, episodeID string, language string) ([]models.StreamSource, error) {
	return nil, fmt.Errorf("multi-provider does not support direct Streams retrieval")
}

// Details is a placeholder required by the interface.
// TUI resolves the specific provider dynamically using Anime.Provider instead of calling this.
func (p *Provider) Details(ctx context.Context, animeID string) (*models.Anime, error) {
	return nil, fmt.Errorf("multi-provider does not support direct Details retrieval")
}
