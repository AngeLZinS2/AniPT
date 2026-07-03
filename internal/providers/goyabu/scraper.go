// Package goyabu implements a Provider for the Goyabu streaming site (https://goyabu.io).
// It searches via the WordPress REST API and extracts stream sources by decoding blogger tokens.
package goyabu

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/angeloneri/anipt/internal/models"
	"github.com/angeloneri/anipt/internal/utils"
)

const (
	baseURL     = "https://goyabu.io"
	providerKey = "goyabu"
	displayName = "Goyabu"
)

var (
	goyabuNonceRe       = regexp.MustCompile(`"nonce"\s*:\s*"([a-f0-9]+)"`)
	goyabuPlayersDataRe = regexp.MustCompile(`var\s+playersData\s*=\s*(\[.*?\])\s*;`)
	goyabuBloggerRe     = regexp.MustCompile(`"blogger_token"\s*:\s*"([^"]+)"`)
)

type Provider struct {
	client *utils.HTTPClient
}

func New() *Provider {
	return &Provider{
		client: utils.NewHTTPClient(),
	}
}

func (p *Provider) Name() string        { return providerKey }
func (p *Provider) DisplayName() string { return displayName }

// searchResult represents WP search REST structure
type searchResult struct {
	Title string `json:"title"`
	URL   string `json:"url"`
	Image string `json:"img"`
}

