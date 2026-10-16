# Progresso das melhorias AniBR

Objetivo autorizado: implementar todas as melhorias de ANALISE_MELHORIAS_APP.md, seguindo as três etapas, validar e entregar. Preservar dados e alterações anteriores. Atualizado em 14/10/2026.

Automação de retomada: `continuar-melhorias-do-anibr`, heartbeat a cada hora nesta conversa. Desativar ao concluir. Não há autorização para parar após uma entrega parcial.

## Etapa 1 — confiança
- [x] Configurações persistentes e respeitadas (histórico/auto-next).
- [x] Quero assistir/lista pessoal e demais ações com comportamento real.
- [x] Temporada real, filtros e ranking honesto.
- [x] Idiomas e disponibilidade somente quando comprovados.
- [x] Busca sem perda de foco e respostas antigas descartadas.

## Etapa 2 — experiência
- [x] Legibilidade/tokens/densidade; Home curta e carrossel acessível.
- [x] Navegação preservada, favorito hidratado e ação de retomada.
- [x] PT-BR, títulos alternativos, sinopse/original e relações reais.
- [x] Carregamento/falhas por seção, cache e diagnóstico de fontes.
- [x] Diálogos acessíveis, atalhos e player com velocidade/faixas.
- [x] Validação visual responsiva e testes funcionais.

## Etapa 3 — organização e retenção
- [x] Lista pessoal com busca, ordenação e estados.
- [x] Progresso editável, marcar visto/não visto e remover retomada.
- [x] Agenda local e notificações opcionais.
- [x] Quota/cache de torrents e limpeza de inativos.
- [x] Exportar/importar dados e gerenciar histórico.
- [x] Descoberta/coleções/recomendações explicáveis.
- [x] Documentação alinhada e compilação final desktop.

## Conclusão

Implementação e validação concluídas. Consulte ENTREGA_MELHORIAS.md para comportamentos, evidências e limites. 37 testes frontend e 20 Rust passaram; 2 testes externos ignorados. Build release/MSI/NSIS concluído. Entregas novas no Desktop; dados e versões anteriores preservados. Automação desativada após a entrega.



Correção posterior: usuário identificou destaque abaixo da retomada quando havia histórico. Removida ordem condicional; hero sempre antes de continueSection, independentemente do histórico.

Correção do botão Assistir: enhancement movia botão para episode-actions, invalidando seletor legado de filho direto. Aplicado purple-button no próprio controle e border:0 na classe canônica. Inclui correção anterior da ordem do banner.

Correção de seleção visual das fontes: agrupamento por idioma altera ordem DOM, mas class active usava índice de NodeList. Alterado para comparar data-stream com activeStream, mesma identidade usada pelo clique e reprodução. Inclui correções anteriores de banner e botão Assistir.

Pedido posterior: removida barra extra playback-progress do player e atualização DOM correspondente. Evento timeupdate continua salvando tempo/duração; controles nativos e retomada preservados.

Pedido posterior: carregamento da busca de fontes usa banner do anime, cobertura central e camada escura. Fallback para capa; falha de ambas mantém fundo neutro. Cancelamento preservado. Inclui remoção da barra extra do player.

Idioma das fontes reposicionado: botão usa duas colunas, nome/qualidade à esquerda e badge à direita. Altura automática, quebra de nomes longos e badge contido na própria fonte. Mantidas correções anteriores.

Configurações corrigidas: classe app-settings isolada da grade legada com áreas sources/player/behavior. Painéis de largura completa, campos empilhados e formulário de fonte responsivo. UI inspecionada em área útil 1265px e 785px (viewport 800x600), sem overflow horizontal. Evidência docs/evidencias/configuracoes-corrigidas.jpg. Preferências não alteradas.

Trailer AniList: consulta trailer{id site thumbnail} e metadados frescos nos detalhes (inclusive Home desktop/histórico). Painel à direita da sinopse, abaixo em janela estreita. YouTube/Dailymotion com ID validado, iframe sob clique sem autoplay, thumbnail e link externo. UI confirmou trailer YBWOrQCB9r0 do AniList e iframe correspondente. Evidência docs/evidencias/trailer-anilist.jpg. Reprodução dentro do desktop depende da política de incorporação do serviço.

Ajuste pedido durante validação: removidos crédito abaixo do trailer e link externo; mantém somente player e botão de abertura.

Miniaturas dos episódios: solicitado banner onde não há thumbnail. Render paginado agora cria imagem com thumbnail/banner/capa e imageFallback tenta os três também em falha HTTP. Alt identifica imagem da obra sem afirmar cena específica. 37 testes frontend passaram.

Ícone do header: removida grade legada e margem negativa da seta. A e seta centralizados em flex com espaçamento de 3px no círculo. Validado visualmente, evidência docs/evidencias/header-icone.jpg.

