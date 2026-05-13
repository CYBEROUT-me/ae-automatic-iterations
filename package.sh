#!/bin/bash
# Bumps version, builds zip, publishes a GitHub release.
#
# Usage:
#   bash package.sh          — auto-increments patch (1.0.0 → 1.0.1)
#   bash package.sh 2.0.0    — set explicit version
#
# Requires GITHUB_TOKEN env var (only the publisher needs this):
#   export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
#   bash package.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/extension"
BUILD_DIR="$SCRIPT_DIR/.package-build"
EXT_DIR="$BUILD_DIR/com.aeiter.iteration"
OUT="$SCRIPT_DIR/AE-Iterations.zip"
REPO="CYBEROUT-me/ae-automatic-iterations"
VERSION_FILE="$SRC/js/version.js"

# ── 1. Bump version ──────────────────────────────────────────────────────────

CURRENT=$(node -e "var fs=require('fs'),m=fs.readFileSync('$VERSION_FILE','utf8').match(/\"([^\"]+)\"/);console.log(m[1])")

if [ -n "$1" ]; then
    NEW_VERSION="$1"
else
    NEW_VERSION=$(node -e "var p='$CURRENT'.split('.');p[2]=parseInt(p[2])+1;console.log(p.join('.'))")
fi

echo "Version: $CURRENT → $NEW_VERSION"

# Update version.js
echo "var AE_ITERATIONS_VERSION = \"$NEW_VERSION\";" > "$VERSION_FILE"

# ── 2. Build extension ───────────────────────────────────────────────────────

echo "Building extension..."

rm -rf "$BUILD_DIR"
mkdir -p "$EXT_DIR/jsx"

rsync -a --exclude="jsx/" "$SRC/" "$EXT_DIR/"

cat \
    "$SRC/jsx/lib/naming.jsx" \
    "$SRC/jsx/lib/layer-utils.jsx" \
    "$SRC/jsx/lib/apply-change.jsx" \
    "$SRC/jsx/lib/render.jsx" \
    "$SRC/jsx/lib/collect.jsx" \
    "$SRC/jsx/lib/project.jsx" \
    > "$EXT_DIR/jsx/host.jsx"

grep -v "^#include" "$SRC/jsx/host.jsx" >> "$EXT_DIR/jsx/host.jsx"

# ── 3. Write install.sh for the zip ─────────────────────────────────────────

cat > "$BUILD_DIR/install.sh" << 'EOF'
#!/bin/bash
# Installs AE Iterations CEP extension.
# Quit After Effects before running, then reopen it.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/com.aeiter.iteration"

echo "Installing to: $DEST"
rsync -a --delete "$SCRIPT_DIR/com.aeiter.iteration/" "$DEST/"

defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1

echo "Done. Restart After Effects and open Window > Extensions > AE Iterations."
EOF
chmod +x "$BUILD_DIR/install.sh"

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

3. Enable unsigned extensions — run once in Terminal:

   defaults write com.adobe.CSXS.11 PlayerDebugMode 1

4. Reopen After Effects → Window > Extensions > AE Iterations

────────────────────────────────────────────────────────
After first install, updates appear inside the panel automatically.
EOF

# ── 4. Zip ───────────────────────────────────────────────────────────────────

rm -f "$OUT"
cd "$BUILD_DIR"
zip -r "$OUT" . --exclude="*.DS_Store"
cd "$SCRIPT_DIR"
rm -rf "$BUILD_DIR"

SIZE=$(du -sh "$OUT" | cut -f1)
echo "Built → AE-Iterations.zip ($SIZE)"

# ── 5. Git commit + tag ──────────────────────────────────────────────────────

git add "$VERSION_FILE" .gitignore 2>/dev/null || true
git commit -m "v$NEW_VERSION"
git tag "v$NEW_VERSION"
git push origin main --tags
echo "Git: pushed v$NEW_VERSION"

# ── 6. GitHub release ────────────────────────────────────────────────────────

if [ -z "$GITHUB_TOKEN" ]; then
    echo ""
    echo "⚠ GITHUB_TOKEN not set — skipping GitHub release."
    echo "  Set it once with:  export GITHUB_TOKEN=ghp_xxxx"
    echo "  Then re-run:       bash package.sh $NEW_VERSION"
    exit 0
fi

echo "Creating GitHub release v$NEW_VERSION..."

RELEASE=$(curl -sf -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.github.com/repos/$REPO/releases" \
    -d "{\"tag_name\":\"v$NEW_VERSION\",\"name\":\"v$NEW_VERSION\",\"body\":\"AE Iterations v$NEW_VERSION\"}")

RELEASE_ID=$(echo "$RELEASE" | node -e "var d='';process.stdin.on('data',function(c){d+=c});process.stdin.on('end',function(){console.log(JSON.parse(d).id)})")

echo "Uploading AE-Iterations.zip..."

curl -sf -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Content-Type: application/zip" \
    --data-binary @"$OUT" \
    "https://uploads.github.com/repos/$REPO/releases/$RELEASE_ID/assets?name=AE-Iterations.zip" > /dev/null

echo ""
echo "✓ Released v$NEW_VERSION → https://github.com/$REPO/releases/tag/v$NEW_VERSION"
echo "  Users with the panel open will see the update banner automatically."
