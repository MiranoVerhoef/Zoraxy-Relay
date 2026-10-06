#!/usr/bin/env bash
set -euo pipefail
out="${1:-dist}"
mkdir -p "$out"
for target in linux/amd64 linux/arm64 linux/arm darwin/amd64 darwin/arm64 windows/amd64 windows/arm64; do
  for pkg in 'zoraxy-relay:.' 'zoraxy-relay-client:./client'; do
    binary="${pkg%%:*}"
    pkgdir="${pkg#*:}"
    output="${binary}_${target%/*}_${target#*/}"
    [[ "$target" == windows/* ]] && output+='.exe'
    CGO_ENABLED=0 GOOS="${target%/*}" GOARCH="${target#*/}" go build -trimpath -ldflags='-s -w' -o "$out/$output" "$pkgdir"
  done
done
node scripts/validate-release.cjs "$out/zoraxy-relay_linux_amd64" "$out/zoraxy-relay-client_linux_amd64" "$out"