Correção do entendimento do ícone: usuário pediu imagem original do app. Header agora usa PNG local copiado de src-tauri/icons/128x128.png, mantendo nome e ação início. Conferido visualmente, evidência header-imagem-icone.jpg.

15/10 — Primeiro acesso implementado: saudação Olá animada, nome opcional/local, modo anônimo, recepção final e saudação na Home. Perfil local editável e apresentação repetível nas configurações. Botão Uiverse adaptado com licença. 40 testes frontend passaram, UI nome/reload/anônimo e responsividade validados. Detalhes em docs/PRIMEIRO_ACESSO.md. Sem automação nova.

Refinamento solicitado: referência landonorris.com era o capacete reagindo ao mouse. Implementado emblema A realmente 3D (Three.js, geometria própria) com reação ao cursor, iluminação/reflexos dinâmicos, suavização, controle por setas e retorno ao centro. Preservados formulário local/anônimo. UI WebGL e mudança de rotação pelo cursor confirmados; 40 testes passaram. Licenças locais e fallback sem GPU incluídos.

15/10 — A apresentação foi refeita conforme a direção final: mosaico 3×3 de nove animes, 1080p/24 fps, local e sem som, revelado pelas faixas que seguem o cursor. Um único vídeo de 9,48 MiB substitui o A 3D e os clipes remotos. O Olá escreve, pausa e retrai os traços em ordem inversa, em loop de 9 s, sem fade; traços recolhidos ocultam as pontas arredondadas. Frase de instrução removida e faixas afinadas aproximadamente 35–38% conforme pedidos posteriores. Nome opcional/local/anônimo e dados anteriores preservados. 42 testes frontend passaram; vídeo decodificado integralmente sem erro e reprodução 1920×1080/readyState 4 confirmada na prévia web. Inatividade pausa e formulário remove vídeo/máscaras. Sem overflow horizontal em 800×600. Fontes e recortes em WELCOME_MEDIA_SOURCES.json; detalhes em PRIMEIRO_ACESSO.md. Automação anterior permanece pausada.

Build final após afinar as faixas e remover a frase: Tauri/release/MSI/NSIS passaram. Executável e Setup no Desktop, AniBR-0.3.0-Mosaico-1080p.exe e -Setup.exe, cópias verificadas por SHA-256. A apresentação pode ser revista em Configurações.

## 15/10/2026 — AniBR 0.3.1 e guia de fontes

O usuário confirmou que o erro ao conferir a identidade da temporada era bloqueio da rede: funcionou ao trocar a conexão. A mensagem passou a explicar a falha de acesso ao Kitsu e sugerir verificar conexão/bloqueios. A lógica de verificação de temporada não foi afrouxada.

Corrigido o primeiro acesso em movimento reduzido: mantém Olá estático e pôster, sem avançar automaticamente; oferece ativação explícita do lettering e mosaico. Opção restrita à apresentação atual. Origem isolada confirmou hello sem vídeo, opt-in full com hello-o-loop, mídia local 1920×1080 readyState 4 e descarte de vídeo/máscara ao avançar ao nome.

Versão 0.3.1 consistente em npm/frontend/Cargo/Tauri. 42 testes frontend e 20 testes Rust passaram; 2 testes de rede permanecem opcionais. Build release, MSI e NSIS passaram. O ZIP portátil contém AniBR.exe, instruções e licenças; o hash do EXE dentro do ZIP confere com o release. Mosaico de frontend/public e frontend/dist idênticos.

Site publicado na VPS, release 20261015T130804Z, contêiner saudável. Downloads separados: AniBR-0.3.1-Setup.exe (17.151.626 bytes, SHA256 b3c533ec04fa8902771730a6243350b8d62d38485e55fb7ae711f2d59db0ec00) e AniBR-0.3.1-Portable.zip (20.151.525 bytes, SHA256 f4fd3e06548b51681d44b264fa1a43cbe5b7a99383e7a55bc12790fd030d17f2). SHA256SUMS em UTF-8/LF validado antes da ativação. HEAD público 200, tamanhos corretos, attachment e assinatura/Range do ZIP 206 conferidos. Binários antigos mantidos para os links anteriores.

Guia em http://173.212.251.120:8085/#fontes com link https://stremio-addons.net/addons?query=anime, exemplo de stremio:// para https://, Configurações → Fontes instaladas → URL do manifest → Adicionar fonte e Testar fonte. Domínio addon.example é ilustrativo. FAQ explica extrair o portátil. Layout verificado no computador e em 390 px sem overflow horizontal; fonte e downloads confirmados no navegador público. Autoplay anterior preservado. Nenhum dado pessoal/URL privada foi colocado no ZIP ou site. Não houve teste de instalação nativa no outro PC nesta rodada. Automação anterior permanece pausada.

