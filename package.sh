#!/bin/bash
# Creates a distributable zip of the AE Iterations extension.
# Output: AE-Iterations.zip in the same folder as this script.
# Recipient: unzip anywhere, then run:  bash install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/extension"
BUILD_DIR="$SCRIPT_DIR/.package-build"
EXT_DIR="$BUILD_DIR/com.aeiter.iteration"
OUT="$SCRIPT_DIR/AE-Iterations.zip"

echo "Building extension..."

# ── 1. Clean build dir ───────────────────────────────────────────────────────
rm -rf "$BUILD_DIR"
mkdir -p "$EXT_DIR/jsx"

# ── 2. Copy non-jsx assets ───────────────────────────────────────────────────
rsync -a --exclude="jsx/" "$SRC/" "$EXT_DIR/"

# ── 3. Concatenate host.jsx (same logic as install.sh) ───────────────────────
cat \
    "$SRC/jsx/lib/naming.jsx" \
    "$SRC/jsx/lib/layer-utils.jsx" \
    "$SRC/jsx/lib/apply-change.jsx" \
    "$SRC/jsx/lib/render.jsx" \
    "$SRC/jsx/lib/collect.jsx" \
    "$SRC/jsx/lib/project.jsx" \
    > "$EXT_DIR/jsx/host.jsx"

grep -v "^#include" "$SRC/jsx/host.jsx" >> "$EXT_DIR/jsx/host.jsx"

# ── 4. Write README.txt ──────────────────────────────────────────────────────
cat > "$BUILD_DIR/README.txt" << 'EOF'
╔══════════════════════════════════════════════════════╗
║           AE Iterations — Installation               ║
╚══════════════════════════════════════════════════════╝

OPTION A — Automatic (recommended)
────────────────────────────────────────────────────────
1. Quit After Effects.
2. Open Terminal, drag install.sh into it, press Enter.
3. Reopen After Effects.
4. Window > Extensions > AE Iterations

OPTION B — Manual
────────────────────────────────────────────────────────
1. Quit After Effects.
2. Copy the folder  com.aeiter.iteration  to:

   ~/Library/Application Support/Adobe/CEP/extensions/

   (create the "extensions" folder if it does not exist)

3. Enable unsigned extensions — run this once in Terminal:

   defaults write com.adobe.CSXS.11 PlayerDebugMode 1

   (use CSXS.12 if you are on After Effects 27)

4. Reopen After Effects.
5. Window > Extensions > AE Iterations

────────────────────────────────────────────────────────
Tested on After Effects 26 (macOS).
EOF

# ── 5. Write a self-contained install.sh into the zip ────────────────────────
cat > "$BUILD_DIR/install.sh" << 'EOF'
#!/bin/bash
# Installs AE Iterations CEP extension.
# Quit After Effects before running, then reopen it.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.aeiter.iteration"

echo "Installing to: $DEST"
rsync -a --delete "$SCRIPT_DIR/com.aeiter.iteration/" "$DEST/"

# Enable unsigned extensions (only needed once per machine)
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1

echo "Done. Restart After Effects and open Window > Extensions > AE Iterations."
EOF
chmod +x "$BUILD_DIR/install.sh"

# ── 5. Zip ───────────────────────────────────────────────────────────────────
rm -f "$OUT"
cd "$BUILD_DIR"
zip -r "$OUT" . --exclude="*.DS_Store"
cd "$SCRIPT_DIR"

# ── 6. Clean up ──────────────────────────────────────────────────────────────
rm -rf "$BUILD_DIR"

SIZE=$(du -sh "$OUT" | cut -f1)
echo ""
echo "Done → AE-Iterations.zip  ($SIZE)"
echo "Share the zip. Recipient: unzip it, then run  bash install.sh"
