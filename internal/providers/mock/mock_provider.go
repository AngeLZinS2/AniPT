// Package mock provides a fully functional mock Provider implementation.
// It returns realistic anime data without making any network requests,
// which is ideal for development, testing, and offline demonstrations.
package mock

import (
	"context"
	"fmt"
	"strings"

	"github.com/angeloneri/anipt/internal/models"
)

// Provider is a mock implementation of the providers.Provider interface.
type Provider struct{}

// New creates a new mock Provider.
func New() *Provider {
	return &Provider{}
}

// Name returns the unique identifier for this provider.
func (p *Provider) Name() string { return "mock" }

// DisplayName returns the UI-friendly name.
func (p *Provider) DisplayName() string { return "Mock (Demonstração)" }

// Search returns a filtered list of mock animes whose title contains the query.
func (p *Provider) Search(_ context.Context, query string) ([]models.Anime, error) {
	query = strings.ToLower(query)
	var results []models.Anime
	for _, anime := range mockAnimes {
		if query == "" ||
			strings.Contains(strings.ToLower(anime.Title), query) ||
			strings.Contains(strings.ToLower(anime.TitlePTBR), query) {
			results = append(results, anime)
		}
	}
	return results, nil
}

// Seasons returns the seasons for the given anime ID.
func (p *Provider) Seasons(_ context.Context, animeID string) ([]models.Season, error) {
	seasons, ok := mockSeasons[animeID]
	if !ok {
		return nil, fmt.Errorf("mock: anime %q not found", animeID)
	}
	return seasons, nil
}

// Episodes returns the episodes for a given anime and season number.
func (p *Provider) Episodes(_ context.Context, animeID string, season int) ([]models.Episode, error) {
	key := fmt.Sprintf("%s_%d", animeID, season)
	episodes, ok := mockEpisodes[key]
	if !ok {
		return nil, fmt.Errorf("mock: no episodes for anime %q season %d", animeID, season)
	}
	return episodes, nil
}

// Streams returns mock streaming sources for the given episode.
func (p *Provider) Streams(_ context.Context, _ string, language string) ([]models.StreamSource, error) {
	return []models.StreamSource{
		{
			URL:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
			Quality:  "720p",
			Language: language,
			Format:   "mp4",
			IsHLS:    false,
		},
		{
			URL:      "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
			Quality:  "480p",
			Language: language,
			Format:   "mp4",
			IsHLS:    false,
		},
	}, nil
}

// Details returns mock details for the given anime ID.
func (p *Provider) Details(_ context.Context, animeID string) (*models.Anime, error) {
	for _, a := range mockAnimes {
		if a.ID == animeID {
			return &a, nil
		}
	}
	return nil, fmt.Errorf("mock: anime %q not found", animeID)
}

// --- Mock data ---

var mockAnimes = []models.Anime{
	{
		ID:                 "dragon-ball-z",
		Title:              "Dragon Ball Z",
		TitlePTBR:          "Dragon Ball Z",
		CoverURL:           "https://cdn.myanimelist.net/images/anime/2/291831.jpg",
		Synopsis:           "Goku e seus amigos defendem a Terra de vilões cada vez mais poderosos.",
		Genres:             []string{"Ação", "Aventura", "Fantasia"},
		Status:             "completo",
		TotalEpisodes:      291,
		Year:               1989,
		Provider:           "mock",
		AvailableLanguages: []string{models.LanguageDubbed, models.LanguageSubbed},
	},
	{
		ID:                 "naruto",
		Title:              "Naruto",
		TitlePTBR:          "Naruto",
		CoverURL:           "https://cdn.myanimelist.net/images/anime/13/17405.jpg",
		Synopsis:           "Naruto Uzumaki sonha em se tornar o Hokage de sua aldeia.",
		Genres:             []string{"Ação", "Aventura", "Comédia"},
		Status:             "completo",
		TotalEpisodes:      220,
		Year:               2002,
		Provider:           "mock",
		AvailableLanguages: []string{models.LanguageDubbed, models.LanguageSubbed},
	},
	{
		ID:                 "one-piece",
		Title:              "One Piece",
		TitlePTBR:          "One Piece",
		CoverURL:           "https://cdn.myanimelist.net/images/anime/6/73245.jpg",
		Synopsis:           "Monkey D. Luffy parte em busca do lendário tesouro chamado One Piece.",
		Genres:             []string{"Ação", "Aventura", "Comédia", "Fantasia"},
		Status:             "em andamento",
		TotalEpisodes:      1100,
		Year:               1999,
		Provider:           "mock",
		AvailableLanguages: []string{models.LanguageDubbed, models.LanguageSubbed},
	},
	{
		ID:                 "attack-on-titan",
		Title:              "Attack on Titan",
		TitlePTBR:          "Ataque dos Titãs",
		CoverURL:           "https://cdn.myanimelist.net/images/anime/10/47347.jpg",
		Synopsis:           "Num mundo onde gigantes devoram humanos, Eren Yeager jura se vingar.",
		Genres:             []string{"Ação", "Drama", "Terror", "Fantasia"},
		Status:             "completo",
		TotalEpisodes:      87,
		Year:               2013,
		Provider:           "mock",
		AvailableLanguages: []string{models.LanguageDubbed, models.LanguageSubbed},
	},
	{
		ID:                 "demon-slayer",
		Title:              "Demon Slayer: Kimetsu no Yaiba",
		TitlePTBR:          "Demon Slayer: Kimetsu no Yaiba",
		CoverURL:           "https://cdn.myanimelist.net/images/anime/1286/99889.jpg",
		Synopsis:           "Tanjiro Kamado busca a cura de sua irmã transformada em demônio.",
		Genres:             []string{"Ação", "Aventura", "Sobrenatural"},
		Status:             "em andamento",
		TotalEpisodes:      55,
		Year:               2019,
		Provider:           "mock",
		AvailableLanguages: []string{models.LanguageDubbed, models.LanguageSubbed},
	},
	{
		ID:                 "my-hero-academia",
		Title:              "My Hero Academia",
		TitlePTBR:          "Boku no Hero Academia",
		CoverURL:           "https://cdn.myanimelist.net/images/anime/10/78745.jpg",
		Synopsis:           "Em um mundo de super-heróis, Izuku Midoriya nasce sem poderes mas não desiste de seu sonho.",
		Genres:             []string{"Ação", "Comédia", "Super-heróis"},
		Status:             "completo",
		TotalEpisodes:      138,
		Year:               2016,
		Provider:           "mock",
		AvailableLanguages: []string{models.LanguageDubbed, models.LanguageSubbed},
	},
}