## 15/10/2026 — CLI mantida e renomeada para AniBR

Orientação explícita do usuário: preservar as versões desktop e CLI, ambas com o nome AniBR. A CLI Go continua como forma de uso do projeto; não remover `cmd/` ou `internal/` ao evoluir o desktop.

Atualizados nome/comando da ajuda, exemplos, cabeçalho, banner ASCII, launcher `AniBR.bat` e binário Windows `anibr.exe`. `AniPT.bat` encaminha para o novo launcher; `cmd/anipt` continua compatível, com entrada principal em `cmd/anibr`. Caminhos de configuração, banco `anipt.db`, módulo Go e prefixo `ANIPT_` preservados. README e LinkedIn apresentam as duas versões; guia em `docs/CLI.md`. Planejamento da migração ajustado para continuidade da CLI.

Validação: `go test -mod=readonly ./...` e `go vet -mod=readonly ./...` passaram (pacotes Go ainda não têm testes unitários próprios); build Windows e ajuda dos comandos aprovados. Renderização do banner/home e cabeçalho conferida por chamada ao modelo TUI. Perfil temporário com configuração/banco anteriores manteve favoritos, histórico e preferências `false`; edição de qualidade persistiu. Ambos os launchers repassam `--help` ao AniBR. Sem alteração do perfil pessoal, sem teste de reprodução em provedores externos nesta rodada.

## 15/10/2026 — Correção de fontes que misturam temporadas (0.3.2)

Reproduzido no desktop com Black Clover: AniList 97940 corresponde a Kitsu 13209, enquanto a segunda temporada AniList 195604 corresponde a Kitsu 50024. O catálogo e a identidade Kitsu eram distintos, mas a FenixFlix retornava, para kitsu:50024:1, duas opções com os mesmos links da primeira temporada misturadas às opções corretas.

Adicionada conferência das opções retornadas pelas fontes usando os títulos da parte solicitada e de suas relações PREQUEL/SEQUEL no AniList. O título mais específico prevalece para não confundir o nome da continuação com o nome-base contido nele. Ordinais e rótulos de temporada em PT-BR/inglês são normalizados. T01/EP01 sozinho não determina a identidade: continua válido dentro de uma parte cadastrada separadamente. Títulos idênticos entre partes e respostas sem rótulo conflitante não são tratados como prova de erro. A validação prévia AniList/Kitsu permanece. Catálogo da conferência é guardado por uma hora; falha de consulta informa o problema e não libera reprodução sem essa conferência.

As opções que identificam outra parte são descartadas antes da seleção de servidor; o diagnóstico de cada fonte informa a quantidade removida. Esta conferência usa metadados e rótulos fornecidos, sem analisar o conteúdo de um vídeo cuja fonte esteja rotulada incorretamente.

Validação: 24 testes Rust passaram; 3 testes dependentes da rede ficam opcionais. Quatro regressões cobrem resposta mista, temporada original versus continuação, ordinais/idiomas e títulos compartilhados. Teste ao vivo explícito: 6 opções recebidas, 2 links da primeira temporada descartados e 4 opções preservadas; nenhum link sobrevivente coincide com a primeira temporada. Sem download/reprodução dos vídeos ou alteração do perfil pessoal. A CLI permanece disponível e não foi modificada por esta correção.

Na mesma atualização, corrigida a apresentação do número da temporada: o frontend distingue a temporada exibida no catálogo do índice interno usado pela fonte. Títulos com ordinais/Season/Temporada e a sequência das partes relacionadas orientam o rótulo; partes divididas mantêm o número explícito. IDs, índices de consulta e chaves do progresso permanecem inalterados. Lista de episódios, cabeçalho, edição de progresso, retomada com título numerado e player usam a numeração de apresentação.

47 testes frontend passaram, incluindo cinco regressões de numeração. TypeScript/Vite passaram. Verificação visual em origem isolada: Black Clover Season 2 mostra Temp. 2 · Ep. 1 e Temp. 2 · Ep. 2; a primeira parte mostra Temp. 1 com 170 episódios e 15 por página (12 páginas). Evidência: docs/evidencias/black-clover-temporada-2.png. Nenhum histórico/favorito da instalação pessoal foi alterado.

Distribuição 0.3.2 concluída: build release, MSI e NSIS aprovados. ZIP com quatro arquivos (AniBR.exe, instruções e duas licenças), hash do EXE interno igual ao release e ProductVersion 0.3.2. Site publicado na VPS, release 20261015T150228Z, contêiner saudável. Instalador: 17.165.035 bytes, SHA256 37d65387b009840c2d7b30acd3fae9bd223b4765bde71a6009577ee1a5bae540. Portátil: 20.175.116 bytes, SHA256 35bf11932464489c38ef353a9b2ec9d58faae2a4b9d1df38da0c9101c9fb719f. Site e links 0.3.2, SHA256SUMS público, HEAD 200/attachment/tamanhos e ZIP Range 206/assinatura PK conferidos. Versões anteriores preservadas para links antigos. Não houve instalação nativa no outro PC nem análise/reprodução dos vídeos retornados pelas fontes nesta rodada.


