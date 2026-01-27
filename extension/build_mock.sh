#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
npx --yes ts-node -P ./tsconfig.node.json ./tools/gen_fixtures.ts
