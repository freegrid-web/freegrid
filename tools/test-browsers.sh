#!/usr/bin/env bash
# Runs the browser suites at once, each in its own Playwright container (see in-playwright-docker.sh): Chromium,
# the minified build, Firefox, WebKit and Walkontable. The specs are bundled once first (`pnpm build` first when
# src/ changed: the suites run against dist/). Prints one line per suite; fails when one of them fails.
# Logs: $FREESHEET_TEST_LOGS (default /tmp/freesheet-browsers).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="${FREESHEET_TEST_LOGS:-/tmp/freesheet-browsers}"
cd "$ROOT/packages/sheet"
mkdir -p "$LOGS"

node build/build-tests.js e2e >/dev/null && node build/build-tests.js walkontable >/dev/null || exit 1

run() {
  local name=$1
  shift
  "$ROOT/tools/in-playwright-docker.sh" bash -c "$*" >"$LOGS/$name.log" 2>&1
  echo $? >"$LOGS/$name.code"
}

run e2e 'node test/runner/run.js --suite e2e --build dev; node ../../tools/compare-baseline.mjs e2e test-results/e2e-dev-chromium.json' &
run e2e-min 'node test/runner/run.js --suite e2e --build min; node ../../tools/compare-baseline.mjs production test-results/e2e-min-chromium.json' &
run firefox 'node test/runner/run.js --suite e2e --browser firefox; node ../../tools/check-known-failures.mjs firefox test-results/e2e-dev-firefox.json' &
run webkit 'node test/runner/run.js --suite e2e --browser webkit; node ../../tools/check-known-failures.mjs webkit test-results/e2e-dev-webkit.json' &
run walkontable 'node test/runner/run.js --suite walkontable; node ../../tools/compare-baseline.mjs walkontable test-results/walkontable-dev-chromium.json' &
wait

status=0
for name in e2e e2e-min firefox webkit walkontable; do
  code=$(cat "$LOGS/$name.code")
  echo "$name: $(grep -E 'specs, ' "$LOGS/$name.log" | tail -1) | $(tail -1 "$LOGS/$name.log")"
  [ "$code" = 0 ] || status=1
done
exit $status
