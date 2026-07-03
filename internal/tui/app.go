// Package tui implements the BubbleTea-based terminal user interface for AniPT.
// The App model acts as a state machine, managing navigation between all screens.
package tui

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/angeloneri/anipt/internal/config"
	"github.com/angeloneri/anipt/internal/favorites"
	"github.com/angeloneri/anipt/internal/history"
	"github.com/angeloneri/anipt/internal/models"
	"github.com/angeloneri/anipt/internal/player"
	"github.com/angeloneri/anipt/internal/providers"
	"github.com/angeloneri/anipt/internal/tui/styles"
	"github.com/angeloneri/anipt/internal/utils"
)

// State represents the current screen the TUI is showing.
type State int

const (
	StateHome State = iota
	StateSearch
	StateResults
	StateAnimeDetail
	StateSeasonSelect
	StateEpisodeSelect
	StateLangSelect
	StateQualitySelect
	StateLoading
	StateFavorites
	StateHistory
	StateError
	StateCatalog
)

// --- Tea messages ---

type (
	searchResultsMsg  struct{ animes []models.Anime }
	seasonsMsg        struct{ seasons []models.Season }
	episodesMsg       struct{ episodes []models.Episode }
	streamsMsg        struct{ sources []models.StreamSource }
	errorMsg          struct{ err error }
	playerDoneMsg     struct{}
	favToggledMsg     struct{ isFav bool; title string }
	favoritesLoadedMsg struct{ items []list.Item }
	historyLoadedMsg  struct{ items []list.Item }
	animationTickMsg  time.Time
	animeDetailsMsg   struct {
		synopsis  string
		genres    []string
		coverURL  string
		coverANSI string
		err       error
	}
)

// tickAnimation triggers a new animation frame update.
func tickAnimation() tea.Cmd {
	return tea.Tick(time.Millisecond*250, func(t time.Time) tea.Msg {
		return animationTickMsg(t)
	})
}

// App is the root BubbleTea model. It holds all application state and
// orchestrates navigation between screens.
type App struct {
	// Dependencies
	cfg         *config.Config
	provider    providers.Provider
	registry    *providers.Registry
	playerFact  *player.Factory
	historySvc  *history.Service
	favoritesSvc *favorites.Service

	// Layout
	width  int
	height int

	// State machine
	state     State
	prevState State

	// UI components
	searchInput textinput.Model
	resultList  list.Model
	seasonList  list.Model
	episodeList list.Model
	langList    list.Model
	qualityList list.Model
	favList     list.Model
	histList    list.Model
	catalogList list.Model
	spinner     spinner.Model

	// Selected items (navigation stack)
	selectedAnime   *models.Anime
	selectedSeason  *models.Season
	selectedEpisode *models.Episode
	selectedLang    string
	selectedQuality string
	streams         []models.StreamSource

	// Messages
	loadingMsg string
	errorMsg   string
	statusMsg  string

	// Animation
	animationFrame int

	// ANSI cover image cache
	selectedAnimeCoverANSI string
}

// AppDeps contains all dependencies for the App model.
type AppDeps struct {
	Config       *config.Config
	Provider     providers.Provider
	Registry     *providers.Registry
	PlayerFact   *player.Factory
	HistorySvc   *history.Service
	FavoritesSvc *favorites.Service
}

// New creates a new App model with the given dependencies.
func New(deps AppDeps) *App {
	// Search input component.
	ti := textinput.New()
	ti.Placeholder = "Digite o nome do anime..."
	ti.PromptStyle = styles.SearchPromptStyle
	ti.TextStyle = styles.NormalItemStyle
	ti.Cursor.Style = styles.CursorStyle
	ti.CharLimit = 100
	ti.Focus()

	// Spinner component.
	sp := spinner.New()
	sp.Spinner = spinner.Dot
	sp.Style = styles.SpinnerStyle

	// Initialize empty lists — items are populated per-state.
	resultList := newList("Resultados da Pesquisa")
	seasonList := newList("Selecione a Temporada")
	episodeList := newList("Selecione o Episódio")
	langList := newList("Selecione o Idioma")
	qualityList := newList("Selecione a Qualidade")
	favList := newList("Meus Favoritos")
	histList := newList("Histórico de Visualização")
	catalogList := newList("Filtros do Catálogo")

	return &App{
		cfg:          deps.Config,
		provider:     deps.Provider,
		registry:     deps.Registry,
		playerFact:   deps.PlayerFact,
		historySvc:   deps.HistorySvc,
		favoritesSvc: deps.FavoritesSvc,

		state:       StateHome,
		searchInput: ti,
		spinner:     sp,
		resultList:  resultList,
		seasonList:  seasonList,
		episodeList: episodeList,
		langList:    langList,
		qualityList: qualityList,
		favList:     favList,
		histList:    histList,
		catalogList:  catalogList,

		selectedLang:    deps.Config.Language,
		selectedQuality: deps.Config.Quality,
	}
}

// Init is the BubbleTea initialization command.
func (a *App) Init() tea.Cmd {
	return tea.Batch(
		a.spinner.Tick,
		textinput.Blink,
		tickAnimation(),
	)
}

// --- Update ---

