# AniPT — Anime CLI Brasileiro

<div align="center">

```
  █████╗ ███╗   ██╗██╗██████╗ ████████╗
 ██╔══██╗████╗  ██║██║██╔══██╗╚══██╔══╝
 ███████║██╔██╗ ██║██║██████╔╝   ██║   
 ██╔══██║██║╚██╗██║██║██╔═══╝    ██║   
 ██║  ██║██║ ╚████║██║██║        ██║   
 ╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝        ╚═╝   
      Anime CLI Brasileiro (PT-BR)
```

![Go Version](https://img.shields.io/badge/Go-1.24+-00ADD8?logo=go)
![License](https://img.shields.io/badge/Licença-MIT-blue)
![Platform](https://img.shields.io/badge/Plataforma-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey)

**Assista animes em português diretamente no seu terminal.**

</div>

---

## 📖 Sobre

AniPT é um cliente de terminal para assistir animes em **português do Brasil** (dublado e legendado), inspirado no [`ani-cli`](https://github.com/pystardust/ani-cli), porém completamente reescrito em **Go moderno** com uma interface TUI rica e bonita.

### Funcionalidades

| Recurso | Status |
|---------|--------|
| 🔍 Pesquisa de animes | ✅ |
| ⭐ Favoritos interativos | ✅ |
| 📋 Histórico de visualização | ✅ |
| ▶️ Continuar assistindo | ✅ |
| 🕐 Pesquisas recentes | ✅ |
| 💾 Cache SQLite | ✅ |
| 🎯 Seleção de qualidade | ✅ |
| 🔊 Seleção de idioma (DUB/LEG) | ✅ |
| 📖 Painel de Informações Lateral | ✅ (Com sinopse traduzida e metadados) |
| 📅 Catálogo e Filtros de Gênero | ✅ (Lançamentos, Ação, Aventura, etc.) |
| 📺 Modo fullscreen | ✅ |
| ⚙️ Configuração persistente | ✅ |
| 🌐 Múltiplos provedores | ✅ |

---

## 🚀 Instalação

### Pré-requisitos

- **mpv** (recomendado) ou **VLC** instalado
  - Linux: `sudo apt install mpv` ou `sudo pacman -S mpv`
  - macOS: `brew install mpv`
  - Windows: Baixe em [mpv.io](https://mpv.io/installation/)
- **Go 1.24+** (apenas para compilar do código-fonte)

### Binários pré-compilados

Baixe o binário para seu sistema na [página de releases](https://github.com/angeloneri/anipt/releases).

```bash
# Linux (amd64)
curl -L https://github.com/angeloneri/anipt/releases/latest/download/anipt-linux-amd64 -o anipt
chmod +x anipt
sudo mv anipt /usr/local/bin/

# macOS (Apple Silicon)
curl -L https://github.com/angeloneri/anipt/releases/latest/download/anipt-darwin-arm64 -o anipt
chmod +x anipt
sudo mv anipt /usr/local/bin/
```

---

## 🔨 Compilação

```bash
# Clone o repositório
git clone https://github.com/angeloneri/anipt.git
cd anipt

# Instalar dependências
go mod download

# Compilar (binário em ./bin/anipt.exe ou ./bin/anipt)
make build

# Compilar para todas as plataformas
make cross-compile

# Instalar globalmente
make install
```

---

## 🎮 Uso

### Interface interativa (TUI)

```bash
anipt
```

### Pesquisa direta via CLI

```bash
anipt search "dragon ball"
anipt search naruto
```

### Gerenciar histórico

```bash
anipt history           # Listar histórico
anipt history clear     # Limpar histórico
```

### Gerenciar favoritos

```bash
anipt favorites          # Listar favoritos
anipt favorites remove "Naruto"  # Remover favorito
```

### Configurações

```bash
anipt config                        # Ver configurações
anipt config set player vlc         # Usar VLC como player
anipt config set quality 720p       # Qualidade padrão
anipt config set language legendado # Idioma padrão
anipt config set provider animefire # Provedor (animefire | goyabu | multi)
```

---

## ⌨️ Atalhos de teclado

| Tecla | Ação (Na Home) | Ação (Nas Listas / Resultados) |
|-------|----------------|-------------------------------|
| `↑` `↓` | - | Navegar na lista |
| `Enter` | Ir para pesquisa | Selecionar / Confirmar item |
| `Esc` | Sair | Voltar para a tela anterior |
| `T` | Abrir Catálogo e Gêneros | - |
| `F` | Abrir Meus Favoritos | Toggle favorito (adiciona/remove na hora) |
| `H` | Abrir Histórico | - |
| `C` | Ver atalho de configurações | - |
| `/` | - | Filtrar lista (busca rápida) |
| `Ctrl+C`| Sair | Sair do aplicativo |

---

## ⚙️ Configuração

O arquivo de configuração fica em:
- **Linux/macOS**: `~/.config/anipt/config.yaml`
- **Windows**: `%APPDATA%\anipt\config.yaml`

```yaml
# Exemplo de config.yaml
player: mpv           # mpv | vlc
quality: best         # best | 1080p | 720p | 480p | 360p
language: dublado     # dublado | legendado
provider: multi       # mock | animefire | goyabu | multi
fullscreen: true
cache: true
cache_ttl: 3600
history: true
auto_next: true
```

---

## 🌐 Provedores

| Nome | Identificador | URL | Status |
|------|--------------|-----|--------|
| Multi-Provedor | `multi` | busca agregada | ✅ Ativo (Agrega todos) |
| AnimeFire | `animefire` | [animefire.io](https://animefire.io/) | ✅ Ativo e Estável |
| Goyabu | `goyabu` | [goyabu.io](https://goyabu.io/) | ✅ Ativo e Estável |
| Mock (Demo) | `mock` | local | ✅ Apenas testes |

Para criar um novo provedor, consulte [docs/PROVIDERS.md](docs/PROVIDERS.md).

---

## 🏗️ Estrutura do Projeto

```
anipt/
├── cmd/anipt/          # Ponto de entrada
├── internal/
│   ├── cli/            # Subcomandos Cobra (search, config, history, favorites)
│   ├── config/         # Configuração (Viper)
│   ├── database/       # SQLite + migrations
│   │   └── repositories/  # Repository pattern (cache, favorites, history)
│   ├── favorites/      # Serviço de favoritos
│   ├── history/        # Serviço de histórico
│   ├── models/         # Tipos de domínio (anime, season, episode, stream)
│   ├── player/         # mpv, VLC
│   ├── providers/      # Interface + provedores
│   │   ├── animefire/  # Scraper AnimeFire
│   │   ├── goyabu/     # Scraper Goyabu
│   │   ├── mock/       # Provedor de testes (Mock)
│   │   └── multi/      # Agregador multi-provider
│   ├── tui/            # Interface BubbleTea
│   │   └── styles/     # Design system Lipgloss
│   └── utils/          # HTTP, strings, terminal
├── assets/             # Banner ASCII
├── config/             # Config de exemplo
└── docs/               # Documentação extra
```

---

## 🤝 Contribuindo

1. Fork o repositório
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'feat: nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

Para adicionar um novo provedor, veja [docs/PROVIDERS.md](docs/PROVIDERS.md).

---

## 📜 Licença

MIT License — veja [LICENSE](LICENSE) para detalhes.

---

<div align="center">
Feito com ❤️ para a comunidade anime brasileira
</div>
