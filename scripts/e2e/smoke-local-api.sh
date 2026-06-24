#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export E2E_STRICT="${E2E_STRICT:-true}"
node scripts/e2e/run-api-smoke.mjs