func (a *App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		a.resizeLists()

	case tea.KeyMsg:
		return a.handleKey(msg)

	case spinner.TickMsg:
		var cmd tea.Cmd
		a.spinner, cmd = a.spinner.Update(msg)
		return a, cmd

	case searchResultsMsg:
		a.state = StateResults
		items := animesToListItems(msg.animes)
		cmd := a.resultList.SetItems(items)
		return a, cmd

	case seasonsMsg:
		a.state = StateSeasonSelect
		items := seasonsToListItems(msg.seasons)
		cmd := a.seasonList.SetItems(items)
		return a, cmd

	case episodesMsg:
		a.state = StateEpisodeSelect
		items := episodesToListItems(msg.episodes)
		cmd := a.episodeList.SetItems(items)
		return a, cmd

	case streamsMsg:
		a.streams = msg.sources
		a.state = StateQualitySelect
		items := streamsToListItems(msg.sources)
		cmd := a.qualityList.SetItems(items)
		return a, cmd

	case playerDoneMsg:
		a.state = StateEpisodeSelect
		a.statusMsg = "✓ Episódio concluído"

	case favToggledMsg:
		if msg.isFav {
			a.statusMsg = fmt.Sprintf("★ %s adicionado aos favoritos", msg.title)
		} else {
			a.statusMsg = fmt.Sprintf("✗ %s removido dos favoritos", msg.title)
		}

	case favoritesLoadedMsg:
		a.state = StateFavorites
		cmd := a.favList.SetItems(msg.items)
		return a, cmd

	case historyLoadedMsg:
		a.state = StateHistory
		cmd := a.histList.SetItems(msg.items)
		return a, cmd

	case animeDetailsMsg:
		if msg.err != nil {
			a.statusMsg = fmt.Sprintf("⚠ Erro ao obter sinopse: %v", msg.err)
		} else if a.selectedAnime != nil {
			if msg.synopsis != "" {
				a.selectedAnime.Synopsis = msg.synopsis
			}
			if len(msg.genres) > 0 {
				a.selectedAnime.Genres = msg.genres
			}
			if msg.coverURL != "" {
				a.selectedAnime.CoverURL = msg.coverURL
			}
			a.selectedAnimeCoverANSI = msg.coverANSI
		}
		return a, nil

	case animationTickMsg:
		a.animationFrame++
		return a, tickAnimation()

	case errorMsg:
		a.errorMsg = msg.err.Error()
		a.state = StateError
	}

	return a, nil
}

// handleKey processes keyboard input based on the current state.
func (a *App) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch msg.Type {
	case tea.KeyCtrlC:
		return a, tea.Quit

	case tea.KeyEscape:
		return a.goBack()

	case tea.KeyEnter:
		return a.handleEnter()

	case tea.KeyCtrlF:
		if a.selectedAnime != nil {
			return a, a.toggleFavorite()
		}

	case tea.KeyRunes:
		// Handle single-character shortcuts that work from the home screen
		// (and any state where the text input is not active).
		// When the search input is active (StateSearch), all runes are consumed
		// by delegateKey below, so these shortcuts won't fire accidentally.
		if a.state != StateSearch {
			switch strings.ToLower(string(msg.Runes)) {
			case "t":
				// Open Catalog screen.
				a.state = StateCatalog
				catalogItems := []list.Item{
					catalogItem{label: "📅 Novos Episódios Adicionados", query: "lancamentos"},
					catalogItem{label: "⚔️ Gênero: Ação", query: "genero:acao"},
					catalogItem{label: "🗺️ Gênero: Aventura", query: "genero:aventura"},
					catalogItem{label: "🤣 Gênero: Comédia", query: "genero:comedia"},
					catalogItem{label: "🔮 Gênero: Fantasia", query: "genero:fantasia"},
					catalogItem{label: "🎭 Gênero: Drama", query: "genero:drama"},
					catalogItem{label: "👻 Gênero: Terror", query: "genero:terror"},
					catalogItem{label: "💖 Gênero: Romance", query: "genero:romance"},
					catalogItem{label: "🧠 Gênero: Sci-Fi", query: "genero:ficcao-cientifica"},
				}
				a.catalogList.SetItems(catalogItems)
				return a, nil
			case "f":
				if a.state == StateResults {
					if item, ok := a.resultList.SelectedItem().(animeItem); ok {
						a.selectedAnime = &item.anime
						return a, a.toggleFavorite()
					}
				} else if a.state == StateFavorites {
					if item, ok := a.favList.SelectedItem().(favItem); ok {
						anime := &models.Anime{
							ID:       item.fav.AnimeID,
							Title:    item.fav.AnimeTitle,
							Provider: item.fav.Provider,
							CoverURL: item.fav.CoverURL,
						}
						a.selectedAnime = anime
						return a, tea.Sequence(a.toggleFavorite(), a.doLoadFavorites())
					}
				}
				// Otherwise, open Favorites screen.
				return a, a.doLoadFavorites()
			case "h":
				// Open History screen.
				return a, a.doLoadHistory()
			case "c":
				// Open Config screen — for now open the TUI config view.
				a.statusMsg = "⚙  Use 'anipt config' no terminal para editar as configurações."
				return a, nil
			}
		}
	}

	// Delegate key to the active list or input.
	return a.delegateKey(msg)
}