## 15/10/2026 — Fenix: conversão de coordenadas e diagnóstico HiAnime (0.3.3)

Reteste do usuário demonstrou que o filtro da 0.3.2 era insuficiente. Inspeção de frames aos 60 segundos confirmou que opções rotuladas como segunda temporada na consulta kitsu:50024:1 reproduziam a mesma cena da primeira parte. Não basta comparar rótulos ou URLs de CDN diferentes.

A conversão agora utiliza exclusivamente os campos por vídeo imdb_id, imdbSeason e imdbEpisode fornecidos pelo addon de metadados Kitsu, depois da verificação de identidade AniList/Kitsu. Para Black Clover, kitsu:50024:1 converte para tt7441658:2:1, tipo series. Inicialmente aplicada à Fenix para continuações/alterações de coordenadas; ampliada nesta rodada para a Nyaa Anime BR que exige IMDb. Outras fontes mantêm seus identificadores. Sem mapeamento confirmado, a consulta ambígua da Fenix é descartada e outras fontes continuam disponíveis. Filtro desta consulta verifica T02 EP01/S02E01 em vez de rejeitar o nome-base da série. Também identificadas playlists HLS sem extensão por GET limitado; HEAD dessas CDNs pode responder 405.

Validação: 33 testes Rust e 47 frontend passaram; quatro testes de rede opcionais permanecem ignorados por padrão. Teste Fenix ao vivo usa o mesmo resolvedor de produção, confirma ID/tipo, preserva duas opções T02 EP01, identifica HLS e verifica acesso a segmento de mídia. Frame da primeira opção final decodificado com ffmpeg aos 60 s, diferente da primeira parte e igual ao resultado da consulta explícita de temporada. Isso valida a seleção e uma amostra da mídia, sem afirmar conferência integral do episódio ou de todas as opções. CLI Go mantida sem alterações.

HiAnime solicitada: https://streamio-hianime.onrender.com/manifest.json responde HTTP200 e exige IDs hianime:. Catálogo trending e buscas Black Clover, Naruto e One Piece retornaram metas vazios. A consulta trending pela VPS também retornou vazio. Não há ID nativo/episódio verificável para concluir a integração e validar reprodução. Nenhuma associação por título ou ID inventado foi adicionada. Testar fonte agora informa separadamente o estado do catálogo desse tipo de addon, sem confundir manifesto acessível com reprodução confirmada. Para concluir HiAnime é necessário que o serviço volte a fornecer catálogo/metadados, com uma correspondência de identidade verificável; a fonte continua pendente.

Build release/MSI/NSIS 0.3.3 concluído. Alterações locais preexistentes do checkout principal preservadas; desenvolvimento isolado na worktree fenix-season-resolution.

Após o usuário informar o aviso de atraso de 50 s da página da HiAnime, o timeout de catálogo/metadados/vídeos do endereço exato foi ampliado de 15 s para 70 s. Novo teste limita a exceção ao host correto. Reteste com orçamento de 70 s respondeu HTTP200 em 1,16 s com metas vazios; portanto o catálogo vazio observado não foi causado pelo limite local de 15 s. A ampliação prepara consultas lentas, mas não resolve ausência de IDs/conteúdo do serviço.

Fonte adicional solicitada: https://stremio-br-anime.onrender.com/manifest.json. O manifesto público exige configuração e não declara recursos ativos; /configure gera link com token. Link de teste gerado e mantido somente em arquivo local ignorado, sem alterar o perfil do usuário. Manifesto configurado Nyaa Anime BR declara stream/series e prefixo tt. Incluída conversão explícita IMDb também para este host, em qualquer temporada, sem fallback Kitsu. Retorno ao vivo T02 EP01: cinco torrents, quatro com S02E01 confirmados e um sem coordenadas suficientes descartado. Nenhuma afirmação de disponibilidade de peers, decodificação do torrent ou idioma pelo nome do addon. Cadastro agora rejeita manifestos configurationRequired com orientação para copiar o link configurado; Testar fonte mostra esse diagnóstico em instalações anteriores. Quarto teste de rede opcional registra a resolução Nyaa.

O usuário forneceu posteriormente seu próprio link Nyaa configurado. Manifesto validado e fonte adicionada somente ao config.yaml local. Backup privado salvo em diretório ignorado; comparação confirmou que o restante do arquivo permaneceu idêntico. Novo teste ao vivo com esse link passou. Nenhum token foi incluído no Git/site/distribuições.

