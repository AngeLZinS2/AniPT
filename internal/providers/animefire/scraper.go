// Package animefire implements a Provider for the AnimeFire streaming site (https://animefire.plus).
// This provider is inspired by the AnFireAPI project (https://github.com/MestreTM/AnFireAPI-Anime-Player),
// which documented the scraping patterns for animefire.plus.
//
// AnimeFire serves anime in PT-BR (dubbed and subbed) and is one of the largest
// Brazilian anime streaming sites.
//
// NOTE: Web scraping is inherently fragile. If the site changes its HTML structure,
// the selectors in parser.go must be updated accordingly.
package animefire

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/angeloneri/anipt/internal/models"
	"github.com/angeloneri/anipt/internal/utils"
)

const (
	baseURL     = "https://animefire.io"
	providerKey = "animefire"
	displayName = "AnimeFire"
)

// Provider implements providers.Provider for the AnimeFire website.
// Inspired by: https://github.com/MestreTM/AnFireAPI-Anime-Player
type Provider struct {
	client *utils.HTTPClient
}

// New creates a new AnimeFire provider with a pre-configured HTTP client.
func New() *Provider {
	return &Provider{
		client: utils.NewHTTPClient(),
	}
}

// Name returns the unique provider identifier.
func (p *Provider) Name() string { return providerKey }

// DisplayName returns the human-readable provider name.
func (p *Provider) DisplayName() string { return displayName }

// Search queries the AnimeFire search endpoint or categorised filters for the given query.
func (p *Provider) Search(ctx context.Context, query string) ([]models.Anime, error) {
	var searchURL string
	if strings.HasPrefix(query, "genero:") {
		genre := strings.TrimPrefix(query, "genero:")
		searchURL = fmt.Sprintf("%s/genero/%s", baseURL, genre)
	} else if query == "lancamentos" {
		searchURL = baseURL
	} else {
		// AnimeFire uses URL-path-based search with hyphenated lowercase query.
		cleanQuery := strings.ToLower(query)
		cleanQuery = strings.ReplaceAll(cleanQuery, " ", "-")
		
		// Remove consecutive hyphens
		for strings.Contains(cleanQuery, "--") {
			cleanQuery = strings.ReplaceAll(cleanQuery, "--", "-")
		}

		searchURL = fmt.Sprintf("%s/pesquisar/%s", baseURL, url.PathEscape(cleanQuery))
	}

	doc, err := p.fetchDoc(ctx, searchURL)
	if err != nil {
		return nil, fmt.Errorf("%s: search %q: %w", providerKey, query, err)
	}

	return parseSearchResults(doc, providerKey), nil
}

// Seasons retrieves the seasons/parts available for the given anime.
// For AnimeFire, the anime ID is the URL slug under /animes/{slug}.
func (p *Provider) Seasons(ctx context.Context, animeID string) ([]models.Season, error) {
	animeURL := fmt.Sprintf("%s/animes/%s", baseURL, animeID)

	doc, err := p.fetchDoc(ctx, animeURL)
	if err != nil {
		return nil, fmt.Errorf("%s: seasons %q: %w", providerKey, animeID, err)
	}

	return parseSeasons(doc, animeID), nil
}

// Episodes retrieves the episode list for a given anime and season (part).
func (p *Provider) Episodes(ctx context.Context, animeID string, season int) ([]models.Episode, error) {
	// AnimeFire separates seasons by suffix: /animes/{slug} (season 1),
	// /animes/{slug}-2a-temporada (season 2), etc.
	slug := buildSeasonSlug(animeID, season)
	episodesURL := fmt.Sprintf("%s/animes/%s", baseURL, slug)

	doc, err := p.fetchDoc(ctx, episodesURL)
	if err != nil {
		return nil, fmt.Errorf("%s: episodes %q s%d: %w", providerKey, animeID, season, err)
	}

	return parseEpisodes(doc, animeID, season), nil
}

