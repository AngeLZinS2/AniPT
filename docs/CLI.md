# AniBR CLI — interface de terminal

A CLI em Go continua disponível junto ao aplicativo desktop. O nome exibido, o comando e o launcher são **AniBR**, **`anibr`** e **`AniBR.bat`**. A interface interativa usa Bubble Tea e Lipgloss; os subcomandos usam Cobra.

## Recursos da CLI

- Pesquisa e navegação por animes, temporadas e episódios.
- Interface interativa por teclado, favoritos e histórico em SQLite.
- Escolha de idioma e qualidade oferecidos pelo provedor.
- Reprodução em player externo mpv ou VLC.
- Configuração local com Viper e arquivo YAML.

Os provedores Go são próprios da CLI. A instalação de addons, o player interno e o motor torrent pertencem à versão desktop; consulte o [README principal](../README.md).

## Windows

Mantenha estes arquivos da raiz do repositório na mesma pasta:

```text
AniBR/
├── anibr.exe
└── AniBR.bat
```

Abra **AniBR.bat** para iniciar a interface no terminal. Instale mpv ou VLC para reproduzir os vídeos. O launcher procura mpv no PATH e verifica as pastas usuais do VLC; o aplicativo também detecta instalações conhecidas dos players.

No PowerShell, o executável pode ser usado diretamente:

```powershell
.\anibr.exe --help
.\anibr.exe
.\anibr.exe search "naruto"
.\anibr.exe history
.\anibr.exe favorites
.\anibr.exe config
```

O arquivo `AniPT.bat` permanece como encaminhamento para `AniBR.bat`, preservando atalhos existentes. O executável da raiz é a CLI; o instalador e o portátil desktop são distribuídos separadamente pelo [site do projeto](http://173.212.251.120:8085/#download).

## Executar pelo código-fonte

Requisito: **Go 1.24+**. A CLI pode ser compilada sem Node.js, Rust ou Tauri.

```powershell
git clone https://github.com/AngeLZinS2/AniPT.git
cd AniPT
go mod download
go run ./cmd/anibr --help
go run ./cmd/anibr
```

Compilar no Windows:

```powershell
go build -o anibr.exe ./cmd/anibr
```

Compilar no Linux/macOS:

```sh
go build -o bin/anibr ./cmd/anibr
./bin/anibr
```

O Makefile também usa o nome `anibr` e a entrada `cmd/anibr`: `make build`, `make test-short`, `make vet` e `make cross-compile`. A entrada `cmd/anipt` continua disponível para compatibilidade com comandos de desenvolvimento existentes.

## Comandos

| Comando | Ação |
| --- | --- |
| `anibr` | Abrir a interface interativa |
| `anibr search "nome do anime"` | Pesquisa no provedor configurado |
| `anibr history` | Listar o histórico |
| `anibr history clear` | Remover todos os registros do histórico |
| `anibr favorites` | Listar favoritos |
| `anibr favorites remove "título"` | Remover um favorito pelo título |
| `anibr config` | Consultar configurações |
| `anibr config set player vlc` | Selecionar VLC |
| `anibr config set quality 720p` | Configurar a qualidade preferida |
| `anibr config set language legendado` | Configurar o idioma preferido |
| `anibr config set provider all` | Configurar a busca agregada |

Use `anibr <comando> --help` para consultar a ajuda de cada comando.

## Teclado

| Tecla | Ação |
| --- | --- |
| `Enter` | Pesquisar na home ou confirmar seleção |
| `↑` / `↓` | Navegar em listas |
| `T` | Abrir catálogo na home |
| `F` | Abrir favoritos na home ou alternar favorito nas telas compatíveis |
| `H` | Abrir histórico na home |
| `C` | Mostrar instrução de configurações na home |
| `/` | Filtrar listas compatíveis |
| `Esc` | Voltar |
| `Ctrl+C` | Sair |

## Compatibilidade dos dados

A alteração do nome preserva os caminhos existentes:

- Windows: `%APPDATA%\anipt\config.yaml` e banco `anipt.db`.
- Linux/macOS: `$XDG_CONFIG_HOME/anipt/` ou `~/.config/anipt/`.
- Variáveis de ambiente: prefixo `ANIPT_`.
- Módulo Go: `github.com/angeloneri/anipt`, preservado para os imports internos existentes.

Histórico e favoritos não precisam ser apagados ou recriados para usar o nome AniBR. A CLI e o desktop têm configurações e recursos próprios; mudar o nome não adiciona sincronização automática entre as interfaces.

## Provedores

| Identificador | Implementação |
| --- | --- |
| `all` | Agregador de provedores com reprodução |
| `animefire` | Provedor AnimeFire |
| `goyabu` | Provedor Goyabu |
| `mock` | Dados locais para desenvolvimento |

A disponibilidade dos provedores externos depende da rede e dos sites. Consulte [como implementar um provedor Go](PROVIDERS.md).

## Validação

```powershell
go test ./...
go vet ./...
go build -o anibr.exe ./cmd/anibr
.\anibr.exe --help
```

A compilação e a ajuda não comprovam disponibilidade de todos os provedores ou reprodução de todos os vídeos. A reprodução requer um player instalado e uma fonte acessível.

Na atualização do nome, `go test ./...`, `go vet ./...` e a compilação Windows foram executados. Um perfil temporário conferiu o banner, o cabeçalho, a leitura de favoritos e histórico existentes em `anipt.db` e a edição de preferências, preservando valores `false`. A validação não utilizou o perfil pessoal da instalação.