func (p *Provider) Search(ctx context.Context, query string) ([]models.Anime, error) {
	if strings.HasPrefix(query, "genero:") || query == "lancamentos" {
		return p.searchHTML(ctx, query)
	}

	// 1. Fetch homepage to get nonce
	nonce, err := p.fetchNonce(ctx)
	if err != nil {
		// Fallback to HTML search
		return p.searchHTML(ctx, query)
	}

	// 2. Fetch search API
	searchURL := fmt.Sprintf("%s/wp-json/animeonline/search/?keyword=%s&nonce=%s",
		baseURL, url.QueryEscape(query), nonce)

	resp, err := p.client.Get(ctx, searchURL)
	if err != nil {
		return p.searchHTML(ctx, query)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var rawMap map[string]json.RawMessage
	if err := json.Unmarshal(body, &rawMap); err != nil {
		return p.searchHTML(ctx, query)
	}

	var animes []models.Anime
	for _, raw := range rawMap {
		if len(raw) == 0 || raw[0] == '"' {
			continue
		}
		var r searchResult
		if err := json.Unmarshal(raw, &r); err == nil && r.Title != "" && r.URL != "" {
			slug := extractSlug(r.URL)
			animes = append(animes, models.Anime{
				ID:       slug,
				Title:    r.Title,
				CoverURL: r.Image,
				Provider: providerKey,
				Status:   "Em Andamento",
			})
		}
	}

	return animes, nil
}

func (p *Provider) fetchNonce(ctx context.Context) (string, error) {
	resp, err := p.client.Get(ctx, baseURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	matches := goyabuNonceRe.FindSubmatch(body)
	if len(matches) >= 2 {
		return string(matches[1]), nil
	}

	return "", fmt.Errorf("nonce not found")
}

func (p *Provider) searchHTML(ctx context.Context, query string) ([]models.Anime, error) {
	var searchURL string
	if strings.HasPrefix(query, "genero:") {
		genre := strings.TrimPrefix(query, "genero:")
		searchURL = fmt.Sprintf("%s/generos/%s", baseURL, genre)
	} else if query == "lancamentos" {
		searchURL = fmt.Sprintf("%s/lancamentos", baseURL)
	} else {
		searchURL = fmt.Sprintf("%s/?s=%s", baseURL, url.QueryEscape(query))
	}

	resp, err := p.client.Get(ctx, searchURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	var animes []models.Anime
	seen := make(map[string]bool)

	// Broaden selector to capture elements from standard searches, categories and landing pages
	doc.Find("article a, .anime-item a, .post a, a").Each(func(_ int, s *goquery.Selection) {
		href, _ := s.Attr("href")
		if href == "" || !strings.Contains(href, "/anime/") {
			return
		}

		title := ""
		if h := s.Find("h3"); h.Length() > 0 {
			title = strings.TrimSpace(h.Text())
		} else if h := s.Find("h2"); h.Length() > 0 {
			title = strings.TrimSpace(h.Text())
		} else if s.AttrOr("title", "") != "" {
			title = strings.TrimSpace(s.AttrOr("title", ""))
		} else {
			title = strings.TrimSpace(s.Text())
			if idx := strings.Index(title, "\n"); idx >= 0 {
				title = strings.TrimSpace(title[:idx])
			}
		}

		if title == "" || strings.EqualFold(title, "Dublado") || strings.EqualFold(title, "Legendado") {
			return
		}

		slug := extractSlug(href)
		if slug == "" || seen[slug] {
			return
		}
		seen[slug] = true

		imgURL, _ := s.Find("img").Attr("src")
		if imgURL == "" {
			imgURL, _ = s.Find("img").Attr("data-src")
		}

		animes = append(animes, models.Anime{
			ID:       slug,
			Title:    title,
			CoverURL: imgURL,
			Provider: providerKey,
			Status:   "Em Andamento",
		})
	})

	return animes, nil
}

func (p *Provider) Seasons(ctx context.Context, animeID string) ([]models.Season, error) {
	// Goyabu lists all episodes on a single page, meaning it has 1 Season (standard).
	return []models.Season{
		{
			ID:      animeID,
			AnimeID: animeID,
			Number:  1,
			Title:   "1ª Temporada",
		},
	}, nil
}

func (p *Provider) Episodes(ctx context.Context, animeID string, season int) ([]models.Episode, error) {
	animeURL := fmt.Sprintf("%s/anime/%s", baseURL, animeID)
	resp, err := p.client.Get(ctx, animeURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return parseEpisodes(string(body), animeID, season), nil
}

func (p *Provider) Streams(ctx context.Context, episodeID string, language string) ([]models.StreamSource, error) {
	// Goyabu episode IDs are formatted as "?p=ID"
	episodeURL := fmt.Sprintf("%s/%s", baseURL, episodeID)
	if !strings.Contains(episodeID, "?") {
		episodeURL = fmt.Sprintf("%s/?p=%s", baseURL, episodeID)
	}

	resp, err := p.client.Get(ctx, episodeURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	pageHTML := string(body)

	// Try extracting blogger token to request the stream link
	token, bloggerURL := extractPlayerData(pageHTML)
	if token != "" {
		streamURL, err := p.decodeBloggerToken(ctx, token)
		if err == nil && streamURL != "" {
			return []models.StreamSource{
				{
					URL:      streamURL,
					Quality:  "720p",
					Language: language,
					Format:   "mp4",
				},
			}, nil
		}
	}

	// Fallback to iframe or direct blogger URL
	if bloggerURL == "" {
		doc, err := goquery.NewDocumentFromReader(strings.NewReader(pageHTML))
		if err == nil {
			if src, exists := doc.Find("iframe").Attr("src"); exists && src != "" {
				bloggerURL = src
			}
		}
	}

	if bloggerURL != "" {
		return []models.StreamSource{
			{
				URL:      bloggerURL,
				Quality:  "Auto",
				Language: language,
				Format:   "embed",
			},
		}, nil
	}

	return nil, fmt.Errorf("no streams found for Goyabu episode")
}

func (p *Provider) decodeBloggerToken(ctx context.Context, token string) (string, error) {
	ajaxURL := fmt.Sprintf("%s/wp-admin/admin-ajax.php", baseURL)

	data := url.Values{}
	data.Set("action", "decode_blogger_video")
	data.Set("token", token)

	req, err := http.NewRequestWithContext(ctx, "POST", ajaxURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("X-Requested-With", "XMLHttpRequest")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")

	// Use standard http.Client for POST requests
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result struct {
		Success bool `json:"success"`
		Data    struct {
			Play []struct {
				Src  string `json:"src"`
				Size int    `json:"size"`
			} `json:"play"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &result); err != nil {
		// Try fallback to plain string
		str := strings.TrimSpace(string(body))
		if strings.HasPrefix(str, "http") {
			return str, nil
		}
		return "", err
	}

	bestURL := ""
	bestSize := 0
	for _, item := range result.Data.Play {
		if item.Src != "" && item.Size >= bestSize {
			bestURL = item.Src
			bestSize = item.Size
		}
	}

	if bestURL != "" {
		return bestURL, nil
	}

	return "", fmt.Errorf("decode token failed")
}

func extractSlug(link string) string {
	link = strings.TrimPrefix(link, baseURL)
	parts := strings.Split(strings.Trim(link, "/"), "/")
	if len(parts) >= 2 && parts[0] == "anime" {
		return parts[1]
	}
	if len(parts) >= 1 && parts[0] != "" {
		return parts[0]
	}
	return ""
}

// Details returns additional metadata like Synopsis and Genres for the given anime ID.
func (p *Provider) Details(ctx context.Context, animeID string) (*models.Anime, error) {
	animeURL := fmt.Sprintf("%s/anime/%s", baseURL, animeID)
	resp, err := p.client.Get(ctx, animeURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	synopsis := strings.TrimSpace(doc.Find("span.sinopse-full").Text())
	if synopsis == "" {
		synopsis = strings.TrimSpace(doc.Find("div.anime-synopsis").Text())
	}

	var genres []string
	doc.Find(".genres a, .generos a").Each(func(_ int, s *goquery.Selection) {
		genres = append(genres, strings.TrimSpace(s.Text()))
	})

	coverURL, _ := doc.Find(".anime-cover img, .cover img").Attr("src")

	return &models.Anime{
		ID:       animeID,
		Synopsis: synopsis,
		Genres:   genres,
		CoverURL: coverURL,
	}, nil
}

