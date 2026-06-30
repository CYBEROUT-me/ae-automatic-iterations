# Design: Variable Iteration Count + Windows Auto-Update

**Date:** 2026-06-19  
**Status:** Approved

---

## Feature 1: Variable Iteration Count

### Goal

Replace the hardcoded 5-iteration limit with a user-configurable count that applies to both ITR and VAR modes.

### UI

- Add a `Count` number input (`min="1"`, no max, default `5`) near the top of the panel, above the layer section.
- Single shared value — one input controls both ITR and VAR.
- Changing the count re-renders all row groups immediately (same behaviour as switching layer type today).

### JS (`main.js`)

- Add a `getCount()` helper that reads the input: `parseInt(document.getElementById("iter-count").value, 10) || 5`.
- Replace every `for (... i < 5 ...)` / `for (... iter < 5 ...)` loop with `getCount()`. Affected call sites:
  - `buildColorRow` callers
  - `buildValues()`
  - `_buildEmojiIterRows()`
  - VAR name/row builders
  - Preset loader row loop
  - The "Done — 5 iterations complete" status string
- Add a `change` listener on the count input that calls `renderRows()` (or equivalent re-render) so the panel updates live. Re-render appends new rows or removes surplus rows from the bottom; existing rows keep their current values.
- Pass `count: getCount()` inside `cfg` for both `runItr()` and `runVar()` payloads.

### JSX (`host.jsx`)

- Both `runIterationsJSON` and `runVarIterationsJSON` replace `for (var iter = 0; iter < 5; iter++)` with `for (var iter = 0; iter < (cfg.count || 5); iter++)`.
- No change to naming or folder logic — `incrementProjectId` already handles arbitrary counts.

---

## Feature 2: Windows Auto-Update

### Goal

Make the in-panel one-click update work on Windows without requiring bash, rsync, or `/tmp`.

### Current flow (macOS only)

1. Download zip → `/tmp/AE-Iterations-update.zip`
2. `unzip -o zip -d /tmp/ae-iterations-update`
3. `bash /tmp/ae-iterations-update/install.sh`

### New cross-platform flow

**Step 1 — temp path**  
Use `os.tmpdir()` instead of `/tmp`.

**Step 2 — extraction**  
Detect `process.platform`:
- `darwin` / `linux`: `unzip -o "<zip>" -d "<dir>"`
- `win32`: `powershell -command "Expand-Archive -Path '<zip>' -DestinationPath '<dir>' -Force"`

**Step 3 — file copy (replaces `bash install.sh`)**  
A small recursive Node.js copy function replaces rsync and bash entirely:

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
```

Copy `<tmpDir>/extension/` → CEP destination path.

**Step 4 — CEP destination path**

```javascript
var path = require("path");
var os   = require("os");
var dest = process.platform === "win32"
    ? path.join(process.env.APPDATA, "Adobe", "CEP", "extensions", "com.aeiter.iteration")
    : path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", "com.aeiter.iteration");
```

### Why `install.sh` is not needed

The GitHub release zip is built by `package.sh`, which runs `install.sh` internally before zipping. The zip therefore already contains a fully built `host.jsx`. The update only needs to copy files — no build step required.

### Error handling

- If extraction fails, show error status and leave old version in place.
- If copy fails mid-way, show error status — the extension may be in a partially updated state; user is told to restart AE and try again.

---

## Files changed

| File | Change |
|---|---|
| `extension/index.html` | Add `Count` input |
| `extension/js/main.js` | `getCount()` helper, replace all `5` loops, count in cfg, re-render on change, cross-platform `installUpdate()` |
| `extension/jsx/host.jsx` | Use `cfg.count \|\| 5` in both iteration loops |
| `extension/changelog.json` | New entry for next release |
