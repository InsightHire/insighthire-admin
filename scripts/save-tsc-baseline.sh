#!/usr/bin/env bash
set -euo pipefail
BASELINE_FILE="$(dirname "$0")/../.tsc-baseline"
CURRENT=$(npx tsc --noEmit 2>&1 | grep -cE "error TS" || true)
echo "$CURRENT" > "$BASELINE_FILE"
echo "✅ Saved baseline: $CURRENT errors → $BASELINE_FILE"
