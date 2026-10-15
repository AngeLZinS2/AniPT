# Continuidade — 15/10/2026

Worktree: fenix-season-resolution, baseada em 988f934. Checkout principal tinha alterações preexistentes em README/provider e exclusões de season-number.ts e seu teste; preservadas. Não utilizar o checkout principal para reconstruir esta release sem considerar essas alterações.

Correção Fenix concluída: conversão por vídeo Kitsu para IMDb/temporada/episódio, filtro de coordenadas e detecção de HLS sem extensão. Teste real confirmou mídia diferente da primeira parte. 33 testes Rust + 47 frontend passaram; quatro testes de rede opcionais. Resolvedores Fenix e Nyaa executados ao vivo. CLI Go preservada. Build release/MSI/NSIS 0.3.3 passou. Portátil contém quatro arquivos, EXE idêntico ao release/ProductVersion 0.3.3; vídeo mosaico preservado por hash.

Nyaa Anime BR adicional usa stream/series e IDs IMDb. URL pública sem configuração não funciona: requer link gerado na página /configure. O usuário forneceu seu link configurado, validado e cadastrado localmente sem alterar outras configurações. Não registrar esse token em documentos nem Git. Cinco torrents retornados, quatro S02E01 preservados; disponibilidade de peers e reprodução dos torrents não foram testadas.

HiAnime original continua pendente: manifest org.hianime.streams exige IDs hianime:. Trending e buscas respondem vazio localmente e na VPS. Timeout do host aumentado para 70 s após aviso do usuário sobre atraso de 50 s; reteste com esse orçamento retornou vazio em 1,16 s. Não foi feita conversão por títulos. Necessário serviço fornecer catálogo/metadados/identidade verificável e vídeo para concluir. Não insistir com as mesmas sondagens vazias nem anunciar sucesso de reprodução. Usuário ainda não testou no Stremio.

Publicação 0.3.3 concluída e verificada, release 20261015T162247Z. Consultar final de PROGRESSO_MELHORIAS.md para release/hashes/commit. Agendamento das 13h06 foi executado nesta conversa; não criar duplicatas ou novo horário por conta própria.
