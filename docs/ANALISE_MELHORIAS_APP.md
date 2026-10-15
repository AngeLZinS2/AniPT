# AniBR — análise de melhorias

Data: 14/10/2026.

## Escopo e conclusão

Análise do código atual do frontend TypeScript/CSS e de pontos do backend Rust, com inspeção da Home, detalhes de anime e configurações na interface local do navegador. O player nativo, a decodificação de vídeo, os torrents públicos e o instalador não foram testados nesta análise. Nenhuma funcionalidade do app foi alterada.

O app já apresenta uma identidade visual reconhecível: tema escuro, destaque roxo, imagens grandes, catálogo, favoritos e progresso. A principal oportunidade é tornar o caminho entre descobrir um anime e assistir a um episódio mais confiável. Há controles que prometem comportamentos ainda não implementados e conteúdo que não corresponde ao rótulo da tela. Corrigir essas questões deve preceder uma reformulação visual ampla.

P0 = corrigir antes de ampliar funcionalidades; P1 = próxima evolução; P2 = expansão. Esforço baixo/médio/alto é uma estimativa relativa, sem compromisso de prazo.

## Problemas concretos e prioridades

| Prioridade | Área | Evidência atual | Melhoria | Esforço |
|---|---|---|---|---|
| P0 | Configurações | Os dois checkboxes de comportamento são criados como marcados. Salvar envia somente qualidade e idioma. O evento `ended` não inicia o próximo episódio e `save_progress` grava sem consultar a preferência de histórico. | Persistir e respeitar `auto_next` e `history`; apresentar corretamente os valores salvos. | Médio |
| P0 | Ações | “Quero assistir” não possui ação vinculada. Controles de temporada e abas Hoje/Semana/Mês também não têm comportamento correspondente. | Implementar as ações ou apresentar explicitamente seu estado indisponível. Não exibir um botão ativo que não produz resultado. | Médio |
| P0 | Temporada | `renderSeason` escolhe `feeds.recent` ou `feeds.trending`, sem consultar ano e estação. | Consultar ano/estação de verdade; permitir anterior/próxima e busca local; indicar a temporada usada pelo catálogo japonês. | Médio |
| P0 | Idioma do vídeo | A tela Temporada conta tags contendo “dub” e classifica o restante como legendado. Esses dados vêm de gêneros do catálogo. | Mostrar “Idioma não verificado” até existir evidência das fontes. Nunca inferir legendado pela ausência de dublado. | Médio |
| P0 | Disponibilidade | O app lista episódios exibidos e consulta fontes somente ao assistir; a Home já avisa que o vídeo não foi verificado. | Manter essa distinção e tornar os estados claros: exibido, fonte encontrada, reprodução iniciada, indisponível. Disponibilizar “Verificar fontes” sob demanda, com data da verificação. | Médio |
| P1 | Busca | Depois de 450 ms, a busca chama `render`, que substitui todo o `#app`, incluindo o campo em edição. | Preservar foco, cursor e texto; atualizar só os resultados; descartar respostas antigas; permitir limpar filtros junto da busca. | Médio |
| P1 | Navegação | “Episódios” abre Histórico; o avatar com “A” abre Configurações; “Voltar ao catálogo” sempre leva ao catálogo. | Usar nomes coerentes e ícone de configurações; voltar à tela anterior preservando filtros, página e rolagem. | Médio |
| P1 | Conteúdo | Na inspeção visual, sinopses e gêneros aparecem em inglês. | Traduzir rótulos e gêneros; disponibilizar sinopse PT-BR com procedência e opção de original; preservar títulos conhecidos e permitir título alternativo. | Médio/alto |
| P1 | Relações | “Animes relacionados” usa os primeiros títulos de `currentItems`, que dependem da tela anterior. | Usar relações reais da obra ou renomear para “Outros animes para explorar”. Recomendações por similaridade precisam de regra própria. | Médio |
| P1 | Fontes | Configurações exibem sobretudo URLs; adicionar depende de conhecer um manifest. | Mostrar nome, função (catálogo/episódios/vídeo), compatibilidade, último diagnóstico e ação de testar; esconder tokens em qualquer URL privada. | Médio |
| P1 | Falhas | A Home aguarda histórico, lançamentos e feeds juntos em `Promise.all`; uma falha leva ao erro da página inteira. | Carregar por seção, preservar histórico e dados já obtidos, oferecer nova tentativa localizada e identificar dados em cache. | Médio |
| P1 | Favoritos | A normalização dos itens não hidrata o indicador `favorite` com os favoritos existentes. | Mostrar estado consistente ao reabrir detalhes e permitir adicionar/remover pelo card sem entrar na obra. | Baixo/médio |

## Design e usabilidade

### Legibilidade

Textos de apoio, metadados e badges da Home têm regras de 8–12 px. A inspeção visual confirma que os textos secundários ficam pequenos em relação às imagens. Usar, como ponto de partida, 14–16 px para texto de leitura e 12–14 px para metadados, validando em janelas pequenas e com escala de sistema. Oferecer densidade confortável/compacta.

Preservar o tema escuro e o roxo. Aumentar a hierarquia entre título, descrição e metadados; medir contraste dos cinzas sobre os fundos reais. Há foco visível e suporte CSS a movimento reduzido; essas bases devem ser mantidas.

### Home

“Novos episódios” pode ocupar até 18 cards antes de “Mais populares” e “Em alta”. Mostrar inicialmente 6–8 novidades e permitir expansão ou navegação horizontal. Priorizar retomada para quem tem histórico e descoberta para quem está começando. O banner pode destacar a próxima ação útil: retomar, abrir detalhes ou adicionar à lista.