var mockSeasons = map[string][]models.Season{
	"dragon-ball-z": {
		{ID: "dbz_s1", AnimeID: "dragon-ball-z", Number: 1, Title: "Saga dos Saiyajins", EpisodeCount: 35},
		{ID: "dbz_s2", AnimeID: "dragon-ball-z", Number: 2, Title: "Saga de Frieza", EpisodeCount: 67},
		{ID: "dbz_s3", AnimeID: "dragon-ball-z", Number: 3, Title: "Saga dos Androides", EpisodeCount: 58},
		{ID: "dbz_s4", AnimeID: "dragon-ball-z", Number: 4, Title: "Saga de Cell", EpisodeCount: 70},
		{ID: "dbz_s5", AnimeID: "dragon-ball-z", Number: 5, Title: "Saga de Majin Buu", EpisodeCount: 61},
	},
	"naruto": {
		{ID: "naruto_s1", AnimeID: "naruto", Number: 1, Title: "Temporada 1 — Land of Waves", EpisodeCount: 80},
		{ID: "naruto_s2", AnimeID: "naruto", Number: 2, Title: "Temporada 2 — Chunin Exams", EpisodeCount: 70},
		{ID: "naruto_s3", AnimeID: "naruto", Number: 3, Title: "Temporada 3 — Invasion of Konoha", EpisodeCount: 70},
	},
	"one-piece": {
		{ID: "op_s1", AnimeID: "one-piece", Number: 1, Title: "East Blue Saga", EpisodeCount: 61},
		{ID: "op_s2", AnimeID: "one-piece", Number: 2, Title: "Alabasta Saga", EpisodeCount: 130},
		{ID: "op_s3", AnimeID: "one-piece", Number: 3, Title: "Sky Island Saga", EpisodeCount: 94},
	},
	"attack-on-titan": {
		{ID: "aot_s1", AnimeID: "attack-on-titan", Number: 1, Title: "Temporada 1", EpisodeCount: 25},
		{ID: "aot_s2", AnimeID: "attack-on-titan", Number: 2, Title: "Temporada 2", EpisodeCount: 12},
		{ID: "aot_s3", AnimeID: "attack-on-titan", Number: 3, Title: "Temporada 3", EpisodeCount: 22},
		{ID: "aot_s4", AnimeID: "attack-on-titan", Number: 4, Title: "The Final Season", EpisodeCount: 28},
	},
	"demon-slayer": {
		{ID: "ds_s1", AnimeID: "demon-slayer", Number: 1, Title: "Temporada 1", EpisodeCount: 26},
		{ID: "ds_s2", AnimeID: "demon-slayer", Number: 2, Title: "Entertainment District Arc", EpisodeCount: 11},
		{ID: "ds_s3", AnimeID: "demon-slayer", Number: 3, Title: "Swordsmith Village Arc", EpisodeCount: 11},
	},
	"my-hero-academia": {
		{ID: "mha_s1", AnimeID: "my-hero-academia", Number: 1, Title: "Temporada 1", EpisodeCount: 13},
		{ID: "mha_s2", AnimeID: "my-hero-academia", Number: 2, Title: "Temporada 2", EpisodeCount: 25},
		{ID: "mha_s3", AnimeID: "my-hero-academia", Number: 3, Title: "Temporada 3", EpisodeCount: 25},
		{ID: "mha_s4", AnimeID: "my-hero-academia", Number: 4, Title: "Temporada 4", EpisodeCount: 25},
	},
}

// generateEpisodes creates a list of mock episodes for a season.
func generateEpisodes(animeID string, season, count int) []models.Episode {
	eps := make([]models.Episode, count)
	for i := range eps {
		eps[i] = models.Episode{
			ID:       fmt.Sprintf("%s_s%d_e%d", animeID, season, i+1),
			AnimeID:  animeID,
			Season:   season,
			Number:   float64(i + 1),
			Title:    fmt.Sprintf("Episódio %d", i+1),
			Duration: 1440, // 24 minutes
		}
	}
	return eps
}

var mockEpisodes = func() map[string][]models.Episode {
	m := make(map[string][]models.Episode)
	for animeID, seasons := range mockSeasons {
		for _, s := range seasons {
			key := fmt.Sprintf("%s_%d", animeID, s.Number)
			m[key] = generateEpisodes(animeID, s.Number, s.EpisodeCount)
		}
	}
	return m
}()
