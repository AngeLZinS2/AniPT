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
