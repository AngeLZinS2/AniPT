# Como criar um Provedor para AniPT

Este guia explica como implementar um novo provedor de streaming para o AniPT.

---

## 1. Estrutura de diretórios

Crie um novo pacote dentro de `internal/providers/`:

```
internal/providers/
└── meuprovedor/
    ├── scraper.go   # Lógica HTTP + implementação da interface
    └── parser.go    # Parsers HTML/JSON
```

---

## 2. Implementar a interface `Provider`

O novo provedor deve implementar todos os métodos da interface definida em
[`internal/providers/provider.go`](../internal/providers/provider.go):

```go
package meuprovedor

import (
    "context"
    "github.com/angeloneri/anipt/internal/models"
    "github.com/angeloneri/anipt/internal/utils"
)

const (
    baseURL     = "https://meusite.com"
    providerKey = "meuprovedor"
    displayName = "Meu Provedor"
)

type Provider struct {
    client *utils.HTTPClient
}

func New() *Provider {
    return &Provider{client: utils.NewHTTPClient()}
}

func (p *Provider) Name() string        { return providerKey }
func (p *Provider) DisplayName() string { return displayName }

func (p *Provider) Search(ctx context.Context, query string) ([]models.Anime, error) {
    // TODO: scrape search results
}

func (p *Provider) Seasons(ctx context.Context, animeID string) ([]models.Season, error) {
    // TODO: scrape season list
}

func (p *Provider) Episodes(ctx context.Context, animeID string, season int) ([]models.Episode, error) {
    // TODO: scrape episode list
}

func (p *Provider) Streams(ctx context.Context, episodeID string, language string) ([]models.StreamSource, error) {
    // TODO: extract stream URLs
}
```

---

## 3. Registrar o provedor

Em `internal/cli/root.go`, registre o novo provedor no `initContainer()`:

```go
import "github.com/angeloneri/anipt/internal/providers/meuprovedor"

// Dentro de initContainer():
registry.Register(meuprovedor.New())
```

---

## 4. Dicas para web scraping

- Use `goquery` para parsear HTML: `doc.Find(".selector").Each(...)`
- Sempre extraia o ID como um slug a partir da URL da página
- Teste os seletores CSS no browser com `document.querySelectorAll(".selector")`
- Use `utils.NewHTTPClient()` para já ter User-Agent e timeout configurados
- Trate o caso onde o site não retorna resultados (retorne slice vazio, não erro)

---

## 5. Testar o provedor

```go
func TestSearch(t *testing.T) {
    p := meuprovedor.New()
    results, err := p.Search(context.Background(), "naruto")
    if err != nil {
        t.Fatal(err)
    }
    if len(results) == 0 {
        t.Error("expected results, got none")
    }
}
```

Execute: `go test ./internal/providers/meuprovedor/...`

---

## 6. Configurar como provedor padrão

```bash
anipt config set provider meuprovedor
```

Ou no `config.yaml`:
```yaml
provider: meuprovedor
```
