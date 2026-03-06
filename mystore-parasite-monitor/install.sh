#!/bin/bash
# Umbrel calls this script before starting the app containers.
# We use it to copy server.js and the public/ folder into APP_DATA_DIR/app
# so the node:18-alpine container can find them at /app/server.js

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="${APP_DATA_DIR}/app"

mkdir -p "$DEST/public"

cp "$SCRIPT_DIR/server.js"           "$DEST/server.js"
cp "$SCRIPT_DIR/public/index.html"   "$DEST/public/index.html"

echo "Parasite Monitor: app files copied to $DEST"