// Streams returns the video sources for a given episode.
// AnimeFire serves videos via an internal API at /video/{video-id}.
// The episodeID is the episode page slug.
func (p *Provider) Streams(ctx context.Context, episodeID string, language string) ([]models.StreamSource, error) {
	// Fetch the episode page to get the video ID.
	episodeURL := fmt.Sprintf("%s/%s", baseURL, episodeID)

	doc, err := p.fetchDoc(ctx, episodeURL)
	if err != nil {
		return nil, fmt.Errorf("%s: streams %q: %w", providerKey, episodeID, err)
	}

	// AnimeFire embeds the video data URL in a data attribute.
	videoDataURL := extractVideoDataURL(doc)
	if videoDataURL == "" {
		// Try the old-style direct source extraction.
		sources := parseStreams(doc, language)
		if len(sources) > 0 {
			return sources, nil
		}
		return nil, fmt.Errorf("%s: no video URL found for episode %q", providerKey, episodeID)
	}

	// Fetch the video JSON API to get the actual HLS/MP4 sources.
	sources, err := p.fetchVideoSources(ctx, videoDataURL, language)
	if err != nil {
		return nil, fmt.Errorf("%s: fetching video sources for %q: %w", providerKey, episodeID, err)
	}

	return sources, nil
}

// fetchVideoSources calls the AnimeFire internal video API to retrieve stream URLs.
// The API returns a JSON with a "data" array of objects containing "src" and "label".
func (p *Provider) fetchVideoSources(ctx context.Context, videoURL string, language string) ([]models.StreamSource, error) {
	resp, err := p.client.Get(ctx, videoURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// AnimeFire video API response format:
	// {"data": [{"src": "https://...", "label": "720p"}, ...]}
	var result struct {
		Data []struct {
			Src   string `json:"src"`
			Label string `json:"label"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decoding video JSON from %q: %w", videoURL, err)
	}

	var sources []models.StreamSource
	for _, d := range result.Data {
		if d.Src == "" {
			continue
		}
		format := "mp4"
		isHLS := false
		if strings.Contains(d.Src, ".m3u8") {
			format = "m3u8"
			isHLS = true
		}
		quality := d.Label
		if quality == "" {
			quality = "720p"
		}
		sources = append(sources, models.StreamSource{
			URL:      d.Src,
			Quality:  quality,
			Language: language,
			Format:   format,
			IsHLS:    isHLS,
		})
	}

	return sources, nil
}

// Details returns additional metadata like Synopsis and Genres for the given anime ID.
func (p *Provider) Details(ctx context.Context, animeID string) (*models.Anime, error) {
	animeURL := fmt.Sprintf("%s/animes/%s", baseURL, animeID)
	doc, err := p.fetchDoc(ctx, animeURL)
	if err != nil {
		return nil, err
	}

	synopsis := ""
	if synEl := doc.Find("#video_sinopse, .sinopseTexto"); synEl.Length() > 0 {
		synopsis = strings.TrimSpace(synEl.Text())
		synopsis = strings.TrimPrefix(synopsis, "Sinopse:")
		synopsis = strings.TrimSpace(synopsis)
	}

	var genres []string
	doc.Find(".genre, .genres a").Each(func(_ int, s *goquery.Selection) {
		genres = append(genres, strings.TrimSpace(s.Text()))
	})

	coverURL := ""
	if imgEl := doc.Find(".anime-img img, #imagenAnime img"); imgEl.Length() > 0 {
		coverURL = imgEl.AttrOr("src", imgEl.AttrOr("data-src", ""))
	}

	return &models.Anime{
		ID:       animeID,
		Synopsis: synopsis,
		Genres:   genres,
		CoverURL: coverURL,
	}, nil
}

// fetchDoc performs an HTTP GET and returns a parsed goquery Document.
func (p *Provider) fetchDoc(ctx context.Context, rawURL string) (*goquery.Document, error) {
	resp, err := p.client.Get(ctx, rawURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("parsing HTML from %q: %w", rawURL, err)
	}

	return doc, nil
}

// buildSeasonSlug returns the AnimeFire slug for a given season number.
// Season 1 uses the base slug. Season 2+ appends "-Xa-temporada".
func buildSeasonSlug(baseSlug string, season int) string {
	if season <= 1 {
		return baseSlug
	}
	return fmt.Sprintf("%s-%da-temporada", baseSlug, season)
}
