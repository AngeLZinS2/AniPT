#!/usr/bin/env bash
set -euo pipefail

base=/opt/anibr-site
release=${1:?Informe o identificador da release}
[[ "$release" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || exit 2
target="$base/releases/$release"
image=nginx@sha256:72ba65eb42c10344912a84ff42408db7d34f2feb642204570ab8fc5ffd29f1d3

test ! -e "$target"
test ! -e "$base/current" || test -L "$base/current"
mkdir "$target"
tar -xzf "$base/incoming/anibr-vps-site.tar.gz" -C "$target"
test -s "$target/index.html"
test -s "$target/assets/anibr-showcase.mp4"
test -s "$target/downloads/SHA256SUMS.txt"
(cd "$target/downloads" && sha256sum --check SHA256SUMS.txt)

# Validate the new release before changing the running service.
docker run --rm --network none --user 101:101 --read-only --cap-drop ALL \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m,mode=1777 \
  --mount "type=bind,src=$target,dst=/usr/share/nginx/html,readonly" \
  --mount "type=bind,src=$base/incoming/nginx.conf,dst=/etc/nginx/nginx.conf,readonly" \
  --entrypoint nginx "$image" -t

backup="$base/backups/$release"
mkdir -p "$backup"
for config in compose.yaml nginx.conf; do
  if test -f "$base/$config"; then cp -p "$base/$config" "$backup/$config"; fi
done
if test -L "$base/current"; then readlink "$base/current" > "$backup/previous-release.txt"; fi

install -m 644 "$base/incoming/compose.yaml" "$base/compose.yaml"
install -m 644 "$base/incoming/nginx.conf" "$base/nginx.conf"
ln -s "$target" "$base/current-$release"
mv -Tf "$base/current-$release" "$base/current"
docker compose --project-name anibr-site --project-directory "$base" -f "$base/compose.yaml" config --quiet
docker compose --project-name anibr-site --project-directory "$base" -f "$base/compose.yaml" up -d --force-recreate --wait --wait-timeout 60
sha256sum "$target/assets/anibr-showcase.mp4"
cat "$target/downloads/SHA256SUMS.txt"
docker compose --project-name anibr-site --project-directory "$base" -f "$base/compose.yaml" ps
