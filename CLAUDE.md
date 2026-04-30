# AE Iteration Automation

Automates creating 5 project iterations in After Effects — each with a different shape color, text color, or text font — and delivers each iteration as a self-contained collect folder with 3 PNG renders.

---

## Project Goal

Given a base project like `LO_10794_4378_M11_S0_EN_usr_CAM_PRI_Video_ITR_9x16.aep`, produce 5 deliverables:

```
LO_10794_... ← iteration 1  (base project, value 1 applied)
LO_10795_... ← iteration 2  (copy, value 2 applied)
LO_10796_... ← iteration 3
LO_10797_... ← iteration 4
LO_10798_... ← iteration 5
```

Each deliverable folder contains:
- `[projectName].aep` — collected (self-contained) project
- `(Footage)/` — all footage copied and relinked
- `[ITR_9x16].png`, `[ITR_1x1].png`, `[ITR_16x9].png` — first-frame renders

---

## Naming Convention

Pattern: `LO_AAAAA_BBBB_M11_S0_EN_usr_CAM_PRI_Video_ITR_9x16`

**Segment index 1** (0-indexed, the second segment) is the iteration ID. It increments +1 per copy.

```javascript
function incrementProjectId(nameWithoutExt) {
    var parts = nameWithoutExt.split("_");
    parts[1] = String(parseInt(parts[1], 10) + 1);
    return parts.join("_");
}
```

The `.aep` extension is stripped before parsing and re-added after.

---

## The 3 Precomps

Always render the first frame (time = 0) of the 3 comps whose names **end with**:
- `ITR_9x16`
- `ITR_1x1`
- `ITR_16x9`

Output: PNG files into the project's output folder.

---

## What Can Be Iterated

- Shape layer fill color (traverses `Contents` recursively for `ADBE Vector Shape - Fill`)
- Text layer fill color (`layer.property("Source Text").value.fillColor`)
- Text layer font (`layer.property("Source Text").value.font` — PostScript name)

---

## Module Breakdown & Build Order

| # | File | Purpose |
|---|------|---------|
| 1 | `scripts/01_render-precomps.jsx` | Find the 3 ITR comps, render frame 0 as PNG |
| 2 | `scripts/02_collect.jsx` | Collect project to `[name] folder/` (extracted from Finish Him) |
| 3 | `scripts/03_copy-project.jsx` | Copy .aep with ID+1, save to same folder |
| 4 | `scripts/04_read-layers.jsx` | Read selected layers, return type + current values as JSON |
| 5 | `scripts/05_apply-change.jsx` | Apply one iteration value (color/font) to a specified layer |
| 6 | `jsx/host.jsx` | CEP orchestrator — combines 1–5, called from panel |
| 7 | CEP Extension | HTML panel: layer picker, 5 value rows, run button |

---

## CEP Extension

**Install path:** `~/Library/Application Support/Adobe/CEP/extensions/com.aeiter.iteration/`

**Enable unsigned extensions (dev mode, run once):**
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
```
(CSXS version 11 = After Effects 26)

**Manifest host version:** `<Host Name="AEFT" Version="26.0" />`

**File structure:**
```
com.aeiter.iteration/
├── CSXS/
│   └── manifest.xml
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── CSInterface.js     (Adobe-provided)
│   └── main.js
└── jsx/
    └── host.jsx
```

Font list is loaded via Node.js: `child_process.execSync('system_profiler SPFontsDataType -json')` parses PostScript names on macOS.

---

## Key ExtendScript APIs

| What | API |
|------|-----|
| Current project file | `app.project.file` |
| Render frame as PNG | `comp.saveFrameToPng(0, new File(path))` |
| Shape fill color prop | `contents.property("ADBE Vector Shape - Fill").property("Color")` |
| Text fill color | `layer.property("Source Text").value.fillColor` → set via TextDocument |
| Text font | `layer.property("Source Text").value.font` (PostScript name) |
| Copy file | `srcFile.copy(destFsPath)` |
| Open project | `app.open(new File(path))` |
| Save project | `app.project.save(file)` |
| Render queue | `app.project.renderQueue` |

---

## Reuse from Finish Him 2.1.jsx

| Function | Lines | Used in |
|----------|-------|---------|
| `saveFrame()` | 108–118 | Module 1 |
| `binPath(item)` | 133–140 | Module 2 |
| `binFolder(item)` | 142–151 | Module 2 |
| `claimDest()` | 154–167 | Module 2 |
| `copySingleFile()` | 169–172 | Module 2 |
| `copySequence()` | 175–198 | Module 2 |
| `applyRelinks()` | 239–247 | Module 2 |
| `applyProxyRelinks()` | 249–257 | Module 2 |

---

## Existing Files

- `Finish Him 2.1.jsx` — production delivery script (PNG preview + custom collect + render). Source of reusable utilities above.
