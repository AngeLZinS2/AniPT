# Site de apresentação AniBR

Produção pública em 15/10/2026: http://173.212.251.120:8085/ . A versão anterior no Sites permanece privada.

Fonte: website/dist/index.html, style.css e app.js. Vídeo: website/dist/assets/anibr-showcase.mp4. Projeto HyperFrames: videos/anibr-showcase. A capa intro-ola.png é a imagem enviada pelo usuário, preservada integralmente.

30 segundos, 1080p, 30 fps; legendas PT-BR opcionais; sem áudio. Player, abas por teclado, FAQ, links/arquivos e instalador validados. Layout móvel 390 px e desktop 1440 px sem overflow horizontal. HyperFrames: 0 erros/avisos e verificações de execução/layout/contraste aprovadas. Histórico completo e IDs de publicação em WORK_STATUS.md.

Para abrir a fonte local neste workspace: node scripts/serve-anibr-site.mjs. O site estático não precisa de instalação de dependências ou build.

Entrega de revisão: a hospedagem privada exige login no ChatGPT; publicação confirmada como succeeded pelo serviço. A prévia local temporária do site e a origem isolada de captura foram encerradas; o Studio HyperFrames fica aberto para edição. Código HTML/CSS e MP4 locais permanecem acessíveis sem depender da hospedagem.

## VPS e autoplay — 15/10/2026

Publicado em /opt/anibr-site via usuário deploy, projeto Docker Compose anibr-site, contêiner anibr-site, porta 8085 para 8080 interno. Release final 20261015T112433Z; primeira release 20261015T112025Z retida. Nginx fixado por digest, conteúdo somente leitura, processo sem root/capabilities, restart e healthcheck. Nenhuma regra de firewall ou outro serviço foi alterado.

HTTP externo: página/assets/MP4/instalador 200, Range MP4 206 com 1024 bytes corretos, legendas text/vtt e arquivo inexistente 404. Hashes do vídeo e instalador conferidos na VPS. Contêiner saudável; serviços anteriores mantiveram seus tempos de execução. Autoplay + muted + playsinline e fallback manual publicados. Navegador confirmou reprodução automática sem interação, 1920×1080, 30 s, paused=false, muted=true, erro nulo e botão sobreposto oculto. Operação e recuperação: website/deploy/README.md.

## Atualização 0.3.1

Release pública 20261015T130804Z: guia em #fontes, instalador e ZIP portátil em #download, com tamanhos e hashes conferidos externamente. O guia usa a lista de addons fornecida pelo usuário e explica o link do manifesto, o formulário do app e o diagnóstico. ZIP acompanha instruções, não contém perfil/addons pessoais. Autoplay silencioso preservado. Histórico de testes e hashes em WORK_STATUS.md.
