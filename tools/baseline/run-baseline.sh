#!/usr/bin/env bash
set -uo pipefail
git config --global --add safe.directory /repo
git -C /repo archive handsontable-6.2.2 | tar -x -C /hot
cd /hot
npm ci
export NODE_PATH=/hot/node_modules

# Unit (Jest 23)
npx cross-env BABEL_ENV=commonjs npx env-cmd ./hot.config.js jest --json --outputFile=/out/unit.json || true

# Types
if npm run test:types; then echo '"passed"' > /out/types.json; else echo '"failed"' > /out/types.json; fi

# E2E (dev UMD build)
npm run build:umd && npm run build:languages && npm run test:e2e.dump
node /tools/run-puppeteer-json.js test/E2ERunner.html /out/e2e.json || true

# Walkontable
npm run build:walkontable && npm run test:walkontable.dump
node /tools/run-puppeteer-json.js src/3rdparty/walkontable/test/SpecRunner.html /out/walkontable.json || true

# Production (minified UMD build)
npm run build:umd.min && npm run build:languages.min && npm run test:production.dump
node /tools/run-puppeteer-json.js test/E2ERunner.html /out/production.json || true
