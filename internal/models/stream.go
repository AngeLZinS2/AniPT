package models

// StreamSource represents a single streaming source URL with its metadata.
type StreamSource struct {
	// URL is the direct streaming URL (HLS m3u8 or MP4).
	URL string `json:"url"`
	// Quality is the video quality label, e.g., "1080p", "720p", "480p", "360p".
	Quality string `json:"quality"`
	// Language is the audio/subtitle language: "dublado" or "legendado".
	Language string `json:"language"`
	// Format is the stream container format: "m3u8", "mp4", "mkv".
	Format string `json:"format"`
	// IsHLS indicates whether the stream is an HLS (m3u8) adaptive stream.
	IsHLS bool `json:"is_hls"`
}

// Quality constants define the available video quality levels.
const (
	QualityBest  = "best"
	Quality1080p = "1080p"
	Quality720p  = "720p"
	Quality480p  = "480p"
	Quality360p  = "360p"
)

// QualityOrder defines the preference order from best to worst quality.
var QualityOrder = []string{Quality1080p, Quality720p, Quality480p, Quality360p}