Publicação 0.3.3 concluída na VPS, release 20261015T162247Z, contêiner saudável. AniBR-0.3.3-Portable.zip: 20201001 bytes, SHA256 3af6417dc2bef09e0719a85232b19601940140e38cb58e2b9e742ef4c07ce229; AniBR-0.3.3-Setup.exe: 17183420 bytes, SHA256 2c894f2774f62bb57c1fe3581e7a9ae127aadf003dbf9ce866aee40ae43b0e9b. Conferidos HEAD público 200/attachment/tamanhos, SHA256SUMS público idêntico, ZIP Range 206/assinatura PK e EXE interno igual ao release. Mosaico public/dist manteve o mesmo SHA256. Downloads antigos preservados. Não houve instalação nativa no outro PC ou reprodução de torrent Nyaa nesta rodada.


## 15/10/2026 — Pacotes Nyaa em Attack on Titan T1 EP1 (0.3.4)

Reproduzido o relato exato: nove opções de Nyaa, todas descartadas na 0.3.3 por falta de S01E01. Resposta real contém pacotes 01–25, coleções multitemporadas com fileIdx=0 e resultados conflitantes de Final Season/OAD com sufixo 1x1 acrescentado pelo addon. Esse sufixo não confirma a identidade do conteúdo.

Filtro específico Nyaa agora mantém pacotes como candidatos a inspeção do arquivo e continua descartando partes explicitamente conflitantes. Candidatos não confirmados recebem requires_file_selection e perdem o fileIdx sugerido. O player ignora índices sugeridos/salvos e o atalho de arquivo único nesses casos, exibe o anime/temporada/episódio esperado e aguarda escolha explícita do arquivo após obter metadados. Painel marca Conferir arquivo; diagnóstico distingue pacotes pendentes de opções incompatíveis/sem identificação. Não são apresentados como mídia já confirmada. Filtro estrito da Fenix preservado.

Regressão com os nove rótulos recebidos mantém cinco pacotes para escolha manual e remove quatro resultados Final Season/OAD. Testes impedem que S01E01 ou S02E02 passem em consulta S02E01 por um sufixo artificial 2x1. Duas regressões frontend impedem autoplay por índice zero, escolha salva ou arquivo único nos pacotes incertos; fontes confirmadas mantêm comportamento anterior. 35 testes Rust e 49 frontend passaram; cinco testes de rede opcionais. Build release/MSI/NSIS e publicação concluídos. CLI preservada.

Verificação ao vivo do resolvedor final: Attack on Titan T1 EP1 recebe nove opções, rejeita quatro conflitos e mantém cinco pacotes pendentes de escolha do arquivo. Black Clover T2 EP1 continua retornando cinco candidatos Nyaa (quatro com coordenadas explícitas e um pacote que agora exige conferir arquivo). Uma sondagem isolada com o mesmo librqbit de produção obteve metadados reais de um pacote AOT: 26 arquivos, primeiros caminhos Shingeki no Kyojin - 01, 02, 03 e 04. Uma segunda sondagem, destinada a obter uma amostra de mídia, não resolveu metadados em 30 s. Portanto houve conferência de arquivos reais, mas não reprodução/decodificação P2P validada; peers podem variar. A sondagem usou pasta isolada, upload desativado, nenhuma persistência DHT/sessão e não alterou o cache pessoal. Código temporário da sondagem mantido somente no diretório ignorado.

Distribuição 0.3.4 publicada: release 20261015T164141Z, contêiner saudável. AniBR-0.3.4-Portable.zip: 20205514 bytes, SHA256 613ffe4bd0cdec9174b1381cd45ebfc39fd246c11344146934cf86e8b6cc730a; AniBR-0.3.4-Setup.exe: 17189444 bytes, SHA256 3c2cec51ffdc63587c00443a37c7389d0592fc07019b49c88e6d14fe6aea2653. Conferidos EXE interno do ZIP/release, ProductVersion 0.3.4, links/HEAD públicos 200 e attachment, tamanho, SHA256SUMS público idêntico e ZIP Range 206/assinatura PK. Downloads anteriores mantidos.


## 15/10/2026 — Seleção automática de torrent/arquivo e título do conteúdo (0.3.5)

Usuário pediu remover a escolha manual de arquivo, priorizar o maior número de seeds e usar o título do conteúdo. Backend passa título do torrent, seeds informados pelo addon e coordenadas IMDb verificadas para seleção de arquivo. Frontend prioriza torrents elegíveis com mais seeds, usando qualidade como desempate; idioma explicitamente oposto fica fora da tentativa automática quando existem opções compatíveis/desconhecidas. Escolha anterior de servidor não substitui essa prioridade. Seeds declarados não são uma medição de velocidade/peers ativos.

