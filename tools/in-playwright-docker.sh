#!/usr/bin/env bash
# Runs a command inside the Playwright image (browsers + system libraries + DejaVu fonts), with the
# repo mounted. Useful where Playwright's system dependencies cannot be installed (e.g. WSL without
# sudo). Example: tools/in-playwright-docker.sh pnpm --dir packages/sheet test:e2e
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/packages/sheet/node_modules/playwright/package.json').version")"
PNPM="$(node -p "require('$ROOT/package.json').packageManager")"
# The image has the Playwright and pnpm versions in its tag: a new version builds a new image (once).
IMAGE="freesheet-playwright:${VERSION}-${PNPM//[@+]/-}"
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  docker build -q --build-arg PLAYWRIGHT_VERSION="$VERSION" --build-arg PNPM="$PNPM" -t "$IMAGE" \
    -f "$ROOT/tools/playwright.Dockerfile" "$ROOT/tools" >/dev/null
fi
exec docker run --rm --ipc=host -u "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 -e PNPM="$PNPM" \
  -v "$ROOT":"$ROOT" -w "$PWD" "$IMAGE" \
  bash -c 'if ! command -v pnpm >/dev/null; then npm install -g --silent --prefix /tmp/pnpm "$PNPM" >/dev/null; export PATH=/tmp/pnpm/bin:$PATH; fi; "$@"' _ "$@"
