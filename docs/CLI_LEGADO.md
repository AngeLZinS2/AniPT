# CLI Go — documentação histórica

Estes comandos e exemplos se referem à versão de terminal anterior. Caminhos de código citados partem da raiz do repositório. Para o desktop atual, consulte o README da raiz.

## Versão CLI original

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

### 🪟 Windows — Guia Passo a Passo (Sem precisar instalar nada extra!)

> **Objetivo**: apertar duplo clique e o AniPT abre direto no terminal. Sem código, sem configuração manual.

#### Passo 1 — Baixe o mpv (player de vídeo)

O mpv é o programa que reproduz o vídeo dos animes. É gratuito e leve.

1. Acesse: **https://mpv.io/installation/**
2. Clique em **"Windows builds by shinchiro"** e baixe o arquivo `.7z` mais recente (ex: `mpv-x86_64-20240101.7z`)
3. Extraia o arquivo para **`C:\mpv\`** — a estrutura deve ficar assim:
   ```
   C:\mpv\
   ├── mpv.exe      ← este é o que o AniPT procura
   ├── mpv.com
   └── ...
   ```

> 💡 **Dica**: O AniPT procura automaticamente o mpv em `C:\mpv\mpv.exe`. Não precisa configurar PATH!

#### Passo 2 — Baixe o AniPT

1. Acesse a [página de releases](https://github.com/AngeLZinS2/AniPT/releases)
2. Baixe o arquivo **`anipt.exe`** (Windows 64-bit)
3. Baixe também o arquivo **`AniPT.bat`** (launcher)
4. Coloque os dois arquivos na **mesma pasta**, por exemplo:
   ```
   C:\AniPT\
   ├── anipt.exe    ← o aplicativo principal
   └── AniPT.bat   ← clique duplo aqui para abrir!
   ```

#### Passo 3 — Execute!

Dê **duplo clique** em `AniPT.bat`. Uma janela de terminal vai abrir com o AniPT pronto para uso.

> ⚠️ **Atenção**: Não clique diretamente em `anipt.exe`. Use sempre o `AniPT.bat` para que a janela não feche sozinha.

---

### 🐧 Linux / macOS

**Pré-requisitos:**
```bash
# Linux
sudo apt install mpv   # Ubuntu/Debian
sudo pacman -S mpv     # Arch

# macOS
brew install mpv
```

**Baixe e instale o binário:**
```bash
# Linux (amd64)
curl -L https://github.com/AngeLZinS2/AniPT/releases/latest/download/anipt-linux-amd64 -o anipt
chmod +x anipt
sudo mv anipt /usr/local/bin/

# macOS (Apple Silicon)
curl -L https://github.com/AngeLZinS2/AniPT/releases/latest/download/anipt-darwin-arm64 -o anipt
chmod +x anipt
sudo mv anipt /usr/local/bin/
```

Execute com:
```bash
anipt
```

---

## 🔨 Compilação (para desenvolvedores)

Necessário apenas se quiser compilar do código-fonte.

```bash
# Requisitos: Go 1.24+
git clone https://github.com/AngeLZinS2/AniPT.git
cd AniPT

go mod download

# Compilar para Windows
GOOS=windows GOARCH=amd64 go build -o bin/anipt.exe ./cmd/anipt/

# Compilar para Linux
go build -o bin/anipt ./cmd/anipt/

# Usando Makefile (Linux/macOS)
make build
make cross-compile
```

---

## 🎮 Uso

### Interface interativa (TUI)

```bash
# Windows (via launcher)
AniPT.bat

# Linux / macOS
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

Para criar um novo provedor, consulte [docs/PROVIDERS.md](PROVIDERS.md).

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

Para adicionar um novo provedor, veja [docs/PROVIDERS.md](PROVIDERS.md).

---

## Torrents no desktop Rust

O player interno aceita fontes compatíveis que retornem `infoHash`, magnet ou URL `.torrent`, além dos vídeos HTTP/HLS. O motor librqbit fica embutido no EXE; não abre VLC nem CMD.

- Streaming por HTTP local em loopback, com token por processo e suporte a Range/seek.
- Transferência iniciada apenas ao escolher a fonte Torrent. Havendo vários vídeos sem índice informado pelo addon, o usuário escolhe o arquivo; o app não presume qual episódio é.
- Upload desativado na compilação. Trocar a fonte, fechar o player ou terminar a reprodução pausa a transferência.
- Arquivos ficam no cache local do AniPT; não são apagados automaticamente. Limite de 32 GB por arquivo, não uma quota global de cache.
- Peers/tracker podem ver seu IP. Disponibilidade depende de peers; codecs não suportados pelo WebView2 podem exigir outra versão do vídeo. Não há transcodificação de MKV/HEVC nesta integração.
- Testes isolados verificam transferência BitTorrent com peer local, leitura por Range, token de acesso e parada. Isso não garante funcionamento de todos os torrents públicos.

## 📜 Licença

MIT License — veja [LICENSE](../LICENSE) para detalhes.

<div align="center">
Feito com ❤️ para a comunidade anime brasileira

### 👨‍💻 Desenvolvido por Angelo Neri
**Gopher & Software Engineer**

Gostou do projeto? Conecte-se no LinkedIn!

[![LinkedIn Badge](https://img.shields.io/badge/LinkedIn-Angelo%20Neri-blue?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/angelo-neri-3921a72b9/)

</div>
