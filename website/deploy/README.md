# Publicação na VPS

Endereço público: http://173.212.251.120:8085/

Projeto isolado em `/opt/anibr-site`, contêiner `anibr-site`, Docker Compose com nome de projeto `anibr-site`. A imagem Nginx é fixada pelo digest disponível na VPS. Os arquivos ficam somente para leitura no contêiner; `/tmp` usa memória temporária. Reinício automático e verificação de saúde estão configurados. A porta externa 8085 encaminha para 8080 dentro do contêiner.

O vídeo mantém a capa Olá e inicia automaticamente, silencioso e dentro da página. Se o navegador bloquear o autoplay, o botão de reprodução continua disponível. Nginx serve MP4 com intervalos HTTP para avançar no vídeo, legendas como `text/vtt` e o instalador como download.

## Atualizar

Os instaladores não são versionados no Git. Antes de publicar a partir de um clone, coloque o instalador e o ZIP portátil em `website/dist/downloads/`. Para reutilizar a versão pública 0.3.5 e conferir os hashes no PowerShell:

```powershell
$downloads = 'website/dist/downloads'
$publicBase = 'http://173.212.251.120:8085/downloads'
$files = @('AniBR-0.3.5-Setup.exe', 'AniBR-0.3.5-Portable.zip')
foreach ($file in $files) {
    Invoke-WebRequest "$publicBase/$file" -OutFile "$downloads/$file"
}
Get-Content "$downloads/SHA256SUMS.txt" | ForEach-Object {
    $expected, $file = $_ -split '  ', 2
    $actual = (Get-FileHash -LiteralPath "$downloads/$file" -Algorithm SHA256).Hash
    if ($actual.ToLowerInvariant() -ne $expected) { throw "SHA-256 divergente: $file" }
}
```

Também é possível gerar novos pacotes com `npm run build`, preparar o ZIP portátil e atualizar os nomes e hashes antes da publicação. Preserve as licenças que acompanham a distribuição. A prévia local do site funciona sem os instaladores, mas seus links de download precisam desses arquivos para responder.

Os comandos abaixo partem da raiz deste workspace no PowerShell. A conexão usa o alias SSH existente `playdb`; nenhuma credencial é incluída nos arquivos do projeto.

```powershell
$release = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
New-Item -ItemType Directory -Force .media-work | Out-Null
tar -czf .media-work/anibr-vps-site.tar.gz -C website/dist .
scp .media-work/anibr-vps-site.tar.gz website/deploy/compose.yaml website/deploy/nginx.conf website/deploy/activate-release.sh playdb:/opt/anibr-site/incoming/
ssh playdb "bash /opt/anibr-site/incoming/activate-release.sh $release"
```

Interrompa o procedimento se qualquer comando falhar. O ativador valida Nginx antes de publicar, preserva releases anteriores e salva a configuração anterior em `backups/<release>/`. Só o serviço AniBR é recriado.

## Consultar

```sh
docker compose --project-name anibr-site --project-directory /opt/anibr-site -f /opt/anibr-site/compose.yaml ps
docker logs --tail 50 anibr-site
readlink -f /opt/anibr-site/current
```

Para reverter, recupere o caminho anterior em `backups/<release>/previous-release.txt`, restaure as cópias de configuração desse mesmo backup e aponte `current` para a release anterior; recrie apenas o projeto `anibr-site` com `up -d --force-recreate --wait`. Os arquivos e serviços dos outros aplicativos ficam fora desta pasta e deste projeto.
