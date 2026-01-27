#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ts-node を ESM loader として使って .ts を実行
node --loader ts-node/esm ./tools/gen_fixtures.ts
