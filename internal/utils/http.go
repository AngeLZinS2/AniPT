// Package utils provides shared HTTP, string, and terminal utilities for AniPT.
package utils

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// HTTPClient wraps net/http.Client with common defaults for web scraping.
type HTTPClient struct {
	client *http.Client
}

// NewHTTPClient creates an HTTPClient with a 30-second timeout and a
// browser-like User-Agent to avoid being blocked by sites.
func NewHTTPClient() *HTTPClient {
	return &HTTPClient{
		client: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        10,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  false,
				TLSHandshakeTimeout: 10 * time.Second,
			},
		},
	}
}

// Get performs an HTTP GET request to the given URL with the provided context.
// It sets a realistic User-Agent and Accept-Language header for PT-BR content.
func (c *HTTPClient) Get(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("http: creating request for %q: %w", url, err)
	}

	// Mimic a real browser to reduce chance of being rate-limited.
	req.Header.Set("User-Agent",
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) "+
			"AppleWebKit/537.36 (KHTML, like Gecko) "+
			"Chrome/120.0.0.0 Safari/537.36",
	)
	req.Header.Set("Accept-Language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http: GET %q: %w", url, err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_ = resp.Body.Close()
		return nil, fmt.Errorf("http: GET %q returned status %d", url, resp.StatusCode)
	}

	return resp, nil
}
