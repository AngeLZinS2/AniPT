# AniBR 0.3.0 — entrega das melhorias

Concluído em 14/10/2026. As três etapas de ANALISE_MELHORIAS_APP.md foram implementadas, incluindo os ajustes posteriores solicitados pelo usuário.

## Comportamento entregue

- Detalhes com até 15 episódios por página, busca em todos os episódios e abertura da página do progresso salvo.
- Novidades sem corte de 72 horas: seis exibições mais recentes na Home e arquivo completo paginado em Ver todos.
- Preferências persistentes, histórico opcional, próximo episódio automático e retomada com identidade e tempo reais.
- Lista pessoal com cinco estados, busca, ordenação e notificações opcionais enquanto o aplicativo estiver aberto.
- Temporada por ano/trimestre, ranking por critérios reais, agenda em horário local e descoberta por coleções e gêneros acompanhados.
- Sinopse PT-BR sob demanda, crédito MyMemory, edição pessoal e acesso ao original; relações reais do AniList.
- Fontes com diagnóstico e data da consulta; idioma e disponibilidade não são inferidos do catálogo.
- Progresso manual, visto/não visto, remoção da retomada e exportação/importação com validação e mesclagem.
- Cache com quota global, tamanho lógico e limpeza restrita a pastas gerenciadas inativas.
- Tipografia e densidade ajustadas, Home mais curta, navegação preservada, carrossel pausável e diálogos acessíveis.
- Player com velocidade, atalhos, seleção de faixas oferecidas pela mídia e nova tentativa preservando o ponto.

## Evidências de validação

37 testes frontend e 20 testes Rust passaram. Dois testes de provedores externos permanecem ignorados por dependerem de serviços live. TypeScript, Vite e build Tauri release, MSI e NSIS passaram.

O teste de torrent cobre transferência efetiva de peças de um peer local após preparação sem arquivos selecionados, Range, seek, token privado e interrupção. Um teste anterior tentou escrever dados depois da inicialização sem verificar peças; essa fixture não representa transferência válida e foi substituída pela cobertura com peer local.

Na interface foram conferidos: persistência de preferências, foco da busca, lista/status/filtros, tradução PT-BR, progresso manual e retomada do episódio 200, backup exportado e importado, episódios 1–15/16–30, busca global por 200 e novidades de cinco dias atrás. Temporada avançou de Outono 2026 para Inverno 2027. Agenda mostrou America/Bahia e horários locais. Conteúdo adulto foi excluído da agenda, em conformidade com as demais coleções padrão.

Layout inspecionado com viewport de 800×600, 1366×768 e 1920×1080; scrollWidth igual ao clientWidth, sem overflow horizontal. A barra de rolagem reduz a área útil em 15 px. Override temporário de viewport restaurado. A fixture Naruto e seu progresso de teste foram removidos; preferências de teste restauradas. Dados anteriores preservados.

## Entrega e limites

Arquivos novos na área de trabalho: AniBR-0.3.0-Melhorias.exe, AniBR-0.3.0-Melhorias-Setup.exe e AniBR-0.3.0-Melhorias.msi. Cópias verificadas por SHA-256. Executável com ProductVersion 0.3.0. Versões anteriores preservadas.

Nesta rodada não foi executada instalação nem reprodução de vídeo público no WebView2. Transferência local não comprova codecs ou disponibilidade das fontes públicas. Faixas aparecem somente se a mídia oferecer; notificações dependem do app aberto; tradução depende do serviço MyMemory. HLS é carregado sob demanda e seu chunk continua acima do aviso de 500 kB do Vite.

Sincronização entre dispositivos continua fora do escopo, conforme a análise inicial. Não houve commit, publicação ou modificação de serviços externos.
