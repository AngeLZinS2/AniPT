---
format: 1920x1080
duration: 30s
message: "Descubra novas histórias e acompanhe seus animes do seu jeito no AniBR."
arc: "Desejo → Descoberta → Escolha → Confiança → Convite"
audience: fãs de anime no Windows
mode: autonomous
music: none
---

## Video direction
Mostre a interface real capturada em sessão isolada, sem simular reprodução ou inventar dados. Dark mode #0c0b10, texto #f4f1fa, roxo #8955ff e Manrope local. Cinco cenas distintas, sem narração, música ou SFX. A cópia grande explica o benefício; a captura comprova. Câmera baseada no componente de registro ui-focus-zoom, com uma aproximação suave por tela e contenção abaixo de 1:1 dos pixels da captura. A entrada e a saída usam a mesma direção, sem saltos ou elementos que se teletransportam. Fundos em clipes próprios, não na raiz. Sem shader ou efeito de pós-produção sobre as imagens.

## Frame 1 — Olá, AniBR
- scene: Captura Olá fornecida e escolhida pelo usuário, em janela ampla, com o título Seu universo de animes.
- duration: 4s
- transition_in: cut
- status: animated
- src: compositions/frames/01-intro.html
- poster: 2s
- narrativeRole: Abre com o desejo de descobrir sua próxima história.
- asset_candidates: assets/intro-ola.png

0.45–1.2s: entra o título Seu universo de animes. 1.15–1.75s: aparece Conheça o AniBR para Windows. 1.35–2.35s: a captura Olá fornecida pelo usuário se acomoda, em proporção integral, sem reconstruir o conteúdo. 2.35–4s: leitura estável antes da descoberta do catálogo.

## Frame 2 — Descubra seu próximo anime
- scene: Catálogo real com capas e filtros em uma janela ampla.
- duration: 7s
- transition_in: crossfade
- status: animated
- src: compositions/frames/02-discover.html
- poster: 3.5s
- narrativeRole: Prova como encontrar uma obra por interesse e temporada.
- asset_candidates: capture/assets/catalog.jpg

0–0.8s: título “Encontre o anime do seu momento.” e janela se acomodam. 1.1–3.1s: câmera segue a lei do ui-focus-zoom, passando de escala 1 para 1.06, ancorada no topo de filtros. 3.2–4.2s: rótulos editoriais “Gênero”, “Temporada” e “Formato” entram em cadência, fora dos pixels da captura. 4.2–7s: leitura estável. Não simular cliques que não tenham uma captura de resultado.

## Frame 3 — Da escolha ao próximo episódio
- scene: Página real de detalhes com trailer, temporadas e lista de episódios.
- duration: 7s
- transition_in: crossfade
- status: animated
- src: compositions/frames/03-episodes.html
- poster: 4.8s
- narrativeRole: Reúne contexto da obra e organização dos episódios na mesma história.
- asset_candidates: capture/assets/details-full.jpg

0–0.8s: título “Conheça a obra. Escolha o episódio.” e captura da página completa. 0.8–2.1s: visão do topo com sinopse e trailer. 2.1–4.6s: pan vertical contínuo de 0 a -1020px na captura dentro de uma janela recortada, chegando à seção real Temporadas e episódios. 4.7–5.4s: rótulo “Até 15 episódios por página” entra como anotação editorial. 5.4–7s: mantém a lista legível. Não afirmar vídeo em reprodução.

## Frame 4 — Comece do seu jeito
- scene: Entrada real com nome opcional e continuação anônima.
- duration: 6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/04-local.html
- poster: 3.5s
- narrativeRole: Mostra autonomia e armazenamento local sem cadastro obrigatório.
- asset_candidates: capture/assets/onboarding.jpg

0–0.8s: título “Sem conta obrigatória.” à esquerda e captura à direita. 1.1–2.2s: câmera aproxima o formulário real de maneira suave, sem distorcer seus pixels. 2.4–3.2s: linha “Nome opcional. Dados pessoais locais.” aparece abaixo do título. 3.2–6s: mantém o estado legível. Nenhum nome pessoal é introduzido ou inventado.

## Frame 5 — Sua próxima história começa aqui
- scene: Ícone original, nome AniBR e convite para Windows.
- duration: 6s
- transition_in: crossfade
- status: animated
- src: compositions/frames/05-outro.html
- poster: 3.5s
- narrativeRole: Fecha com a marca e um próximo passo concreto.
- asset_candidates: assets/anibr-icon.png

0–0.9s: ícone e marca se acomodam em uma composição central. 0.5–1.4s: frase “Sua próxima história começa aqui.” se revela por linhas. 1.8–2.6s: “AniBR para Windows” e “Em português. Do seu jeito.” entram. 2.6–6s: hold estável; a última imagem contém a marca e o convite, sem fade para preto.
