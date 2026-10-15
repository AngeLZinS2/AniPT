# Primeiro acesso — AniBR

Atualizado em 15/10/2026.

A primeira abertura sem perfil local mostra saudação, nome opcional e recepção final. Catálogo e notificações só são consultados após a saída da apresentação. Não existe cadastro nem envio do nome a um serviço.

## Interação e animação

- “Olá.” usa lettering SVG original. O ciclo de 9 segundos escreve, mantém a palavra legível e retrai os mesmos traços na ordem inversa: ponto, acento, a, l e O. Não há fade das letras. Repete enquanto a introdução está aberta.
- Fundo roxo com um mosaico de nove animes revelado dentro de três faixas que seguem o cursor, com inclinações quase horizontal, quase vertical e diagonal. A referência de interação é o capacete de https://landonorris.com/; nenhum modelo ou código daquele site foi reutilizado.
- O A 3D e a versão intermediária com poucos clipes remotos foram substituídos. Three.js não está mais nas dependências.
- Um único vídeo local, sem som, H.264, 1920×1080, 24 fps, aproximadamente 16 segundos e 9,48 MiB. Grade 3×3, um anime diferente por quadro. Oito fontes em 1080p e uma em 720p, todas reduzidas para quadros de 640×360. Início em posição aleatória e transição de meio segundo no fechamento de cada quadro.
- Um único decodificador de vídeo; as três máscaras compartilham o mesmo mosaico. Sem nove players, iframes ou pedidos de mídia remota durante o uso.
- Carrega após a primeira interação. Inatividade recolhe as faixas e pausa. Página oculta pausa; avançar ao formulário ou sair libera vídeo, máscaras, listeners e requestAnimationFrame.
- O pôster local cobre carregamento e falhas. Movimento reduzido mantém a tela Olá com lettering completo e pôster estático, sem decodificar vídeo. Não avança sozinho para o formulário. O botão Ativar animações e mosaico permite habilitar o movimento explicitamente nesta apresentação; o avanço ao nome continua por ação da pessoa.
- Nome opcional e “Continuar sem me identificar”. Home saúda pelo nome quando preenchido. Configurações → Seu perfil local permite editar/apagar o nome e rever a apresentação.
- Teclado, foco contido e campos rotulados. Botão de gradiente adaptado do Uiverse, com licença em UIVERSE_LICENSE.md e public/licenses/uiverse.txt.

## Mídia e reprodução local

Animes do mosaico: Solo Leveling, Frieren, DAN DA DAN, Demon Slayer, Chainsaw Man, Jujutsu Kaisen, Attack on Titan, My Hero Academia e Fate/strange Fake.

O usuário autorizou baixar vídeos do YouTube para montar o mosaico. Oito trailers foram obtidos em canais oficiais (Crunchyroll, Netflix Anime, Aniplex USA, MAPPA, TOHO e Attack on Titan Official), com identidade do canal conferida antes do download. A nona fonte é um clipe promocional do site oficial de Fate/strange Fake. Uma fonte de SPY x FAMILY recusou download HTTP 403 e foi substituída; não houve tentativa de contornar o bloqueio ou usar cookies da pessoa.

Fontes, canais, resoluções, recortes e SHA-256 final: WELCOME_MEDIA_SOURCES.json. Direitos das obras e trailers pertencem aos respectivos titulares; a licença do código não se estende automaticamente a essas mídias.

Arquivos distribuídos: frontend/public/media/welcome-mosaic.mp4 e welcome-mosaic.jpg. Funcionam sem internet. Originais e ferramentas ficam nas pastas ignoradas .media-work/ e .tools/, fora do pacote do app. Preparação reproduzível em scripts/prepare-welcome-mosaic.py, com yt-dlp e imageio-ffmpeg como dependências de preparação. Essas ferramentas não são distribuídas no executável.

## Persistência

Armazenamento local do WebView, chave anibr-local-profile, versão 1. Nome normalizado, limitado a 40 caracteres e renderizado como texto. Conclusão anônima não cria identidade aleatória. Não altera histórico, favoritos, fontes ou preferências existentes. O nome não está no backup atual.

Uma instalação anterior sem essa chave também vê a apresentação uma vez. Reabrir/atualizar mantendo o identificador e dados preserva a conclusão. Apagar os dados do WebView faz a apresentação reaparecer. Se o armazenamento estiver indisponível, a escolha funciona na sessão e a interface informa que não foi persistida.

## Validação

42 testes frontend passaram. Cobrem perfil, falha de armazenamento, geometria vertical/horizontal/diagonal e recolhimento das máscaras. TypeScript/Vite passaram. MP4 decodificado integralmente por FFmpeg sem erro; H.264, 1920×1080 e 24 fps confirmados. Contact sheet de início/meio/fim inspecionada.

Na prévia web: fonte localhost, readyState 4, 1920×1080, muted=true, reprodução real e pausa após inatividade confirmadas. Formulário remove vídeo e clipPath. Viewport 800×600: largura útil e scrollWidth 790 px, sem overflow horizontal. Nome/perfil da pessoa não foi alterado na validação.

Loop SVG conferido com 9 segundos, repetição infinita e opacidade dos traços constante em 1. Evidência: docs/evidencias/primeiro-acesso-faixas.jpg. Validação visual na prévia web; não se afirma inspeção quadro a quadro no WebView2 nativo. Entregas/evidências antigas com A 3D são históricas.

## Correção 0.3.1 — movimento reduzido

Identificada a condição que enviava o primeiro acesso diretamente ao formulário quando o Windows sinalizava movimento reduzido. Removido o avanço automático; a introdução estática permanece com opção explícita de ativar o mosaico e o lettering. A opção afeta somente a apresentação atual. As regras globais de movimento reduzido respeitam essa escolha sem alterar as demais telas.

Validação em origem isolada: modo reduzido permaneceu em hello, sem vídeo, com SVG visível; opt-in mudou para full, iniciou hello-o-loop e carregou welcome-mosaic.mp4 local (readyState 4, 1920×1080, sem erro). Avançar para nome removeu vídeo e clipPath. Perfil pessoal da instalação original não foi alterado. A mídia pública e a cópia em frontend/dist têm o mesmo SHA-256.
