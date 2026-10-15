# Arquitetura proposta para o desktop Rust

O repositório deve manter três limites claros:

```text
frontend/  -> janela, navegação, estado de tela e chamadas ao backend
backend/   -> domínio, provedores, SQLite, configuração e integração com player
content/   -> textos, catálogo de demonstração, assets e documentação
```

## Contrato entre frontend e backend

O frontend não acessa SQLite, rede ou processos diretamente. Ele chama comandos tipados do backend, que devolvem estruturas serializáveis: `Anime`, `Season`, `Episode`, `StreamSource`, `Favorite` e `HistoryEntry`. Os nomes JSON existentes em Go devem ser preservados durante a migração para permitir testes por fixture e uma transição incremental.

Fluxo principal:

```text
Tela -> comando Rust -> serviço -> provider/repository -> DTO JSON -> estado da tela
```

Para uma aplicação leve no Windows, Tauri é uma opção natural: frontend web empacotado, comandos Rust e instalador `.exe`. O núcleo Rust deve permanecer independente do framework para continuar testável sem abrir uma janela.

## Responsabilidades

- Frontend: acessibilidade, loading/erro/vazio, seleção e apresentação.
- Backend: validação, concorrência, cache, persistência, scraping e abertura segura do player.
- Content: idioma, dados offline e assets imutáveis; nenhuma regra de negócio.

O backend deve considerar todo HTML de provedor e toda URL de stream como entrada não confiável. Segredos, cookies e tokens não entram em `content/` nem no repositório.