// goBack navigates to the previous logical state.
func (a *App) goBack() (tea.Model, tea.Cmd) {
	switch a.state {
	case StateHome:
		return a, tea.Quit
	case StateSearch, StateResults:
		a.state = StateHome
		a.searchInput.Reset()
		a.selectedAnimeCoverANSI = ""
	case StateCatalog:
		a.state = StateHome
	case StateAnimeDetail, StateSeasonSelect:
		a.state = StateResults
		a.selectedAnimeCoverANSI = ""
	case StateEpisodeSelect:
		a.state = StateSeasonSelect
	case StateLangSelect:
		a.state = StateEpisodeSelect
	case StateQualitySelect:
		a.state = StateLangSelect
	case StateFavorites, StateHistory:
		a.state = StateHome
	case StateError:
		a.state = a.prevState
		a.errorMsg = ""
	default:
		a.state = StateHome
	}
	return a, nil
}

// handleEnter processes the Enter key based on the current state.
func (a *App) handleEnter() (tea.Model, tea.Cmd) {
	switch a.state {

	case StateHome:
		a.state = StateSearch
		a.searchInput.Focus()
		return a, textinput.Blink

	case StateCatalog:
		if item, ok := a.catalogList.SelectedItem().(catalogItem); ok {
			a.loadingMsg = fmt.Sprintf("Carregando catálogo: %s...", item.label)
			a.state = StateLoading
			return a, a.doSearch(item.query)
		}
		return a, nil

	case StateSearch:
		query := strings.TrimSpace(a.searchInput.Value())
		if query == "" {
			return a, nil
		}
		a.loadingMsg = fmt.Sprintf("Pesquisando: %q...", query)
		a.state = StateLoading
		return a, a.doSearch(query)

	case StateResults:
		if item, ok := a.resultList.SelectedItem().(animeItem); ok {
			animeCopy := item.anime
			a.selectedAnime = &animeCopy
			a.selectedAnimeCoverANSI = ""
			a.loadingMsg = fmt.Sprintf("Carregando temporadas de %s...", animeCopy.Title)
			a.state = StateLoading
			return a, tea.Batch(
				a.doLoadSeasons(animeCopy.ID),
				a.doLoadDetails(animeCopy.ID),
			)
		}

	case StateSeasonSelect:
		if item, ok := a.seasonList.SelectedItem().(seasonItem); ok {
			a.selectedSeason = &item.season
			a.loadingMsg = fmt.Sprintf("Carregando episódios — %s...", item.season.Title)
			a.state = StateLoading
			return a, a.doLoadEpisodes(item.season.AnimeID, item.season.Number)
		}

	case StateEpisodeSelect:
		if item, ok := a.episodeList.SelectedItem().(episodeItem); ok {
			a.selectedEpisode = &item.episode
			// Navigate to language selection.
			a.state = StateLangSelect
			langItems := []list.Item{
				langItem{label: "🔊 Dublado", value: models.LanguageDubbed},
				langItem{label: "📝 Legendado", value: models.LanguageSubbed},
			}
			return a, a.langList.SetItems(langItems)
		}

	case StateLangSelect:
		if item, ok := a.langList.SelectedItem().(langItem); ok {
			a.selectedLang = item.value
			a.loadingMsg = "Carregando fontes de vídeo..."
			a.state = StateLoading
			return a, a.doLoadStreams(a.selectedEpisode.ID, item.value)
		}

	case StateQualitySelect:
		if item, ok := a.qualityList.SelectedItem().(streamItem); ok {
			a.selectedQuality = item.source.Quality
			return a, a.doPlay(item.source)
		}

	case StateFavorites:
		// On Enter in favorites, load the anime for watching.
		if item, ok := a.favList.SelectedItem().(favItem); ok {
			animeCopy := models.Anime{
				ID:       item.fav.AnimeID,
				Title:    item.fav.AnimeTitle,
				Provider: item.fav.Provider,
				CoverURL: item.fav.CoverURL,
			}
			a.selectedAnime = &animeCopy
			a.selectedAnimeCoverANSI = ""
			a.loadingMsg = "Carregando temporadas..."
			a.state = StateLoading
			return a, tea.Batch(
				a.doLoadSeasons(animeCopy.ID),
				a.doLoadDetails(animeCopy.ID),
			)
		}
	}

	return a, nil
}

// delegateKey passes key events to the active component.
func (a *App) delegateKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	switch a.state {
	case StateSearch:
		a.searchInput, cmd = a.searchInput.Update(msg)
	case StateResults:
		a.resultList, cmd = a.resultList.Update(msg)
	case StateSeasonSelect:
		a.seasonList, cmd = a.seasonList.Update(msg)
	case StateEpisodeSelect:
		a.episodeList, cmd = a.episodeList.Update(msg)
	case StateLangSelect:
		a.langList, cmd = a.langList.Update(msg)
	case StateQualitySelect:
		a.qualityList, cmd = a.qualityList.Update(msg)
	case StateFavorites:
		a.favList, cmd = a.favList.Update(msg)
	case StateHistory:
		a.histList, cmd = a.histList.Update(msg)
	case StateCatalog:
		a.catalogList, cmd = a.catalogList.Update(msg)
	}
	return a, cmd
}

