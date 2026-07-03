package animefire

import (
	"fmt"
	"net/url"
	"strings"
	"strconv"

	"github.com/PuerkitoBio/goquery"
	"github.com/angeloneri/anipt/internal/models"
)

// parseSearchResults extracts anime results from the AnimeFire search page.
// The search page renders a grid of anime cards under .film_list-wrap .flw-item
func parseSearchResults(doc *goquery.Document, provider string) []models.Anime {
	var animes []models.Anime

	doc.Find("div.div-card-animes, .div-card-animes, .anime-list-ol li, .row.ss-list .col-12, .row .col-6.col-sm-3, article").Each(func(_ int, s *goquery.Selection) {
		titleEl := s.Find(".div-card-animes h3, h3.title, .film-name, h3, .title-name")
		title := strings.TrimSpace(titleEl.Text())
		if title == "" {
			return
		}

		linkEl := s.Find("a").First()
		href, _ := linkEl.Attr("href")
		if href == "" {
			return
		}

		// Extract slug from URL: /animes/{slug}
		slug := extractSlugFromHref(href)
		if slug == "" {
			return
		}

		coverEl := s.Find("img")
		coverURL, _ := coverEl.Attr("src")
		if coverURL == "" {
			coverURL, _ = coverEl.Attr("data-src")
		}

		// Try to detect if it's dubbed.
		typeEl := s.Find(".type, .badge, span")
		typeText := strings.ToLower(typeEl.Text())
		status := "Em Andamento"
		if strings.Contains(typeText, "completo") || strings.Contains(typeText, "finalizado") {
			status = "Completo"
		}

		animes = append(animes, models.Anime{
			ID:       slug,
			Title:    title,
			CoverURL: coverURL,
			Provider: provider,
			Status:   status,
		})
	})

	return animes
}

// parseSeasons extracts available seasons/parts from an anime page.
// AnimeFire shows related parts (temporadas) in a sidebar or links section.
func parseSeasons(doc *goquery.Document, animeID string) []models.Season {
	var seasons []models.Season

	// Try to find season/part links in the page.
	doc.Find(".anime-related-section a, .related-anime a, .list-related a, div.anime-seasons a").Each(func(i int, s *goquery.Selection) {
		href, _ := s.Attr("href")
		text := strings.TrimSpace(s.Text())
		if href == "" || text == "" {
			return
		}
		seasonNum := i + 1
		// Parse season number from text if possible.
		if strings.Contains(strings.ToLower(text), "temporada") {
			for _, word := range strings.Fields(text) {
				if n, err := strconv.Atoi(word); err == nil {
					seasonNum = n
					break
				}
			}
		}
		slug := extractSlugFromHref(href)
		if slug == "" {
			slug = animeID
		}
		seasons = append(seasons, models.Season{
			ID:      slug,
			AnimeID: animeID,
			Number:  seasonNum,
			Title:   text,
		})
	})

	// Always guarantee at least Season 1.
	if len(seasons) == 0 {
		seasons = []models.Season{
			{
				ID:      animeID,
				AnimeID: animeID,
				Number:  1,
				Title:   "1ª Temporada",
			},
		}
	}

	return seasons
}

// parseEpisodes extracts the episode list from an anime page.
// AnimeFire lists episodes in an ordered list: ol.ul-list-ep or similar.
func parseEpisodes(doc *goquery.Document, animeID string, season int) []models.Episode {
	var episodes []models.Episode

	doc.Find("a").Each(func(_ int, s *goquery.Selection) {
		href, _ := s.Attr("href")
		if href == "" {
			return
		}
		if strings.Contains(href, "://") {
			if u, err := url.Parse(href); err == nil {
				href = u.Path
			}
		}

		href = strings.Trim(href, "/")
		parts := strings.Split(href, "/")
		if len(parts) == 3 && parts[0] == "animes" {
			// Check if parts[2] is a valid episode number/segment
			epNum := extractEpisodeNumber(href)
			epID := href

			title := strings.TrimSpace(s.Text())
			if title == "" {
				title = fmt.Sprintf("Episódio %.0f", epNum)
			}

			episodes = append(episodes, models.Episode{
				ID:      epID,
				AnimeID: animeID,
				Season:  season,
				Number:  epNum,
				Title:   title,
			})
		}
	})

	return episodes
}

