# Variable Iteration Count + Windows Auto-Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set any iteration count (instead of fixed 5) for both ITR and VAR modes, and make the in-panel auto-update work on Windows.

**Architecture:** A single `getCount()` helper reads a new `#iter-count` input; every hardcoded `5`-loop in main.js and host.jsx is replaced with it. The Windows update replaces the bash/rsync/`/tmp` approach with a pure Node.js recursive copy + platform-aware extraction.

**Tech Stack:** JavaScript (CEP panel), ExtendScript (host.jsx), Node.js built-ins (`fs`, `path`, `os`, `child_process`)

---

## Feature A — Variable iteration count

### Task 1: Add the Count input to index.html

**Files:**
- Modify: `extension/index.html`

- [ ] **Step 1: Add count input above `#layer-section`**

In `extension/index.html`, add after `</div>` that closes `#mode-tabs` and before `<div id="layer-section">`:

```html
<div id="count-section">
  <label>Count <input type="number" id="iter-count" value="5" min="1" style="width:48px"/></label>
</div>
```

- [ ] **Step 2: Verify the element is in place**

```bash
grep -n "iter-count" /Users/pc-63/Desktop/AE\ Iter\ Scripting/extension/index.html
```

Expected: one match on the new line.

- [ ] **Step 3: Commit**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting
git add extension/index.html
git commit -m "feat: add Count input to panel"
```

---

### Task 2: Add `getCount()` helper and count-change listener in main.js

**Files:**
- Modify: `extension/js/main.js`

- [ ] **Step 1: Add `getCount()` after the `setStatus` helper (around line 53)**

Find this block in `main.js`:
```javascript
    function setStatus(msg, isError, isOk) {
        statusEl.textContent = msg;
        statusEl.className   = isError ? "error" : isOk ? "ok" : "";
    }
```

Add `getCount` immediately after:
```javascript
    function getCount() {
        return Math.max(1, parseInt(document.getElementById("iter-count").value, 10) || 5);
    }
```

- [ ] **Step 2: Add count-change listener near the end of init (just before `applyLayerTypes([])`)**

Find this block (near line 1494):
```javascript
    applyLayerTypes([]); // default: shape-only view (no font inputs)
```

Add the listener before it:
```javascript
    document.getElementById("iter-count").addEventListener("change", function () {
        rebuildMainRows();
        rebuildExtraLayers();
        // Preserve existing emoji assignments across the rebuild
        var savedEmoji = {};
        document.querySelectorAll(".emoji-iter-row").forEach(function (row) {
            if (row.dataset.emojiPath) savedEmoji[row.dataset.iter] = {
                path: row.dataset.emojiPath,
                name: (row.dataset.emojiPath.split("/").pop() || "").replace(/\.[^.]+$/, "")
            };
        });
        _emojiGridLoaded = false;
        _buildEmojiIterRows();
        Object.keys(savedEmoji).forEach(function (idx) {
            var e = savedEmoji[idx];
            _setRowEmoji(parseInt(idx, 10), e.path, e.name);
        });
    });

    applyLayerTypes([]); // default: shape-only view (no font inputs)
```

- [ ] **Step 3: Verify**

```bash
grep -n "getCount\|iter-count" /Users/pc-63/Desktop/AE\ Iter\ Scripting/extension/js/main.js
```

Expected: `getCount` definition + the change listener.

- [ ] **Step 4: Commit**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting
git add extension/js/main.js
git commit -m "feat: add getCount() helper and count-change re-render"
```

---

### Task 3: Replace hardcoded 5-loops in row-builder functions

**Files:**
- Modify: `extension/js/main.js`

There are 5 row-builder sites. Replace each `5` with `getCount()`.

- [ ] **Step 1: `rebuildMainRows` (line ~335)**

Find:
```javascript
        for (var i = 0; i < 5; i++) {
            mainRows.appendChild(buildRowForLayer(i, 0, lInfo, currentMode === "var"));
        }
```
Replace:
```javascript
        for (var i = 0; i < getCount(); i++) {
            mainRows.appendChild(buildRowForLayer(i, 0, lInfo, currentMode === "var"));
        }
```

- [ ] **Step 2: `buildIterRows` (line ~442)**

