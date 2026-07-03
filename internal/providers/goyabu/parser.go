package goyabu

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/angeloneri/anipt/internal/models"
)

var (
	goyabuEpisodePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?:const|let|var)\s+allEpisodes\s*=\s*(\[[\s\S]*?\])\s*;`),
		regexp.MustCompile(`episodes\s*[:=]\s*(\[[\s\S]*?\])`),
		regexp.MustCompile(`"episodes"\s*:\s*(\[[\s\S]*?\])`),
	}
)

type jsEpisode struct {
	ID       json.Number `json:"id"`
	Episodio string      `json:"episodio"`
}

// parseEpisodes extracts episodes from Goyabu HTML body.
// Goyabu embeds episodes list in JS code as JSON: var allEpisodes = [{"id":...}]
func parseEpisodes(html string, animeID string, season int) []models.Episode {
	var episodes []models.Episode

	for _, re := range goyabuEpisodePatterns {
		matches := re.FindStringSubmatch(html)
		if len(matches) < 2 {
			continue
		}

		var epData []jsEpisode
		if err := json.Unmarshal([]byte(matches[1]), &epData); err == nil {
			for i, ep := range epData {
				num := i + 1
				if ep.Episodio != "" {
					if parsed, err := strconv.Atoi(ep.Episodio); err == nil {
						num = parsed
					}
				}

				epID := ep.ID.String()
				if !strings.Contains(epID, "?") {
					epID = "?p=" + epID
				}

				episodes = append(episodes, models.Episode{
					ID:      epID,
					AnimeID: animeID,
					Season:  season,
					Number:  float64(num),
					Title:   fmt.Sprintf("Episódio %d", num),
				})
			}
		}

		if len(episodes) > 0 {
			// Sort episodes in ascending order of their number to prevent swapped episodes
			importSort(episodes)
			return episodes
		}
	}

	// Fallback to link tags
	doc, err := goquery.NewDocumentFromReader(strings.NewReader(html))
	if err == nil {
		doc.Find("a[href]").Each(func(_ int, s *goquery.Selection) {
			href, _ := s.Attr("href")
			if href == "" || (!strings.Contains(href, "/?p=") && !strings.Contains(href, "/episode/")) {
				return
			}

			num := len(episodes) + 1
			if epNum, _ := s.Attr("data-episode-number"); epNum != "" {
				if parsed, err := strconv.Atoi(epNum); err == nil {
					num = parsed
				}
			}

			parts := strings.Split(href, "/")
			epID := parts[len(parts)-1]
			if strings.Contains(href, "?p=") {
				epID = href[strings.Index(href, "?p="):]
			}

			episodes = append(episodes, models.Episode{
				ID:      epID,
				AnimeID: animeID,
				Season:  season,
				Number:  float64(num),
				Title:   fmt.Sprintf("Episódio %d", num),
			})
		})
	}

	importSort(episodes)
	return episodes
}

func importSort(episodes []models.Episode) {
	// helper sort function
	for i := 0; i < len(episodes); i++ {
		for j := i + 1; j < len(episodes); j++ {
			if episodes[i].Number > episodes[j].Number {
				episodes[i], episodes[j] = episodes[j], episodes[i]
			}
		}
	}
}

// extractPlayerData retrieves the token and blogger embed URL from Goyabu html page.
func extractPlayerData(html string) (token, bloggerURL string) {
	if matches := goyabuPlayersDataRe.FindStringSubmatch(html); len(matches) >= 2 {
		var players []struct {
			BloggerToken string `json:"blogger_token"`
			URL          string `json:"url"`
		}
		if err := json.Unmarshal([]byte(matches[1]), &players); err == nil && len(players) > 0 {
			token = players[0].BloggerToken
			bloggerURL = players[0].URL
		}
	}

	if token == "" {
		if matches := goyabuBloggerRe.FindStringSubmatch(html); len(matches) >= 2 {
			token = matches[1]
		}
	}
	return token, bloggerURL
}