// --- Async commands ---

func (a *App) doSearch(query string) tea.Cmd {
	p := a.provider
	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		results, err := p.Search(ctx, query)
		if err != nil {
			return errorMsg{err}
		}
		return searchResultsMsg{results}
	}
}

func (a *App) doLoadDetails(animeID string) tea.Cmd {
	return func() tea.Msg {
		p := a.provider
		var animeTitle string
		if a.selectedAnime != nil {
			animeTitle = a.selectedAnime.Title
			if sp, err := a.registry.Get(a.selectedAnime.Provider); err == nil {
				p = sp
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()

		// 1. Fetch local details (from active scraper)
		var localSynopsis, localCover string
		var localGenres []string
		if details, err := p.Details(ctx, animeID); err == nil && details != nil {
			localSynopsis = details.Synopsis
			localCover = details.CoverURL
			localGenres = details.Genres
		}

		// 2. Fetch Kitsu metadata as fallback
		var kitsuSynopsis, kitsuCover, kitsuTitlePTBR string
		if animeTitle != "" {
			kitsuSynopsis, kitsuCover, kitsuTitlePTBR, _ = fetchKitsuMetadata(ctx, animeTitle)
			if kitsuSynopsis != "" {
				// Translate from English to Portuguese
				if translated, err := translateToPT(ctx, kitsuSynopsis); err == nil && translated != "" {
					kitsuSynopsis = translated
				}
			}
		}

		// 3. Merge details, preferring local (Portuguese) info if rich enough
		finalSynopsis := localSynopsis
		if len(finalSynopsis) < 15 && kitsuSynopsis != "" {
			finalSynopsis = kitsuSynopsis
		}

		finalCover := localCover
		if finalCover == "" || !strings.Contains(finalCover, "http") {
			if kitsuCover != "" {
				finalCover = kitsuCover
			}
		}

		// If we fetched a localized Portuguese title from Kitsu and we don't have one, populate it
		if a.selectedAnime != nil && a.selectedAnime.TitlePTBR == "" && kitsuTitlePTBR != "" {
			a.selectedAnime.TitlePTBR = kitsuTitlePTBR
		}

		return animeDetailsMsg{
			synopsis: finalSynopsis,
			genres:   localGenres,
			coverURL: finalCover,
		}
	}
}

type kitsuAPIResponse struct {
	Data []struct {
		Attributes struct {
			Synopsis       string            `json:"synopsis"`
			Titles         map[string]string `json:"titles"`
			CanonicalTitle string            `json:"canonicalTitle"`
			PosterImage    struct {
				Medium string `json:"medium"`
			} `json:"posterImage"`
		} `json:"attributes"`
	} `json:"data"`
}

func fetchKitsuMetadata(ctx context.Context, title string) (string, string, string, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	apiURL := fmt.Sprintf("https://kitsu.io/api/edge/anime?filter[text]=%s", url.QueryEscape(title))
	
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return "", "", "", err
	}
	
	resp, err := client.Do(req)
	if err != nil {
		return "", "", "", err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", err
	}
	
	var kr kitsuAPIResponse
	if err := json.Unmarshal(body, &kr); err != nil {
		return "", "", "", err
	}
	
	if len(kr.Data) > 0 {
		attr := kr.Data[0].Attributes
		titlePTBR := attr.Titles["pt_br"]
		if titlePTBR == "" {
			titlePTBR = attr.Titles["pt"]
		}
		return attr.Synopsis, attr.PosterImage.Medium, titlePTBR, nil
	}
	
	return "", "", "", fmt.Errorf("no results")
}

func translateToPT(ctx context.Context, text string) (string, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	apiURL := fmt.Sprintf("https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=%s", url.QueryEscape(text))
	
	req, err := http.NewRequestWithContext(ctx, "GET", apiURL, nil)
	if err != nil {
		return "", err
	}
	
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	
	var raw []interface{}
	if err := json.Unmarshal(body, &raw); err != nil {
		return "", err
	}
	
	if len(raw) == 0 {
		return "", fmt.Errorf("empty response")
	}
	
	first, ok := raw[0].([]interface{})
	if !ok {
		return "", fmt.Errorf("invalid format")
	}
	
	var parts []string
	for _, part := range first {
		tuple, ok := part.([]interface{})
		if ok && len(tuple) > 0 {
			if translatedSeg, ok := tuple[0].(string); ok {
				parts = append(parts, translatedSeg)
			}
		}
	}
	
	if len(parts) == 0 {
		return "", fmt.Errorf("no translation found")
	}
	
	return strings.Join(parts, ""), nil
}

func (a *App) doLoadSeasons(animeID string) tea.Cmd {
	return func() tea.Msg {
		p := a.provider
		if a.selectedAnime != nil && a.selectedAnime.Provider != "" {
			if sp, err := a.registry.Get(a.selectedAnime.Provider); err == nil {
				p = sp
			}
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		seasons, err := p.Seasons(ctx, animeID)
		if err != nil {
			return errorMsg{err}
		}
		return seasonsMsg{seasons}
	}
}

func (a *App) doLoadEpisodes(animeID string, season int) tea.Cmd {
	return func() tea.Msg {
		p := a.provider
		if a.selectedAnime != nil && a.selectedAnime.Provider != "" {
			if sp, err := a.registry.Get(a.selectedAnime.Provider); err == nil {
				p = sp
			}
		}
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		episodes, err := p.Episodes(ctx, animeID, season)
		if err != nil {
			return errorMsg{err}
		}
		return episodesMsg{episodes}
	}
}

func (a *App) doLoadStreams(episodeID, lang string) tea.Cmd {
	return func() tea.Msg {
		p := a.provider
		if a.selectedAnime != nil && a.selectedAnime.Provider != "" {
			if sp, err := a.registry.Get(a.selectedAnime.Provider); err == nil {
				p = sp
			}
		}
		ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
		defer cancel()
		sources, err := p.Streams(ctx, episodeID, lang)
		if err != nil {
			return errorMsg{err}
		}

		return streamsMsg{sources}
	}
}

func (a *App) doPlay(src models.StreamSource) tea.Cmd {
	ep := a.selectedEpisode
	anime := a.selectedAnime
	cfg := a.cfg
	playerFact := a.playerFact
	histSvc := a.historySvc

	return func() tea.Msg {
		title := ""
		if anime != nil {
			title = anime.Title
		}
		season := 1
		epNum := 1.0
		epTitle := ""
		if ep != nil {
			season = ep.Season
			epNum = ep.Number
			epTitle = ep.Title
		}

		// Record in history before playing.
		if histSvc != nil && anime != nil {
			_ = histSvc.Record(&models.HistoryEntry{
				AnimeID:      anime.ID,
				AnimeTitle:   anime.Title,
				Provider:     anime.Provider,
				Season:       season,
				Episode:      epNum,
				EpisodeTitle: epTitle,
				Language:     src.Language,
				Quality:      src.Quality,
			})
		}

		// Check if it's an embed URL or Blogger URL which cannot be played directly by VLC/MPV.
		isEmbed := src.Format == "embed" ||
			strings.Contains(src.URL, "blogger.com") ||
			strings.Contains(src.URL, "video.g") ||
			strings.Contains(src.URL, "/embed/")

		playURL := src.URL

		if isEmbed {
			// Try to resolve the direct video link with yt-dlp
			resolvedURL, ytdlErr := utils.ResolveWithYTDLP(context.Background(), src.URL)
			if ytdlErr == nil && resolvedURL != "" {
				playURL = resolvedURL
				isEmbed = false // We extracted a direct stream successfully!
			} else {
				// Fallback to default browser since yt-dlp is not available or failed
				_ = utils.OpenBrowser(src.URL)
				return playerDoneMsg{}
			}
		}

		p, err := playerFact.Get(cfg.Player)
		if err != nil {
			return errorMsg{err}
		}

		// Determine the HTTP Referer depending on the provider/URL to bypass CDN protection.
		referer := "https://animefire.io/"
		if strings.Contains(playURL, "goyabu") || strings.Contains(src.Quality, "Goyabu") {
			referer = "https://goyabu.io/"
		} else if strings.Contains(playURL, "animesbr") || strings.Contains(src.Quality, "AnimesBR") {
			referer = "https://animesbr.lat/"
		}

		userAgent := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

		opts := player.StreamOptions{
			URL:        playURL,
			AnimeTitle: title,
			Season:     season,
			Episode:    epNum,
			Language:   src.Language,
			Quality:    src.Quality,
			Fullscreen: cfg.Fullscreen,
			UserAgent:  userAgent,
			Referer:    referer,
		}

		_ = p.Play(opts)
		return playerDoneMsg{}
	}
}

func (a *App) toggleFavorite() tea.Cmd {
	favSvc := a.favoritesSvc
	anime := a.selectedAnime
	return func() tea.Msg {
		if favSvc == nil || anime == nil {
			return nil
		}
		isFav, err := favSvc.Toggle(anime)
		if err != nil {
			return errorMsg{err}
		}
		return favToggledMsg{isFav: isFav, title: anime.Title}
	}
}

// doLoadFavorites fetches the favorites list and transitions to StateFavorites.
func (a *App) doLoadFavorites() tea.Cmd {
	favSvc := a.favoritesSvc
	return func() tea.Msg {
		if favSvc == nil {
			return errorMsg{fmt.Errorf("serviço de favoritos não disponível")}
		}
		favs, err := favSvc.List()
		if err != nil {
			return errorMsg{err}
		}
		items := make([]list.Item, len(favs))
		for i, f := range favs {
			items[i] = favItem{fav: f}
		}
		return favoritesLoadedMsg{items: items}
	}
}

// doLoadHistory fetches the watch history and transitions to StateHistory.
func (a *App) doLoadHistory() tea.Cmd {
	histSvc := a.historySvc
	return func() tea.Msg {
		if histSvc == nil {
			return errorMsg{fmt.Errorf("serviço de histórico não disponível")}
		}
		entries, err := histSvc.List(200)
		if err != nil {
			return errorMsg{err}
		}
		items := make([]list.Item, len(entries))
		for i, e := range entries {
			items[i] = histEntryItem{entry: e}
		}
		return historyLoadedMsg{items: items}
	}
}

// --- View ---

func (a *App) View() string {
	if a.width == 0 {
		return ""
	}

	switch a.state {
	case StateHome:
		return a.viewHome()
	case StateSearch:
		return a.viewSearch()
	case StateLoading:
		return a.viewLoading()
	case StateResults:
		return a.viewList(&a.resultList, "Resultados")
	case StateSeasonSelect:
		return a.viewList(&a.seasonList, "Temporadas")
	case StateEpisodeSelect:
		return a.viewList(&a.episodeList, "Episódios")
	case StateLangSelect:
		return a.viewList(&a.langList, "Idioma")
	case StateQualitySelect:
		return a.viewList(&a.qualityList, "Qualidade")
	case StateFavorites:
		return a.viewList(&a.favList, "Favoritos")
	case StateHistory:
		return a.viewList(&a.histList, "Histórico")
	case StateCatalog:
		return a.viewList(&a.catalogList, "Catálogo")
	case StateError:
		return a.viewError()
	default:
		return a.viewHome()
	}
}

// viewHome renders the home screen with banner and main menu.
func (a *App) viewHome() string {
	// Simple color-pulsing animation for the ANIPT banner
	colors := []string{"#4A90D9", "#6DB3F2", "#4A90D9", "#2A5FA5"}
	colorIndex := a.animationFrame % len(colors)
	animatedBanner := lipgloss.NewStyle().
		Foreground(lipgloss.Color(colors[colorIndex])).
		Bold(true).
		Render(homeBanner)

	subtitle := styles.SubtitleStyle.Render("Anime CLI Brasileiro")

	divider := styles.DividerStyle.Render(strings.Repeat("─", min(a.width-4, 40)))

	menu := lipgloss.JoinVertical(lipgloss.Left,
		styles.NormalItemStyle.Render("🔍  Pesquisar anime        [Enter]"),
		styles.NormalItemStyle.Render("📅  Catálogo e Filtros     [T]"),
		styles.NormalItemStyle.Render("★  Favoritos              [F]"),
		styles.NormalItemStyle.Render("📋  Histórico              [H]"),
		styles.NormalItemStyle.Render("⚙   Configurações          [C]"),
		styles.DimItemStyle.Render("✗  Sair                   [Ctrl+C]"),
	)

	providerInfo := styles.DimItemStyle.Render(
		fmt.Sprintf("Provedor: %s", a.provider.DisplayName()),
	)

	footer := a.renderFooter("Enter: pesquisar  T: catálogo  F: favoritos  H: histórico  Ctrl+C: sair")

	content := lipgloss.JoinVertical(lipgloss.Left,
		"",
		animatedBanner,
		subtitle,
		"",
		divider,
		"",
		menu,
		"",
		providerInfo,
	)

	if a.statusMsg != "" {
		content = lipgloss.JoinVertical(lipgloss.Left, content, "",
			styles.SuccessStyle.Render(a.statusMsg))
	}

	return lipgloss.JoinVertical(lipgloss.Left,
		styles.AppStyle.Width(a.width).Render(
			lipgloss.NewStyle().Padding(1, 2).Render(content),
		),
		footer,
	)
}

// viewSearch renders the search input screen.
func (a *App) viewSearch() string {
	title := styles.TitleStyle.Render("🔍 Pesquisar Anime")

	inputBox := styles.PanelStyle.Width(a.width - 6).Render(
		lipgloss.JoinVertical(lipgloss.Left,
			styles.DimItemStyle.Render("Digite o nome do anime:"),
			a.searchInput.View(),
		),
	)

	hint := styles.DimItemStyle.Render("Enter: pesquisar  Esc: voltar")

	content := lipgloss.JoinVertical(lipgloss.Left, "", title, "", inputBox, "", hint)

	return lipgloss.NewStyle().Padding(1, 2).Width(a.width).Render(content)
}

// viewLoading renders the loading screen with a spinner.
func (a *App) viewLoading() string {
	spinner := a.spinner.View()
	msg := styles.LoadingTextStyle.Render(a.loadingMsg)
	content := lipgloss.JoinHorizontal(lipgloss.Center, spinner, " ", msg)

	return lipgloss.NewStyle().
		Width(a.width).
		Height(a.height).
		Align(lipgloss.Center, lipgloss.Center).
		Render(content)
}

// viewList renders a generic list screen, supporting split screen for details if layout permits.
func (a *App) viewList(l *list.Model, title string) string {
	header := a.renderHeader(title)
	footer := a.renderContextFooter()

	leftWidth := a.width
	// Split screen logic for seasons and episodes
	if (a.state == StateEpisodeSelect || a.state == StateSeasonSelect) && a.width > 75 && a.selectedAnime != nil {
		leftWidth = (a.width * 40) / 100
		rightWidth := a.width - leftWidth - 2

		// Set width for list view
		l.SetWidth(leftWidth)
		listView := l.View()

		detailsView := a.renderDetailsPanel(rightWidth)

		body := lipgloss.JoinHorizontal(lipgloss.Top,
			listView,
			detailsView,
		)

		return lipgloss.JoinVertical(lipgloss.Left,
			header,
			body,
			footer,
		)
	}

	l.SetWidth(leftWidth)
	listView := l.View()

	return lipgloss.JoinVertical(lipgloss.Left,
		header,
		listView,
		footer,
	)
}

// viewError renders the error screen.
func (a *App) viewError() string {
	title := styles.ErrorStyle.Render("⚠ Erro")
	msg := styles.NormalItemStyle.Render(a.errorMsg)
	hint := styles.DimItemStyle.Render("Esc: voltar  Ctrl+C: sair")

	content := lipgloss.JoinVertical(lipgloss.Left, "", title, "", msg, "", hint)

	return lipgloss.NewStyle().
		Width(a.width).
		Height(a.height).
		Align(lipgloss.Center, lipgloss.Center).
		Render(styles.PanelStyle.Render(content))
}

// renderHeader renders a consistent top header bar.
func (a *App) renderHeader(title string) string {
	left := styles.BannerStyle.Render("AniPT")
	right := styles.TitleStyle.Render(title)
	spacer := strings.Repeat(" ", max(0, a.width-lipgloss.Width(left)-lipgloss.Width(right)-4))
	return styles.HeaderBarStyle.Width(a.width).Render(left + spacer + right)
}

// renderFooter renders a footer with static help text.
func (a *App) renderFooter(help string) string {
	return styles.FooterStyle.Width(a.width).Render(
		styles.HelpStyle.Render(help),
	)
}

// renderContextFooter renders a context-aware footer based on the current state.
func (a *App) renderContextFooter() string {
	var help string
	switch a.state {
	case StateResults:
		help = "↑↓: navegar  Enter: selecionar  F: favoritar  Esc: voltar"
	case StateSeasonSelect, StateEpisodeSelect:
		help = "↑↓: navegar  Enter: selecionar  Esc: voltar"
	default:
		help = "↑↓: navegar  Enter: selecionar  Esc: voltar  Ctrl+C: sair"
	}
	return a.renderFooter(help)
}

// --- Helpers ---

// resizeLists updates all list dimensions to fit the current terminal size.
func (a *App) resizeLists() {
	h := max(0, a.height-4) // Leave room for header + footer
	w := a.width

	for _, l := range []*list.Model{
		&a.resultList, &a.seasonList, &a.episodeList,
		&a.langList, &a.qualityList, &a.favList, &a.histList,
		&a.catalogList,
	} {
		l.SetSize(w, h)
	}
}

// newList creates a styled list component with the given title.
func newList(title string) list.Model {
	delegate := list.NewDefaultDelegate()
	delegate.Styles.SelectedTitle = styles.SelectedItemStyle
	delegate.Styles.SelectedDesc = styles.DimItemStyle
	delegate.Styles.NormalTitle = styles.NormalItemStyle
	delegate.Styles.NormalDesc = styles.DimItemStyle

	l := list.New(nil, delegate, 0, 0)
	l.Title = title
	l.Styles.Title = styles.TitleStyle
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(true)
	l.Styles.FilterPrompt = styles.SearchPromptStyle
	l.Styles.FilterCursor = styles.CursorStyle

	return l
}

// --- List item types ---

type animeItem struct{ anime models.Anime }

func (i animeItem) Title() string {
	title := i.anime.Title
	if i.anime.TitlePTBR != "" && i.anime.TitlePTBR != i.anime.Title {
		title = i.anime.TitlePTBR
	}
	return title
}
func (i animeItem) Description() string {
	genres := strings.Join(i.anime.Genres, ", ")
	provLabel := strings.ToUpper(i.anime.Provider)
	if genres == "" {
		return fmt.Sprintf("%s • %s", i.anime.Status, provLabel)
	}
	return fmt.Sprintf("%s • %s • %s", i.anime.Status, genres, provLabel)
}
func (i animeItem) FilterValue() string { return i.anime.Title + " " + i.anime.TitlePTBR }

type seasonItem struct{ season models.Season }

func (i seasonItem) Title() string       { return i.season.Title }
func (i seasonItem) Description() string { return fmt.Sprintf("%d episódios", i.season.EpisodeCount) }
func (i seasonItem) FilterValue() string { return i.season.Title }

type episodeItem struct{ episode models.Episode }

func (i episodeItem) Title() string {
	return fmt.Sprintf("Episódio %.0f — %s", i.episode.Number, i.episode.Title)
}
func (i episodeItem) Description() string {
	if i.episode.Duration > 0 {
		m := i.episode.Duration / 60
		return fmt.Sprintf("%d min", m)
	}
	return ""
}
func (i episodeItem) FilterValue() string { return i.episode.Title }

type langItem struct{ label, value string }

func (i langItem) Title() string       { return i.label }
func (i langItem) Description() string { return "" }
func (i langItem) FilterValue() string { return i.label }

type streamItem struct{ source models.StreamSource }

func (i streamItem) Title() string {
	return fmt.Sprintf("%s — %s", i.source.Quality, strings.ToUpper(i.source.Format))
}
func (i streamItem) Description() string { return i.source.URL }
func (i streamItem) FilterValue() string { return i.source.Quality }

type favItem struct{ fav models.Favorite }

func (i favItem) Title() string       { return i.fav.AnimeTitle }
func (i favItem) Description() string { return fmt.Sprintf("%s • %s", i.fav.Provider, i.fav.AddedAt.Format("02/01/2006")) }
func (i favItem) FilterValue() string { return i.fav.AnimeTitle }

type histEntryItem struct{ entry models.HistoryEntry }

func (i histEntryItem) Title() string {
	return fmt.Sprintf("%s — S%02dE%05.1f", i.entry.AnimeTitle, i.entry.Season, i.entry.Episode)
}
func (i histEntryItem) Description() string {
	return fmt.Sprintf("%s • %s • %s", i.entry.Language, i.entry.Quality, i.entry.WatchedAt.Format("02/01/2006 15:04"))
}
func (i histEntryItem) FilterValue() string { return i.entry.AnimeTitle }

// --- Conversion helpers ---

func animesToListItems(animes []models.Anime) []list.Item {
	items := make([]list.Item, len(animes))
	for i, a := range animes {
		items[i] = animeItem{anime: a}
	}
	return items
}

func seasonsToListItems(seasons []models.Season) []list.Item {
	items := make([]list.Item, len(seasons))
	for i, s := range seasons {
		items[i] = seasonItem{season: s}
	}
	return items
}

func episodesToListItems(episodes []models.Episode) []list.Item {
	items := make([]list.Item, len(episodes))
	for i, e := range episodes {
		items[i] = episodeItem{episode: e}
	}
	return items
}

func streamsToListItems(sources []models.StreamSource) []list.Item {
	items := make([]list.Item, len(sources))
	for i, s := range sources {
		items[i] = streamItem{source: s}
	}
	return items
}

// homeBanner is the ASCII art logo displayed on the home screen.
const homeBanner = `
  ██████╗ ███╗   ██╗██╗██████╗ ████████╗
  ██╔══██╗████╗  ██║██║██╔══██╗╚══██╔══╝
  ███████║██╔██╗ ██║██║██████╔╝   ██║
  ██╔══██║██║╚██╗██║██║██╔═══╝    ██║
  ██║  ██║██║ ╚████║██║██║        ██║
  ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝        ╚═╝`

// min returns the smaller of two integers.
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// max returns the larger of two integers.
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

type catalogItem struct {
	label string
	query string
}

func (i catalogItem) Title() string       { return i.label }
func (i catalogItem) Description() string { return "" }
func (i catalogItem) FilterValue() string { return i.label }

// renderDetailsPanel renders a styled metadata card/panel for the active anime.
func (a *App) renderDetailsPanel(width int) string {
	if a.selectedAnime == nil {
		return ""
	}

	anime := a.selectedAnime

	// Title
	titleStyle := lipgloss.NewStyle().
		Foreground(styles.ColorPrimaryLight).
		Bold(true)
	title := titleStyle.Render(anime.Title)

	// Localized title
	subTitle := ""
	if anime.TitlePTBR != "" && anime.TitlePTBR != anime.Title {
		subTitle = lipgloss.NewStyle().
			Foreground(styles.ColorTextMuted).
			Italic(true).
			Render(anime.TitlePTBR) + "\n"
	}

	// Metadata: Provider + Year + Status
	metaParts := []string{strings.ToUpper(anime.Provider)}
	if anime.Year > 0 {
		metaParts = append(metaParts, fmt.Sprintf("%d", anime.Year))
	}
	if anime.Status != "" {
		metaParts = append(metaParts, strings.Title(anime.Status))
	}
	meta := lipgloss.NewStyle().
		Foreground(styles.ColorTextDim).
		Render(strings.Join(metaParts, " • "))

	// Genres
	genresStr := ""
	if len(anime.Genres) > 0 {
		genresStr = "\n" + lipgloss.NewStyle().
			Foreground(styles.ColorWarning).
			Render("Gêneros: "+strings.Join(anime.Genres, ", "))
	}

	// Synopsis
	synopsis := "Nenhuma sinopse disponível."
	if anime.Synopsis != "" {
		synopsis = anime.Synopsis
	}

	// Wrap text to fit panel width
	wrappedSynopsis := wrapText(synopsis, width-6)
	synopsisStyle := lipgloss.NewStyle().
		Foreground(styles.ColorText).
		PaddingTop(1)
	synContent := synopsisStyle.Render(wrappedSynopsis)

	// Combine inside a rounded panel box
	panelStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(styles.ColorBorder).
		Padding(1, 2).
		Width(width).
		Height(max(0, a.height-7))

	content := lipgloss.JoinVertical(lipgloss.Left,
		title,
		subTitle,
		meta,
		genresStr,
		"",
		lipgloss.NewStyle().Foreground(styles.ColorPrimary).Bold(true).Render("Sinopse:"),
		synContent,
	)

	return panelStyle.Render(content)
}

// wrapText breaks a string into multiple lines so that no line exceeds limit characters.
func wrapText(text string, limit int) string {
	if limit <= 0 {
		return text
	}
	words := strings.Fields(text)
	if len(words) == 0 {
		return ""
	}
	var sb strings.Builder
	sb.WriteString(words[0])
	spaceLeft := limit - len(words[0])
	for _, word := range words[1:] {
		if len(word)+1 > spaceLeft {
			sb.WriteByte('\n')
			sb.WriteString(word)
			spaceLeft = limit - len(word)
		} else {
			sb.WriteByte(' ')
			sb.WriteString(word)
			spaceLeft -= 1 + len(word)
		}
	}
	return sb.String()
}
