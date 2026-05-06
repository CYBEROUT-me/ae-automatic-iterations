#!/bin/bash
# Installs / updates the AE Iterations CEP extension.
# Run from anywhere: bash install.sh
# Quit After Effects before running, then reopen it.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/extension"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.aeiter.iteration"

echo "Source:      $SRC"
echo "Destination: $DEST"
echo ""

mkdir -p "$DEST"
rsync -a --delete "$SRC/" "$DEST/"

echo "Done. Restart After Effects and open Window > Extensions > AE Iterations."