Os indicadores do carrossel têm apenas 9 px de dimensão visual. Ampliar a área clicável mantendo o ponto pequeno. Oferecer pausa e interromper rotação quando houver foco de teclado; a implementação atual pausa apenas no hover e troca a cada oito segundos.

### Detalhes

Títulos longos ocupam muitas linhas na coluna estreita e são repetidos na área principal. Reduzir a redundância, manter o título completo acessível e limitar a sinopse inicial com “Ler mais”. Tornar “Continuar episódio X — mm:ss” a ação principal quando existir progresso salvo; atualmente o botão principal escolhe o primeiro episódio da lista.

As imagens de episódios reutilizam capa/banner e não comprovam cenas específicas. Usar miniaturas reais quando disponíveis; quando não houver, adotar apresentação neutra identificada pelo episódio, sem sugerir que a imagem é daquela cena.

### Navegação e acessibilidade

Os cards respondem a Enter/Espaço, mas são `article` com `tabindex`; preferir links ou botões com semântica adequada. Os overlays do player e de fontes precisam de nome acessível, semântica de diálogo, foco inicial, contenção do foco e devolução ao controle de origem. Dar aos avisos um anúncio acessível e duração adequada à leitura.

O CSS esconde o submenu Explorar no breakpoint estreito. Como o botão não possui uma ação própria de navegação, revisar acesso ao catálogo/temporada por toque ou teclado nessa largura. Validar a solução visualmente em 800×600, 1366×768, 1920×1080 e com zoom; essa análise não executou toda essa matriz.

### Consistência e manutenção

O frontend importa seis folhas CSS em sequência, incluindo camadas que redefinem os mesmos componentes. Consolidar cores, tipografia, espaçamentos, cantos e estados em tokens; organizar estilos por componente e reduzir sobrescritas. A melhoria tem valor visual e reduz regressões entre Home, detalhes, temporada e player.

## Funcionalidades para evolução

1. **Lista pessoal:** Quero assistir, Assistindo, Concluído, Pausado e Abandonado. Permitir ordenar, buscar e remover itens; diferenciar da seleção de favoritos.
2. **Gestão de progresso:** marcar episódio como visto/não visto, remover item de Continuar assistindo e corrigir progresso manualmente. Ao completar, sugerir o próximo episódio sem repetir o concluído.
3. **Player:** velocidade, atalhos visíveis e menu de legendas/áudio quando a mídia fornecer faixas. Repetir tentativa ou trocar servidor preservando o ponto. Priorizar somente fontes com identidade correta do episódio.
4. **Agenda:** calendário de lançamentos com horário local e indicação de exibição; notificações opcionais para obras acompanhadas, distinguindo exibição de disponibilidade de vídeo.
5. **Cache:** mostrar espaço ocupado por torrents, quota global e limpeza de itens inativos. O limite de 32 GB por arquivo não controla o total armazenado.
6. **Dados pessoais:** exportar/importar favoritos, lista e progresso; limpar histórico por item e informar onde os dados ficam. Sincronização entre dispositivos é uma etapa posterior.
7. **Descoberta:** coleções curadas e recomendações baseadas em gêneros/preferências. Explicar a regra usada, evitar duplicatas e mostrar claramente títulos futuros.

## Conteúdo e comunicação

- Trocar “Estreias confirmadas nas últimas 72 horas” por “Episódios exibidos nas últimas 72 horas”: os itens incluem episódios posteriores ao primeiro.
- Distinguir “Adicionados ao catálogo” de “Lançados recentemente”; novas entradas podem ser obras ainda não lançadas.
- Reduzir a faixa persistente com nomes técnicos do topo; usar esse espaço para estados úteis quando necessário. AniList/Kitsu podem continuar em créditos e detalhes sobre dados.
- Substituir orientações que dependem de uma única fonte por instruções compatíveis com as fontes aceitas. Usar mensagens de erro com ação concreta e diagnóstico técnico expansível.
- Separar no README as instruções do desktop atual e da CLI antiga; alinhar identidade visível AniBR e documentação, preservando identificadores técnicos necessários à continuidade dos dados.

## Ordem recomendada

**Etapa 1 — confiança:** corrigir configurações e ações inativas, temporada real, classificação de idioma e busca sem perda de foco. Critério: cada controle ativo executa a ação anunciada e mantém o estado após reiniciar.

**Etapa 2 — experiência:** tipografia, Home mais curta, retorno à origem, retomada nos detalhes, PT-BR e estados de carregamento/erro por seção. Critério: descobrir, voltar e retomar funciona com clareza, inclusive diante de uma fonte indisponível.

**Etapa 3 — retenção:** lista pessoal, agenda, gestão de progresso/cache e exportação. Critério: a pessoa consegue organizar sua coleção e controlar os dados armazenados.

## Referências no código

- `frontend/src/main.ts`: `shell`, `render`, `startHeroCarousel`, `renderSeason`, `renderRanking`, `renderDetails`, `openPlayer`, `renderSettings`, `bind`.
- `frontend/src/api.ts`: normalização, cache, favoritos, histórico, episódios e persistência de configurações.
- `frontend/src/home-layout.css`: dimensões da Home, textos de apoio, cards e pontos do carrossel.
- `frontend/src/style.css`, `reference.css`, `ui.css`, `detail.css`, `home.css`: camadas visuais, foco, breakpoints e player.
- `src-tauri/src/lib.rs`: comandos de configuração e gravação de progresso.
- `src-tauri/src/config.rs`: campos `auto_next` e `history`.
- `README.md`, `WORK_STATUS.md`: migração, capacidades entregues e limites conhecidos.

Os problemas funcionais acima são sustentados pelo código atual. Sugestões de novas funcionalidades são propostas de produto, não funcionalidades existentes nem resultados de teste de reprodução.
