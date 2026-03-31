#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_NAME="trace_pilot_host_chrome"
DEFAULT_INSTALL_DIR="${HOME}/.local/share/trace-pilot-host"
DEFAULT_MANIFEST_DIR="${HOME}/.config/google-chrome/NativeMessagingHosts"

usage() {
  cat <<'EOF'
Usage:
  EXTENSION_ID=<chrome-extension-id> ./install.sh
  ./install.sh <chrome-extension-id>

Options via environment variables:
  INSTALL_DIR    Override the host install directory
  MANIFEST_DIR   Override the Native Messaging manifest directory
EOF
}

EXTENSION_ID="${EXTENSION_ID:-${1:-}}"
INSTALL_DIR="${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
MANIFEST_DIR="${MANIFEST_DIR:-$DEFAULT_MANIFEST_DIR}"
HOST_BINARY_SOURCE="$SCRIPT_DIR/native-host"
HOST_BINARY_TARGET="$INSTALL_DIR/native-host"
MANIFEST_PATH="$MANIFEST_DIR/${HOST_NAME}.json"

if [[ -z "$EXTENSION_ID" ]]; then
  usage >&2
  exit 1
fi

if [[ ! -f "$HOST_BINARY_SOURCE" ]]; then
  echo "Missing host binary: $HOST_BINARY_SOURCE" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR" "$MANIFEST_DIR"
install -m 755 "$HOST_BINARY_SOURCE" "$HOST_BINARY_TARGET"

cat > "$MANIFEST_PATH" <<EOF
{
  "name": "$HOST_NAME",
  "description": "Trace Pilot native host",
  "path": "$HOST_BINARY_TARGET",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

cat <<EOF
Installed Trace Pilot native host.

Binary:
  $HOST_BINARY_TARGET

Manifest:
  $MANIFEST_PATH

Allowed origin:
  chrome-extension://$EXTENSION_ID/
EOF