Find:
```javascript
        for (var iter = 0; iter < 5; iter++) {
            var row = document.createElement("div");
            row.className = "iter-row";

            var num = document.createElement("span");
            num.className   = "iter-num";
            num.textContent = iter + 1;
```
Replace `iter < 5` with `iter < getCount()`.

- [ ] **Step 3: `attachStrokeSection` (line ~530)**

Find:
```javascript
        for (var r = 0; r < 5; r++) sec.appendChild(buildRowForLayer(r, li, lInfo));
```
Replace `r < 5` with `r < getCount()`.

- [ ] **Step 4: `rebuildExtraLayers` (line ~585)**

Find:
```javascript
            for (var r2 = 0; r2 < 5; r2++) group.appendChild(buildRowForLayer(r2, li2, lInfo2, false));
```
Replace `r2 < 5` with `r2 < getCount()`.

- [ ] **Step 5: `buildValues` (line ~725)**

Find:
```javascript
        for (var iter = 0; iter < 5; iter++) {
            var v0 = readRowValue(0, iter);
```
Replace `iter < 5` with `iter < getCount()`.

- [ ] **Step 6: Verify no row-builder 5-loops remain**

```bash
grep -n "< 5" /Users/pc-63/Desktop/AE\ Iter\ Scripting/extension/js/main.js
```

Expected output should show only the remaining sites (preset/cfg/emoji — handled in Task 4).

- [ ] **Step 7: Commit**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting
git add extension/js/main.js
git commit -m "feat: replace hardcoded 5-loops in row builders with getCount()"
```

---

### Task 4: Replace hardcoded 5-loops in preset, emoji, cfg, and status

**Files:**
- Modify: `extension/js/main.js`

- [ ] **Step 1: `readVarNames` (line ~839)**

Find:
```javascript
        for (var i = 0; i < 5; i++) {
            var inp = document.querySelector('.var-name-input[data-row="' + i + '"]');
            names.push(inp ? inp.value.trim() || ("VAR" + (i + 1)) : ("VAR" + (i + 1)));
        }
