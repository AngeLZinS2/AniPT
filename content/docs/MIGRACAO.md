# Desenvolvimento do desktop Rust e continuidade da CLI Go

O projeto mantém **desktop e CLI** como formas de uso do AniBR. As etapas abaixo registram o planejamento da implementação desktop; não representam descontinuação da CLI.

## Ordem recomendada

1. Congelar os contratos JSON atuais e usar `catalog.demo.json` como fixture.
2. Criar structs Rust com `serde`, preservando os nomes e valores (`dublado`, `legendado`, qualidades e status).
3. Portar configuração, SQLite e repositórios; criar testes de migração do banco existente.
4. Portar a interface `Provider` e primeiro implementar o provider `mock`.
5. Expor comandos para busca, detalhes, temporadas, episódios, favoritos, histórico e configurações.
6. Construir as telas usando somente o mock; depois conectar AnimeFire, Goyabu e o agregador.
7. Integrar mpv/VLC e empacotar o `.exe`; manter mensagens claras quando o player estiver ausente.
8. Preservar a CLI Go como forma de uso paralela, com compilação e documentação próprias.

## Compatibilidade de dados

- Ler o `config.yaml` legado uma vez e gravar a nova configuração no diretório de dados da aplicação.
- Reutilizar o SQLite legado por migração versionada, nunca alterando tabelas silenciosamente.
- Manter timestamps em RFC 3339 e duração/posição em segundos.
- IDs de provider são opacos; não inferir significado no frontend.
- Antes de migrar, criar cópia do banco e oferecer recuperação em caso de falha.

## Critério de paridade

Busca, catálogo, detalhes, temporadas, episódios, idioma, qualidade, favoritos, histórico, continuar assistindo, cache, configurações e abertura do player orientam a implementação desktop. A CLI continua disponível independentemente da paridade entre as interfaces.
