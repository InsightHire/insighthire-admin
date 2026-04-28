#!/usr/bin/env bash
set -euo pipefail
BASELINE_FILE="$(dirname "$0")/../.tsc-baseline"
if [[ ! -f "$BASELINE_FILE" ]]; then
  echo "No tsc baseline found at $BASELINE_FILE — run 'npm run tsc:baseline:save' first."
  exit 1
fi
BASELINE=$(cat "$BASELINE_FILE" | tr -d '[:space:]')
CURRENT=$(npx tsc --noEmit 2>&1 | grep -cE "error TS" || true)
echo "tsc errors: current=$CURRENT  baseline=$BASELINE"
if [[ "$CURRENT" -gt "$BASELINE" ]]; then
  echo "❌ FAIL: tsc error count increased ($BASELINE → $CURRENT)."
  exit 1
fi
if [[ "$CURRENT" -lt "$BASELINE" ]]; then
  echo "✅ tsc error count DECREASED ($BASELINE → $CURRENT). Run 'npm run tsc:baseline:save' to lock in."
fi
exit 0
