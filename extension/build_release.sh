#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_ROOT="${1:-$ROOT_DIR/release}"
EXT_NAME="${2:-my-extension}"
ICON_SOURCE="${ICON_SOURCE:-Assets/trace-pilot_icon2.png}"

STAGE_DIR="$OUT_ROOT/$EXT_NAME"
ZIP_PATH="$OUT_ROOT/$EXT_NAME.zip"

require_file() {
  local path="$1"
  if [[ ! -f "$path" ]]; then
    echo "Missing file: $path" >&2
    exit 1
  fi
}

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing command: $cmd" >&2
    exit 1
  fi
}

require_cmd node
require_cmd zip
require_file "$ROOT_DIR/manifest.json"
require_file "$ROOT_DIR/$ICON_SOURCE"

if [[ ! -d "$ROOT_DIR/dist" ]]; then
  echo "Missing directory: $ROOT_DIR/dist" >&2
  echo "Build the extension before packaging." >&2
  exit 1
fi

mkdir -p "$OUT_ROOT"
rm -rf "$STAGE_DIR"
mkdir -p "$STAGE_DIR/icons"

cp "$ROOT_DIR/manifest.json" "$STAGE_DIR/manifest.json"
cp -R "$ROOT_DIR/dist" "$STAGE_DIR/dist"

for size in 16 32 48 128; do
  cp "$ROOT_DIR/$ICON_SOURCE" "$STAGE_DIR/icons/icon${size}.png"
done

if [[ -f "$ROOT_DIR/popup.html" ]]; then
  cp "$ROOT_DIR/popup.html" "$STAGE_DIR/popup.html"
fi

STAGE_MANIFEST="$STAGE_DIR/manifest.json" node <<'EOF'
const fs = require("fs");

const manifestPath = process.env.STAGE_MANIFEST;
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const icons = {
  16: "icons/icon16.png",
  32: "icons/icon32.png",
  48: "icons/icon48.png",
  128: "icons/icon128.png",
};

manifest.icons = icons;
manifest.action = manifest.action || {};
manifest.action.default_icon = icons;

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
EOF

rm -f "$ZIP_PATH"
(
  cd "$OUT_ROOT"
  zip -qr "$(basename "$ZIP_PATH")" "$EXT_NAME"
)

echo "Created package directory: $STAGE_DIR"
echo "Created zip: $ZIP_PATH"
