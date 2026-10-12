#!/usr/bin/env bash
# Runs a command inside the official Playwright image (browsers + system libraries included),
# with the repo mounted. Useful where Playwright's system dependencies cannot be installed (e.g. WSL
# without sudo). Example: tools/in-playwright-docker.sh pnpm --dir packages/freegrid test:e2e
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/packages/freegrid/node_modules/playwright/package.json').version")"
exec docker run --rm --ipc=host -u "$(id -u):$(id -g)" -e HOME=/tmp -e CI=1 \
  -v "$ROOT":"$ROOT" -w "$PWD" "mcr.microsoft.com/playwright:v${VERSION}-noble" \
  bash -c 'corepack enable --install-directory /tmp/bin >/dev/null 2>&1 || true; export PATH=/tmp/bin:$PATH; "$@"' _ "$@"