Arquivos são identificados pelos caminhos reais dos metadados: S01E01/T01EP01/1x01, temporada de pasta e número local quando a identidade da parte é suficiente. Índice informado pelo addon, posição na lista e escolha salva não liberam um arquivo conflitante. Sem correspondência única ou ao falhar, tenta outra fonte sem abrir a lista de arquivos. Tentativas são finitas e canceladas ao trocar/fechar. Fontes mostram título do conteúdo e seeds, mantendo origem/qualidade como detalhes; após escolher arquivo o nome real é mostrado. Filtro de temporadas Fenix/Nyaa e CLI preservados.

Regressões incluem o pacote Demon Slayer do print, AOT 01/02 sem SxxExx, temporada2 versus1, ranges/OVA/extras/Final Season, nomes com underscore, ambiguidade, prioridade de seeds sobre resolução, desempate por qualidade, idioma e esgotamento de fontes. 36 testes Rust e59 frontend passaram; build release/MSI/NSIS concluído, publicação em andamento.

Diagnóstico de legendas da solicitação anterior: cabeçalho real do torrent Solo Leveling S01E02 ToonsHub/B-Global2160p confirma duas legendas ASS PT-BR (normal eCC) e áudio português. Suporte a extração/renderização dessas legendas embutidas ainda não foi implementado nesta alteração de seleção automática. Evidências somente em diretório local ignorado.

Distribuição0.3.5 publicada e verificada: release 20261015T225510Z, contêiner saudável. AniBR-0.3.5-Portable.zip: 20204915 bytes, SHA256 6220c01fb9b7d61b33523df6a37f90242c38ec7a7d0d85b6c269c0349e78a5e6; AniBR-0.3.5-Setup.exe: 17191496 bytes, SHA256 0becbe9ae8735f319c5ec321d3c45e663d4f7bc11ab4fc54402ae27c90c71501. ProductVersion0.3.5 e EXE do ZIP iguais ao release, quatro arquivos no portátil. HEAD público200/attachment/tamanho, SHA256SUMS e ZIP Range206/assinaturaPK aprovados; links antigos preservados. Não houve teste completo de reprodução da escolha automática no desktop nativo nesta rodada; validação por testes de identificação/ranking/fallback e compilação Windows.

## 15/10/2026 — Player cinematográfico e legendas embutidas (0.3.6)

Solicitação: painel de fontes com texto sobreposto e mais largura; player inspirado nas referências do Stremio, com vídeo ocupando a tela e menus sobrepostos. Nova barra própria: reproduzir/pausar, volume, timeline acessível, episódios, qualidade/velocidade, áudio quando exposto pela fonte, legendas, transferência P2P, servidores e tela cheia. Controles somem após inatividade durante reprodução e reaparecem com mouse/teclado; menus ficam acessíveis em tela cheia. Painel de servidores até420px, títulos com atétrês linhas e nome completo em tooltip, linhas com altura do conteúdo, rótulos à direita, nomes e origem com quebra e rolagem independente. Seleção por seeds e arquivo verificado da0.3.5 preservada.

Legendas de texto embutidas em MKV torrent: parser em Worker com leituras HTTP Range limitadas, até60s de antecipação e índice Cues para saltos; suporte a clusters com CRC32 antes do Timecode. ASS/SSA preservam estilos e fontes disponíveis via JASSUB/libass/WASM; UTF-8 usa estilo padrão. Prefere português completo a CC, sem escolher inglês silenciosamente; troca/desativação, atraso ±10s, tamanho75–175% e elevação até25%. Trabalhadores, fetch e canvas são encerrados ao trocar/fechar. Recursos locais, sem FFmpeg instalado e sem consulta remota de fontes. CORS do stream local permite somente origens locais/Tauri, mantendo token e arquivo ativo como requisitos; origens externas negadas.

Limites: PGS/VobSub (legenda bitmap) e busca externa OpenSubtitles não implementados. Áudio selecionável depende das faixas expostas por HLS/player; não houve transcodificação de áudio MKV. MKV sem Cues é lido sequencialmente para reencontrar legendas após salto. O caso real SoloLeveling2160p já confirmou ASS português no cabeçalho; reprodução nativa desse torrent completo ainda não foi validada nesta rodada.

Validação:64 testes frontend e37 Rust aprovados (cinco de rede opcionais ignorados). Fixture MKV sintético confirma tempos, idioma, duração, Cues e retomada por byte. Browser: PT/inglês, texto único, desativação, posição, avanço a95s, tela cheia com painel e cards longos sem sobreposição em desktop/800×560 e retenção de foco/despertar por Tab após ocultar controles. Worker e WASM empacotados, build de produção aprovado. Página de teste reproduzível em frontend/tests/player.html; não faz parte do instalador. Licenças JS/WASM e referência ao código correspondente incluídas em frontend/public/licenses. Publicação será registrada após concluir build e checagem dos pacotes.


