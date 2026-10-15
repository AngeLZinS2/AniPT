# Execução e validação

Com a estrutura Tauri atual:

```powershell
# desenvolvimento
npm install
npm --prefix frontend install
npm run dev

# testes do núcleo Rust
cargo test --manifest-path src-tauri/Cargo.toml

# pacote Windows
npm run build
```

O executável/instalador costuma ser produzido sob `target/release/bundle/`. O pipeline deve validar formatação, lint, testes Rust, build do frontend e leitura dos dois JSONs de `content/` antes do empacotamento.

Para validar rapidamente os arquivos de conteúdo no PowerShell:

```powershell
Get-Content -Raw content/catalog.demo.json | ConvertFrom-Json | Out-Null
Get-Content -Raw content/i18n/pt-BR.json | ConvertFrom-Json | Out-Null
```

O modo de demonstração deve iniciar sem rede, carregar `catalog.demo.json` e nunca gravar alterações nessa fixture.
