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

# Copy everything except the jsx folder (we'll build host.jsx separately)
rsync -a --delete \
    --exclude="jsx/" \
    "$SRC/" "$DEST/"

# Build a single host.jsx by concatenating lib files + interface functions.
# This avoids any #include path-resolution issues in AE's CEP loader.
mkdir -p "$DEST/jsx"

echo "Building jsx/host.jsx from lib files..."

cat \
    "$SRC/jsx/lib/naming.jsx" \
    "$SRC/jsx/lib/layer-utils.jsx" \
    "$SRC/jsx/lib/apply-change.jsx" \
    "$SRC/jsx/lib/apply-video.jsx" \
    "$SRC/jsx/lib/apply-media.jsx" \
    "$SRC/jsx/lib/apply-emoji.jsx" \
    "$SRC/jsx/lib/render.jsx" \
    "$SRC/jsx/lib/clean.jsx" \
    "$SRC/jsx/lib/collect.jsx" \
    "$SRC/jsx/lib/project.jsx" \
    > "$DEST/jsx/host.jsx"

# Append interface functions from host.jsx, skipping the #include lines
grep -v "^#include" "$SRC/jsx/host.jsx" >> "$DEST/jsx/host.jsx"

echo "Done. Restart After Effects and open Window > Extensions > AE Iterations."
