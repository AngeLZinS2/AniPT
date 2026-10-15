# Site de apresentação do AniBR

HTML/CSS/JS em dist/, sem build. Página PT-BR responsiva, identidade roxa, recursos reais, FAQ e instalador Windows 64 bits 0.3.1.

Vídeo: dist/assets/anibr-showcase.mp4, H.264, 1920×1080, 30 fps, 30 segundos, sem áudio; legendas opcionais em demo-pt.vtt. A imagem intro-ola.png fornecida pelo usuário é a capa e a abertura do vídeo. Projeto editável HyperFrames: ../videos/anibr-showcase/.

Produção pública na VPS: http://173.212.251.120:8085/ . Serviço e atualização documentados em deploy/README.md. Autoplay silencioso ativado e validado sem clicar em play.

Prévia local a partir da raiz do repositório: `node scripts/serve-anibr-site.mjs` (porta 5180). Os arquivos HTML/CSS/JS em `dist/` são o código-fonte estático deste site e são versionados. Metadados locais de hospedagem e instaladores não acompanham o Git; veja `deploy/README.md` para preparar os downloads.

Validação: HyperFrames sem erros/avisos, runtime/layout/contraste aprovados; reprodução real a 1080p, abas por teclado e FAQ conferidos; 390 px e 1440 px sem rolagem horizontal. Instalador SHA-256: b3c533ec04fa8902771730a6243350b8d62d38485e55fb7ae711f2d59db0ec00.

Fonte Manrope local, licença em dist/assets/Manrope-OFL.txt. Imagens de animes pertencem aos respectivos titulares. Nenhuma telemetria adicionada.

Atualização 0.3.1: instalador e ZIP portátil separados, instruções de extração e guia em #fontes. O guia inclui o catálogo comunitário https://stremio-addons.net/addons?query=anime, adaptação do prefixo stremio:// para https://, caminho Configurações → Fontes instaladas e diagnóstico Testar fonte. Exemplo de URL usa o domínio reservado addon.example. Tamanhos e SHA-256 em dist/downloads/SHA256SUMS.txt; ZIP contém somente AniBR.exe, instruções e licenças, sem dados pessoais.
