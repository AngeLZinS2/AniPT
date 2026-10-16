# Validação visual do player

Inicie `npm --prefix frontend run dev` e abra `/tests/player.html` no servidor Vite.
A página utiliza o mesmo módulo de controles e de legendas do aplicativo, com um
MKV sintético local de três minutos (45 KB), sem rede externa ou addons privados.
O arquivo inclui vídeo H.264 e duas faixas ASS (português e inglês), com frases
em 0, 16, 90 e 130 segundos. Não contém cenas de terceiros.

Conferir: PT automático, inglês, desativadas, atraso, tamanho, posição; avançar a
95 s, voltar ao começo, pausar, volume, velocidade, menus e Escape; tela cheia
com menus; cards longos com rolagem e sem sobreposição em 800×560 e desktop.
Fechar o player deve remover canvas, workers e listeners.

O fixture foi gerado com FFmpeg/libx264 e legendas escritas para este teste.
Os testes Node verificam os pacotes reais e índices Cues/CRC32 desse mesmo MKV.
A página não é uma entrada do build de produção e o vídeo não vai no instalador.
