#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_NAME="${1:-trace-pilot-host-linux-x86_64}"
OUT_ROOT="${2:-$ROOT_DIR/release}"
STAGE_DIR="$OUT_ROOT/$PACKAGE_NAME"
ARCHIVE_PATH="$OUT_ROOT/${PACKAGE_NAME}.tar.gz"

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing command: $cmd" >&2
    exit 1
  fi
}

require_cmd cargo
require_cmd tar

cargo build --release --manifest-path "$ROOT_DIR/Cargo.toml"

rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR"

install -m 755 "$ROOT_DIR/target/release/native-host" "$STAGE_DIR/native-host"
install -m 755 "$ROOT_DIR/release/linux-x86_64/install.sh" "$STAGE_DIR/install.sh"
install -m 644 "$ROOT_DIR/release/linux-x86_64/README.md" "$STAGE_DIR/README.md"

rm -f "$ARCHIVE_PATH"
tar -C "$OUT_ROOT" -czf "$ARCHIVE_PATH" "$PACKAGE_NAME"

echo "Created package directory: $STAGE_DIR"
echo "Created archive: $ARCHIVE_PATH"
