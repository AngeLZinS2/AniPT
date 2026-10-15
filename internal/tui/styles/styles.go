// Package styles defines the AniBR design system using Lipgloss.
// All colors, borders, and text styles are centralized here.
// Components should reference these styles rather than defining their own.
package styles

import "github.com/charmbracelet/lipgloss"

// Color palette — AniBR uses a blue/white/dark-gray theme.
const (
	ColorBackground   = lipgloss.Color("#0E1117") // Very dark background
	ColorSurface      = lipgloss.Color("#1A2235") // Card / panel background
	ColorSurfaceAlt   = lipgloss.Color("#232D42") // Alternate surface
	ColorBorder       = lipgloss.Color("#2E4066") // Border lines
	ColorPrimary      = lipgloss.Color("#4A90D9") // Main blue accent
	ColorPrimaryLight = lipgloss.Color("#6DB3F2") // Lighter blue
	ColorPrimaryDim   = lipgloss.Color("#2A5FA5") // Darker blue
	ColorText         = lipgloss.Color("#E8F0FE") // Main text (near-white)
	ColorTextMuted    = lipgloss.Color("#7A90B5") // Muted text
	ColorTextDim      = lipgloss.Color("#4A5568") // Very dim text
	ColorSuccess      = lipgloss.Color("#48BB78") // Green for success
	ColorWarning      = lipgloss.Color("#F6AD55") // Orange for warning
	ColorDanger       = lipgloss.Color("#FC5252") // Red for errors
	ColorHighlight    = lipgloss.Color("#1E3A5F") // Selection highlight bg
	ColorGold         = lipgloss.Color("#FFD700") // Gold for favorites star
)

// --- Layout & Container styles ---

// AppStyle is the outermost container for the whole TUI application.
var AppStyle = lipgloss.NewStyle().
	Background(ColorBackground).
	Padding(0, 1)

// PanelStyle is a content panel/card with a subtle border.
var PanelStyle = lipgloss.NewStyle().
	Background(ColorSurface).
	Border(lipgloss.RoundedBorder()).
	BorderForeground(ColorBorder).
	Padding(0, 1)

// --- Title & Header styles ---

// BannerStyle renders the large AniBR logo text.
var BannerStyle = lipgloss.NewStyle().
	Foreground(ColorPrimary).
	Bold(true)

// TitleStyle is used for page/section headings.
var TitleStyle = lipgloss.NewStyle().
	Foreground(ColorPrimaryLight).
	Bold(true).
	Padding(0, 1)

// SubtitleStyle is used for secondary labels beneath titles.
var SubtitleStyle = lipgloss.NewStyle().
	Foreground(ColorTextMuted).
	Italic(true)

// HeaderBarStyle renders the top application header.
var HeaderBarStyle = lipgloss.NewStyle().
	Background(ColorSurface).
	Foreground(ColorText).
	Padding(0, 2).
	Bold(true)

// --- List item styles ---

// SelectedItemStyle highlights the currently focused list item.
var SelectedItemStyle = lipgloss.NewStyle().
	Background(ColorHighlight).
	Foreground(ColorPrimaryLight).
	Bold(true).
	Padding(0, 1)

// NormalItemStyle is the default list item style.
var NormalItemStyle = lipgloss.NewStyle().
	Foreground(ColorText).
	Padding(0, 1)

// DimItemStyle is for less important or disabled list items.
var DimItemStyle = lipgloss.NewStyle().
	Foreground(ColorTextDim).
	Padding(0, 1)

// CursorStyle renders the selection indicator "▶" in the list.
var CursorStyle = lipgloss.NewStyle().
	Foreground(ColorPrimary).
	Bold(true)

// --- Badge styles ---

// DubbedBadgeStyle styles the "DUB" language badge.
var DubbedBadgeStyle = lipgloss.NewStyle().
	Background(ColorPrimary).
	Foreground(ColorText).
	Padding(0, 1).
	Bold(true)

// SubbedBadgeStyle styles the "LEG" language badge.
var SubbedBadgeStyle = lipgloss.NewStyle().
	Background(ColorPrimaryDim).
	Foreground(ColorText).
	Padding(0, 1).
	Bold(true)

// QualityBadgeStyle styles the quality label (e.g., "720p").
var QualityBadgeStyle = lipgloss.NewStyle().
	Background(ColorSurfaceAlt).
	Foreground(ColorPrimaryLight).
	Padding(0, 1)

// StatusOngoingStyle renders the "Em Andamento" status badge.
var StatusOngoingStyle = lipgloss.NewStyle().
	Foreground(ColorSuccess).
	Bold(true)

// StatusCompletedStyle renders the "Completo" status badge.
var StatusCompletedStyle = lipgloss.NewStyle().
	Foreground(ColorTextMuted)

// FavoriteBadgeStyle renders the gold star for favorited animes.
var FavoriteBadgeStyle = lipgloss.NewStyle().
	Foreground(ColorGold)

// --- Input & Search styles ---

// SearchPromptStyle styles the ">" search cursor.
var SearchPromptStyle = lipgloss.NewStyle().
	Foreground(ColorPrimary).
	Bold(true)

// SearchInputStyle styles the search text input field.
var SearchInputStyle = lipgloss.NewStyle().
	Foreground(ColorText).
	Background(ColorSurfaceAlt).
	Padding(0, 1)

// --- Footer & Help styles ---

// FooterStyle renders the bottom help/keybinding bar.
var FooterStyle = lipgloss.NewStyle().
	Background(ColorSurface).
	Foreground(ColorTextMuted).
	Padding(0, 2)

// KeyStyle renders a keyboard shortcut key (e.g., "↑↓").
var KeyStyle = lipgloss.NewStyle().
	Foreground(ColorPrimaryLight).
	Bold(true)

// HelpStyle renders the description next to a keybinding.
var HelpStyle = lipgloss.NewStyle().
	Foreground(ColorTextDim)

// --- Spinner & Loading ---

// SpinnerStyle styles the loading spinner character.
var SpinnerStyle = lipgloss.NewStyle().
	Foreground(ColorPrimary).
	Bold(true)

// LoadingTextStyle renders the "Carregando..." text.
var LoadingTextStyle = lipgloss.NewStyle().
	Foreground(ColorTextMuted).
	Italic(true)

// --- Dividers & Borders ---

// DividerStyle renders horizontal rule separators.
var DividerStyle = lipgloss.NewStyle().
	Foreground(ColorBorder)

// ErrorStyle renders error messages.
var ErrorStyle = lipgloss.NewStyle().
	Foreground(ColorDanger).
	Bold(true)

// SuccessStyle renders success messages.
var SuccessStyle = lipgloss.NewStyle().
	Foreground(ColorSuccess).
	Bold(true)
