// Package models defines the core domain types for the AniBR application.
// These types are shared across all layers and providers.
package models

// Anime represents a single anime series with all its metadata.
type Anime struct {
	// ID is the provider-specific unique identifier for this anime.
	ID string `json:"id"`
	// Title is the original (usually Japanese romanized) title.
	Title string `json:"title"`
	// TitlePTBR is the Portuguese localized title, if available.
	TitlePTBR string `json:"title_ptbr,omitempty"`
	// CoverURL is the URL to the cover/poster image.
	CoverURL string `json:"cover_url,omitempty"`
	// Synopsis is the plot summary in Portuguese.
	Synopsis string `json:"synopsis,omitempty"`
	// Genres is a list of genre tags (e.g., "Ação", "Comédia").
	Genres []string `json:"genres,omitempty"`
	// Status indicates whether the series is ongoing or completed.
	// Expected values: "em andamento", "completo".
	Status string `json:"status,omitempty"`
	// TotalEpisodes is the total number of episodes, 0 if unknown.
	TotalEpisodes int `json:"total_episodes,omitempty"`
	// Year is the year the anime first aired.
	Year int `json:"year,omitempty"`
	// Provider is the name of the provider that returned this anime.
	Provider string `json:"provider"`
	// AvailableLanguages lists the dubbed/subbed options this provider has.
	AvailableLanguages []string `json:"available_languages,omitempty"`
}

// Language constants represent the available audio/subtitle options.
const (
	LanguageDubbed = "dublado"
	LanguageSubbed = "legendado"
)
