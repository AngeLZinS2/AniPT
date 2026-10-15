---
workflow: product-launch-video
flow: automation
storyboard: no
message: "AniBR reúne descoberta de animes, episódios e sua organização pessoal em um app desktop em português."
destination: website embed
aspect: 1920x1080
language: pt-BR
length: 30s
angle: product showcase with real app screens
narration: no
---

## Intent
Pedido: criar página/site de apresentação em HTML/CSS com vídeo mostrando o AniBR; usuário autorizou HyperFrames para edição. Mostrar a interface real, sem inventar um player em reprodução ou recursos. Manter identidade roxa e ícone original. Página responsiva com demonstração e download da versão Windows existente.

## Decisions and receipts
- Página e vídeo do app: pedido atual.
- PT-BR: idioma da conversa e produto.
- 16:9/1080p: vídeo incorporado no site e preferência por qualidade HD na conversa.
- Cerca de 30 segundos: decisão de edição para uma demonstração curta com cinco cenas.
- Fluxo autônomo e sem revisão de storyboard: orientação persistente de executar as melhorias e conduzir implementação.
- Edição silenciosa, textos na tela: decisão para vídeo incorporado sem reprodução sonora automática. Sem voz ou trilha requerida.
- Prévia final antes de exportar: gate explícito de HyperFrames; apresentar resultado concreto antes de perguntar.

## Assets
Usar capturas reais do aplicativo local, ícone frontend/public/anibr-icon.png e somente dados de catálogo públicos. Não mostrar URLs privadas, caminhos da pessoa ou configurações de fontes. Preservar perfil, favoritos e histórico. Sem modelos inventados nem depoimentos/estatísticas.

## Website
Pasta website/dist, HTML/CSS/JS sem framework. Site privado registrado com ID em website/.openai/hosting.json. CTA demonstração, download real do Setup compilado e GitHub do projeto. Página não promete disponibilidade de vídeo ou resolução ausente nas fontes.

## Aprovação de entrega
Em 15/10/2026 o usuário aprovou exportar o vídeo e concluir o site. Em seguida escolheu a imagem `assets/intro-ola.png` para a introdução e capa. Captura fornecida pelo próprio usuário; nenhuma identificação pessoal inserida.
