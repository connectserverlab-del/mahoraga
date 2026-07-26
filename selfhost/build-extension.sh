#!/usr/bin/env bash
# Build the Mahoraga agent extension and stage it for the self-host container.
# Requires bun (https://bun.sh). Run from anywhere; output lands in selfhost/extension/.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/packages/mahoraga-agent/apps/app"
OUT_DIR="$REPO_ROOT/selfhost/extension"

command -v bun >/dev/null || { echo "bun is required: https://bun.sh"; exit 1; }

echo "Installing workspace dependencies..."
(cd "$REPO_ROOT/packages/mahoraga-agent" && bun install)

echo "Building extension..."
(cd "$APP_DIR" && bun run build)

BUILD_OUT="$(find "$APP_DIR/.output" -maxdepth 1 -type d -name 'chrome-mv3*' | head -1)"
[ -n "$BUILD_OUT" ] || { echo "Build output not found under $APP_DIR/.output"; exit 1; }

rm -rf "$OUT_DIR"
cp -r "$BUILD_OUT" "$OUT_DIR"
echo "Extension staged at $OUT_DIR"
echo "Now run: docker compose up -d (from the selfhost/ directory)"