Ajuste solicitado pelo usuário ao testar: separar fontes de vídeo direto e torrents (filtros Todos/Torrents/Diretos, com contagens, grupos por idioma e índices originais preservados). A prioridade automática passa a ser vídeo direto compatível primeiro; esgotados os diretos, torrents com mais seeds. Preferência de qualidade é aplicada dentro do tipo, e o idioma continua respeitado. Escolha explícita pelo painel ou seletor de servidor é manual: nenhuma falha de metadata, arquivo, codec, HLS ou P2P troca silenciosamente para o torrent mais popular. Retentar mantém o modo e servidor escolhidos; erro orienta tentar novamente ou escolher outro. Regressões para precedência de direto/qualidade, manual sem fallback e grupos por formato. Total atualizado:68 testes frontend;37 Rust aprovados. Fonte ativa pode reaparecer ao trocar automaticamente de tipo, sem filtros esconderem a seleção.

Distribuição0.3.6 original publicada em20261016T004416Z: portátil22103226 bytes SHA256 f1e218fb1efcff7cde71f57bd120cbedda7e51ba00f34a8646308469fe38e415; instalador19084901 bytes SHA256 8a90cf5027879994a43f2796e07d2c8b9a5be18d2f78324c0e9a1d1d950574fe. Usuário abriu o executável nativo, depois solicitou os refinamentos a seguir. Build do último ajuste de teclado encontrou EXE aberto; nova saída isolada preparada sem fechar a sessão. O usuário informou depois que fechou o app. Pacotes seguintes passam a0.3.7 para distinguir das versões já testadas e preservar downloads anteriores.

## 15/10/2026 — Diretos/torrents, escolha manual e player centralizado (0.3.7)

Ajustes finais solicitados ao testar o novo player: volta a abrir em modal centralizado, limitado a1440×810 e92vw/86dvh; botão ativa tela cheia real preservando vídeo e menus. Fontes separadas por tipo, com filtro Todos/Diretos/Torrents e contagens. Prioridade automática: diretos compatíveis primeiro; depois torrents por seeds informados. Qualidade preferida aplicada dentro de cada tipo. Escolha manual pelo painel ou seletor trava o servidor escolhido e impede fallback silencioso, inclusive diante de erro de arquivo/metadata/HLS/codec/P2P. Retentar mantém o modo manual. Interface informa erro para a pessoa escolher/retentar. Agrupar e filtrar não altera índices nem a identificação rigorosa de episódio. Todas as demais melhorias de legendas e CLI preservadas. Foco permanece no diálogo quando controles somem; Tab os revela novamente.

Distribuição0.3.7 concluída: release20261016T010104Z, contêiner saudável. Portátil22103789 bytes, SHA256 58fca519febcac6b1d95807ffb5a7910a260ed6a739098fd95695c2c967db92d; instalador19086552 bytes, SHA256 b65f688fb3c5401df241060002fe374a9aa1355d7e324e1995f9c1c1f81eb614. EXE0.3.7 conferido contra o arquivo no ZIP (27 entradas, incluindo23 avisos/licenças). MSI e NSIS gerados em saída isolada. Após o usuário fechar o app, o executável e os bundles locais no target original também foram atualizados, sem modificar suas quatro alterações de código preexistentes. Downloads anteriores preservados. Uma conexão SSH expirou; nova tentativa publicou normalmente.

QA final0.3.7: filtros exclusivos de diretos/torrents com contagens corretas, separação por tipo mantendo índices originais, retorno de tela cheia para modal centralizado1440×810 (medido), rolagem própria do painel na janela padrão1180×760 sem scroll externo, controles/menus e encerramento removendo canvas. Regressões de prioridade de direto e escolha manual aprovadas entre68 testes frontend.37 testes Rust anteriores continuam aprovados para o backend sem mudanças funcionais nesta revisão; cinco testes de rede opcionais. Nenhuma reprodução nativa completa de torrent real foi declarada. Legendas testadas no mesmo parser/renderer com MKV sintético e confirmação prévia das faixas PT-BR no cabeçalho real de SoloLeveling. O suporte externo HiAnime continua dependente do serviço, conforme registro anterior.

Validação pública0.3.7 aprovada após publicar: links de instalador/portátil corretos, HEAD200/attachment e tamanhos22103789/19086552, SHA256SUMS público idêntico ao local, ZIP Range206 com assinatura504B0304. Código enviado ao main no commit7d01ff4 (refino documental subsequente). Diretório temporário de QA encerrado, viewport restaurado e aba de teste fechada. Executável local já em0.3.7.