```
Replace `i < 5` with `i < getCount()`.

- [ ] **Step 2: `_buildEmojiIterRows` (line ~944)**

Find:
```javascript
        for (var i = 0; i < 5; i++) {
            var row   = document.createElement("div");
            row.className    = "emoji-iter-row";
```
Replace `i < 5` with `i < getCount()`.

- [ ] **Step 3: `buildEmojiCfg` (line ~994)**

Find:
```javascript
        for (var i = 0; i < 5; i++) {
            var row = document.querySelector(".emoji-iter-row[data-iter='" + i + "']");
```
Replace `i < 5` with `i < getCount()`.

- [ ] **Step 4: `applyColorPreset` (line ~1285)**

Find:
```javascript
        for (var i = 0; i < 5; i++) {
            var hex = normaliseHex(colors[i]);
```
Replace `i < 5` with `i < Math.min(getCount(), colors.length)`.

- [ ] **Step 5: `applyVideoPreset` (line ~1296)**

Find:
```javascript
        for (var i = 0; i < 5; i++) {
            var it  = iterations[i] || {};
```
Replace `i < 5` with `i < Math.min(getCount(), iterations.length)`.

- [ ] **Step 6: `getCurrentPreset` video loop (line ~1347)**

Find:
```javascript
            for (var i = 0; i < 5; i++) iters.push(readVideoRowValue(0, i));
```
Replace `i < 5` with `i < getCount()`.

- [ ] **Step 7: `getCurrentPreset` color loop (line ~1353)**

Find:
```javascript
        for (var j = 0; j < 5; j++) {
            var hi = document.querySelector('.hex-input[data-layer="0"][data-row="' + j + '"]');
```
Replace `j < 5` with `j < getCount()`.

- [ ] **Step 8: Fix status string in `runItr` (line ~1054)**

Find:
```javascript
                else { setStatus("Done — 5 iterations complete.", false, true); }
```
Replace:
```javascript
                else { setStatus("Done — " + getCount() + " iterations complete.", false, true); }
```

- [ ] **Step 9: Add `count` to both cfg objects**

In `runItr()`, find:
```javascript
        var cfg = {
            compName: layerInfo ? layerInfo.compName : "",
            layers:   layerInfo ? buildLayers() : [],
            values:   values,
            emoji:    buildEmojiCfg()
        };
```
Replace:
```javascript
        var cfg = {
            compName: layerInfo ? layerInfo.compName : "",
            layers:   layerInfo ? buildLayers() : [],
            values:   values,
            emoji:    buildEmojiCfg(),
            count:    getCount()
        };
```

In `runVar()`, find:
```javascript
        var cfg = { compName: layerInfo.compName, layers: buildLayers(), values: values, varNames: varNames };
```
Replace:
```javascript
        var cfg = { compName: layerInfo.compName, layers: buildLayers(), values: values, varNames: varNames, count: getCount() };
```

- [ ] **Step 10: Verify no hardcoded `< 5` loops remain**

```bash
grep -n "< 5" /Users/pc-63/Desktop/AE\ Iter\ Scripting/extension/js/main.js
```

Expected: zero matches (or only unrelated comparisons).

- [ ] **Step 11: Commit**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting
git add extension/js/main.js
git commit -m "feat: replace all remaining 5-loops with getCount(), pass count in cfg"
```

---

### Task 5: Update host.jsx to use `cfg.count`

**Files:**
- Modify: `extension/jsx/host.jsx`

- [ ] **Step 1: Update `runIterationsJSON` loop (line ~294)**

Find:
```javascript
        for (var iter = 0; iter < 5; iter++) {
```
(inside `runIterationsJSON`, which starts with `// ── CEP: run all 5 iterations`)

Replace:
```javascript
        for (var iter = 0; iter < (cfg.count || 5); iter++) {
```

- [ ] **Step 2: Update comment on that function**

Find:
```javascript
// ── CEP: run all 5 iterations ─────────────────────────────────────────────────
```
Replace:
```javascript
// ── CEP: run N iterations ─────────────────────────────────────────────────────
```

- [ ] **Step 3: Update `runVarIterationsJSON` loop (line ~456)**

Find:
```javascript
        for (var iter = 0; iter < 5; iter++) {
            var varName = (cfg.varNames[iter] || ("VAR" + (iter + 1))).replace(/\.aep$/i, "");
```
Replace `iter < 5` with `iter < (cfg.count || 5)`.

- [ ] **Step 4: Verify**

```bash
grep -n "< 5\|< (cfg" /Users/pc-63/Desktop/AE\ Iter\ Scripting/extension/jsx/host.jsx
```

Expected: two `cfg.count || 5` matches, zero `< 5` matches.

- [ ] **Step 5: Build and install**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting && bash install.sh
```

Expected:
```
Building jsx/host.jsx from lib files...
Done. Restart After Effects and open Window > Extensions > AE Iterations.
```

- [ ] **Step 6: Commit**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting
git add extension/jsx/host.jsx
git commit -m "feat: use cfg.count in JSX iteration runners"
```

---

## Feature B — Windows auto-update

### Task 6: Replace `installUpdate` with a cross-platform implementation

**Files:**
- Modify: `extension/js/main.js`

- [ ] **Step 1: Add `copyDirSync` helper before `installUpdate`**

Find the line:
```javascript
    function installUpdate(release) {
```

Insert `copyDirSync` immediately before it:
```javascript
    function copyDirSync(src, dest) {
        var fs   = require("fs");
        var path = require("path");
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(function (entry) {
            var s = path.join(src, entry);
            var d = path.join(dest, entry);
            if (fs.statSync(s).isDirectory()) copyDirSync(s, d);
            else fs.copyFileSync(s, d);
        });
    }

    function installUpdate(release) {
```

- [ ] **Step 2: Replace the body of `installUpdate`**

Replace the entire existing `installUpdate` function body:

```javascript
    function installUpdate(release) {
        var asset = null;
        for (var i = 0; i < release.assets.length; i++) {
            if (release.assets[i].name === "AE-Iterations.zip") { asset = release.assets[i]; break; }
        }
        if (!asset) { setStatus("Update asset not found in release.", true); return; }

        document.getElementById("update-banner").classList.add("hidden");
        setStatus("Downloading " + release.tag_name + "…");

        var os   = require("os");
        var path = require("path");
        var tmpZip = path.join(os.tmpdir(), "AE-Iterations-update.zip");
        var tmpDir = path.join(os.tmpdir(), "ae-iterations-update");

        downloadFile(asset.browser_download_url, tmpZip, function (err) {
            if (err) { setStatus("Download failed: " + err, true); return; }
            setStatus("Installing…");
            try {
                var cp = require("child_process");

                // Clean up any previous extraction
                try {
                    if (process.platform === "win32") {
                        cp.execSync("cmd /c rmdir /s /q \"" + tmpDir + "\"");
                    } else {
                        cp.execSync("rm -rf \"" + tmpDir + "\"");
                    }
                } catch (e) { /* ignore if not present */ }

                // Extract zip
                if (process.platform === "win32") {
                    cp.execSync(
                        "powershell -command \"Expand-Archive -Path '" +
                        tmpZip + "' -DestinationPath '" + tmpDir + "' -Force\""
                    );
                } else {
                    cp.execSync("unzip -o \"" + tmpZip + "\" -d \"" + tmpDir + "\"");
                }

                // Destination CEP path
                var dest = process.platform === "win32"
                    ? path.join(process.env.APPDATA, "Adobe", "CEP", "extensions", "com.aeiter.iteration")
                    : path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", "com.aeiter.iteration");

                // Copy extracted extension folder to CEP path
                copyDirSync(path.join(tmpDir, "extension"), dest);

                setStatus("Updated to " + release.tag_name + " — restart After Effects.", false, true);
            } catch (e) { setStatus("Install failed: " + e.message, true); }
        });
    }
```

- [ ] **Step 3: Verify the old `/tmp` and `bash` references are gone**

```bash
grep -n "bash\|/tmp\|install\.sh" /Users/pc-63/Desktop/AE\ Iter\ Scripting/extension/js/main.js
```

Expected: zero matches inside `installUpdate` (the string `/tmp` should not appear).

- [ ] **Step 4: Verify `os.tmpdir()` and platform detection are present**

```bash
grep -n "tmpdir\|win32\|copyDirSync\|APPDATA" /Users/pc-63/Desktop/AE\ Iter\ Scripting/extension/js/main.js
```

Expected: matches for `tmpdir`, `win32`, `copyDirSync`, `APPDATA`.

- [ ] **Step 5: Build and install**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting && bash install.sh
```

- [ ] **Step 6: Commit**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting
git add extension/js/main.js
git commit -m "feat: cross-platform auto-update (Windows + macOS)"
```

---

## Task 7: Update changelog

**Files:**
- Modify: `extension/changelog.json`

- [ ] **Step 1: Add entry for next release**

In `extension/changelog.json`, add a new entry at the top of the array. Replace the existing `"1.0.10"` entry (or add a new `"1.0.11"` entry if 1.0.10 has already been released):

```json
{
  "version": "1.0.11",
  "date": "2026-06-19",
  "changes": [
    "Variable iteration count: set any number of iterations in both ITR and VAR modes via the new Count input — no longer limited to 5",
    "Emoji assignments and row values are preserved when changing the count",
    "Preset apply scales to current count — applying a 5-color preset to a 3-iteration run uses only the first 3 colors",
    "Windows auto-update: one-click update now works on Windows (uses PowerShell Expand-Archive + Node.js file copy instead of bash/rsync)"
  ]
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pc-63/Desktop/AE\ Iter\ Scripting
git add extension/changelog.json
git commit -m "chore: update changelog for 1.0.11"
```

---

## Manual verification checklist

After `bash install.sh` and restarting After Effects:

- [ ] Panel shows a `Count` input defaulting to 5
- [ ] Changing Count to 3 renders 3 rows; existing colors preserved for rows 1–3
- [ ] Changing Count to 8 renders 8 rows; first 3 values still there
- [ ] Running ITR with Count=3 produces 3 output folders
- [ ] Running VAR with Count=3 produces 3 named variants
- [ ] Emoji section shows correct number of rows when Count changes; emoji assignments preserved
- [ ] Applying a preset with Count=3 fills only 3 rows