// parseStreams extracts stream sources directly from an episode page's video tag.
func parseStreams(doc *goquery.Document, language string) []models.StreamSource {
	var sources []models.StreamSource

	doc.Find("video source, source[type='video/mp4'], source[type='application/x-mpegURL']").Each(func(_ int, s *goquery.Selection) {
		src, _ := s.Attr("src")
		label, _ := s.Attr("label")
		srcType, _ := s.Attr("type")

		if src == "" {
			return
		}
		if label == "" {
			label = "720p"
		}

		format := "mp4"
		isHLS := false
		if strings.Contains(srcType, "mpegURL") || strings.Contains(src, ".m3u8") {
			format = "m3u8"
			isHLS = true
		}

		sources = append(sources, models.StreamSource{
			URL:      src,
			Quality:  label,
			Language: language,
			Format:   format,
			IsHLS:    isHLS,
		})
	})

	return sources
}

// extractVideoDataURL finds the AnimeFire internal video API URL embedded in the page.
// AnimeFire uses: <div data-video-url="https://animefire.plus/video/...">
func extractVideoDataURL(doc *goquery.Document) string {
	// Modern AnimeFire: look for elements containing the video endpoint.
	selectors := []string{
		"[data-video-src]",
		"div[data-video-url]",
		"#video_box[data-video-url]",
		"video[data-src]",
	}

	for _, sel := range selectors {
		val, exists := doc.Find(sel).Attr("data-video-src")
		if exists && val != "" {
			return val
		}
		val, exists = doc.Find(sel).Attr("data-video-url")
		if exists && val != "" {
			return val
		}
		val, exists = doc.Find(sel).Attr("data-src")
		if exists && val != "" {
			return val
		}
	}

	// Fallback: scan all script tags for a JSON blob with "/video/".
	var found string
	doc.Find("script").EachWithBreak(func(_ int, s *goquery.Selection) bool {
		text := s.Text()
		if idx := strings.Index(text, "/video/"); idx >= 0 {
			// Find the http/https prefix preceding /video/
			start := strings.LastIndex(text[:idx], "https://")
			if start == -1 {
				start = strings.LastIndex(text[:idx], "http://")
			}
			if start >= 0 {
				end := strings.IndexAny(text[start:], `"' `)
				if end > 0 {
					found = text[start : start+end]
					return false // break
				}
			}
		}
		return true
	})

	return found
}

// extractSlugFromHref extracts the anime slug from a URL path like /animes/{slug}.
func extractSlugFromHref(href string) string {
	if strings.Contains(href, "://") {
		if u, err := url.Parse(href); err == nil {
			href = u.Path
		}
	}
	parts := strings.Split(strings.Trim(href, "/"), "/")
	if len(parts) >= 2 && parts[0] == "animes" {
		return parts[1]
	}
	if len(parts) >= 1 && parts[0] != "" {
		return parts[0]
	}
	return ""
}

// extractEpisodeNumber tries to parse the episode number from an episode URL.
// URL pattern: /animes/{slug}/{episode-number}
func extractEpisodeNumber(href string) float64 {
	href = strings.Trim(href, "/")
	parts := strings.Split(href, "/")
	if len(parts) == 0 {
		return 1
	}
	last := parts[len(parts)-1]
	// Handle episode formats like "1", "1-5" (part 5), etc.
	last = strings.Split(last, "-")[0]
	n, err := strconv.ParseFloat(last, 64)
	if err != nil {
		return 1
	}
	return n
}

// extractEpisodeID returns the relative path used as an episode identifier.
func extractEpisodeID(href string) string {
	if strings.Contains(href, "://") {
		if u, err := url.Parse(href); err == nil {
			href = u.Path
		}
	}
	return strings.Trim(href, "/")
}
