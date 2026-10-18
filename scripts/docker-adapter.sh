#!/usr/bin/env bash
# Runs docker-adapter natively on macOS so the micro connector container can
# use the Mac's Bluetooth and mDNS. Downloads the binary on first run.
set -euo pipefail

BIN_DIR="$(cd "$(dirname "$0")/.." && pwd)/.docker-adapter"
BIN="$BIN_DIR/docker-adapter"
URL="https://github.com/filipton/docker-adapter/releases/latest/download/docker-adapter-apple-darwin"

if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "docker-adapter is only needed on macOS; Linux uses D-Bus directly." >&2
    exit 1
fi

if [[ ! -x "$BIN" ]]; then
    echo "Downloading docker-adapter..."
    mkdir -p "$BIN_DIR"
    curl --fail --location --progress-bar "$URL" --output "$BIN.tmp"
    chmod +x "$BIN.tmp"
    mv "$BIN.tmp" "$BIN"
fi

exec "$BIN" "$@"