## 16/10/2026 — Identidade de episódios e Boku no Hero (0.3.8)

Usuário relatou Boku no Hero Academia T1 EP1 abrindo episódio de outra temporada. Auditoria encontrou: Fenix primeira parte não exigia conversão IMDb; filtro geral só comparava títulos relacionados imediatos, ignorando coordenadas; filtro IMDb só lia a primeira coordenada; metadados aceitavam ID com sufixo diferente de video.episode; torrent aceitava SxxExx sem conferir obra, ordinais de temporada e conflitos no pacote. Cache de streams não incluía temporada/número esperado.

Implementado contrato estrito do vídeo Kitsu: parte exata, sufixo decimal coerente, número positivo, temporada local válida e ausência de duplicatas conflitantes. Get_streams recebe temporada/número e revalida o vídeo nos metadados antes das fontes, inclusive retomada. Coordenadas locais e globais permanecem separadas. Conversão verificada também habilita addons IMDb declarados no manifesto, sem inventar temporada1. Fenix/Nyaa exigem mapeamento por vídeo. Filtros detectam todas as coordenadas conflitantes, ordinais/romanos e sufixos v2; behaviorHints.filename participa da conferência. Campo de cache inclui temporada/número para não contornar a validação.

Teste real detectou Fenix respondendo nomes 2nd Season para consulta IMDb confirmada de T1 EP1. Esses retornos foram bloqueados. O ID Kitsu canônico validado do mesmo episódio respondeu opções coerentes; resolvedor centralizado admite essa rota alternativa SOMENTE se o mapeamento provar primeira parte, sem prequela, com coordenadas local/global idênticas. Continuações ou numerações diferentes nunca usam essa alternativa. Essa regra evita reintroduzir o erro anterior de Black Clover.

Torrents: identificação positiva da obra no pacote/caminho e veto de título próprio conflitante; SxxExx não dispensa verificar obra. Season3/3rdSeason/3ªTemporada/SeasonIII, parte/cour e coordenadas no pacote são conferidos. Coleções multitemporadas exigem temporada do arquivo. Mapeamento global é aplicado somente quando essa foi a identidade usada na consulta. Coordenadas globais verificadas identificam split cour sem exigir etiqueta Part redundante. Nomes genéricos são admitidos quando o pacote identifica a obra; outra obra não é renomeada pelo pacote. Na consulta Nyaa real T1E1, o addon retornou um pacote Vigilantes/Illegals: novo teste reproduz o título e rejeita o derivado, inclusive antes de buscar metadados P2P. Nenhuma busca por similaridade ou ID inventado foi adicionada.

Validação:79 testes frontend,49 Rust locais,6 testes opcionais de rede. Teste ao vivo de produção Fenix Boku T1 EP1/T3 EP1 passou: mapeamentos tt5626028:1:1 e tt5626028:3:1 distintos, respostas contraditórias descartadas,6 opções da primeira parte e2 da terceira com mídia acessível. Oito amostras aos60s foram decodificadas com ffmpeg e inspecionadas; são versões/cortes distintos e aberturas diferentes, sem alegar conferência integral de cada episódio. Evidência e respostas de mídia ficam somente no diretório ignorado do checkout principal .media-work/episode-identity-fix. Não houve reprodução nativa interativa completa nem reprodução P2P do pacote errado. Diretos primeiro, seeds entre torrents, manual sem troca silenciosa, player centralizado, legendas e CLI preservados.

Build release/MSI/NSIS0.3.8 concluído. Go test ./... com o runtime local compilou todos os pacotes/entradas CLI (não há testes Go definidos). Portátil com27 entradas e EXE idêntico ao release; ProductVersion0.3.8 conferido. EXE e bundles no target original também atualizados após confirmar ausência de processo em uso; quatro alterações de código preexistentes permanecem intactas.

Publicação0.3.8 concluída na VPS, release 20261016T034305Z, contêiner anibr-site saudável. Instalador19088371 bytes, SHA256 3fe7a55cc0159225ad59726cfd9ce6f06c7593cd0cbf0a31dc8d37302ed35496. Portátil21653994 bytes, SHA256 688198b65856fb91a32c04b98e37033ec4214f6e9ccfbabaad54afa4087a602a. Downloads anteriores preservados e todos os hashes validados no servidor antes de ativar. Verificação pública: HEAD200/attachment/tamanhos, SHA256SUMS idêntico ao local, ZIP Range206/assinaturaPK, links0.3.8 e autoplay aprovados. A apresentação/mosaico e demais recursos permanecem no EXE. Trabalho desta retomada concluído; automação das00h20 foi desativada após a validação (PAUSED). HiAnime continua pendência externa anterior, sem novas tentativas nesta correção.
