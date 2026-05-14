# AE Iterations — CEP Extension

Automates creating 5 After Effects project iterations, each with a different value for one or more properties (shape color, stroke color, text color, text font, or video effects). Each iteration is delivered as a self-contained collected folder with 3 PNG renders.

---

## What the Extension Does

Given a base project `LO_10794_4378_M11_S0_EN_usr_CAM_PRI_Video_ITR_9x16.aep`, the user selects layers, sets 5 values per layer, and clicks **Run Iterations**. Output:

```
LO_10794_... folder/   ← iteration 1 (base project)
LO_10795_... folder/   ← iteration 2
LO_10796_... folder/   ← iteration 3
LO_10797_... folder/   ← iteration 4
LO_10798_... folder/   ← iteration 5
```

Each folder contains:

- `[projectName].aep` — collected, self-contained project
- `(Footage)/` — all footage copied and relinked
- `[name]_ITR_9x16.png`, `_ITR_1x1.png`, `_ITR_16x9.png` — first-frame renders

---

## Naming Convention

Pattern: `LO_AAAAA_BBBB_M11_S0_EN_usr_CAM_PRI_Video_ITR_9x16`

**Segment index 1** (second `_`-delimited segment) is the iteration ID, incremented +1 per copy.

```javascript
function incrementProjectId(nameWithoutExt) {
    var parts = nameWithoutExt.split("_");
    parts[1] = String(parseInt(parts[1], 10) + 1);
    return parts.join("_");
}
```

---

## The 3 Precomps

Always render frame 0 of the 3 comps whose names **end with**:
- `ITR_9x16`
- `ITR_1x1`
- `ITR_16x9`

---

## What Can Be Iterated

| Layer Type | Properties |
|---|---|
| Shape layer | Fill color (per fill group), stroke color (per stroke group) |
| Text layer | Fill color, font (PostScript name) |
| Video / footage / precomp | Flip horizontal, black & white, tint + tint amount, hue shift |

Layer type is auto-detected on Refresh. Multiple layers can be iterated together.

---

## Repository Structure

```
extension/                  ← the CEP extension (source of truth)
  CSXS/manifest.xml
  index.html
  css/style.css
  js/
    CSInterface.js          (Adobe-provided, do not edit)
    main.js                 (panel logic)
    version.js              (current version string)
  jsx/
    host.jsx                (built by install.sh / package.sh — do not edit directly)
    lib/
      naming.jsx            (incrementProjectId, project name utils)
      layer-utils.jsx       (getLayerType, collectFills, collectStrokes, readVideoLayerState)
      apply-change.jsx      (applyShapeFillColor, applyShapeStrokeColor, applyTextColor, applyTextFont)
      apply-video.jsx       (applyVideoLayer — flip, B&W, tint, hue)
      render.jsx            (saveFrameToPng, renderPrecomps)
      collect.jsx           (collect project to folder, relink footage)
      project.jsx           (copy project with incremented ID)
  presets/
    library.json            (built-in preset library, updated with releases)
  changelog.json            (release history shown in panel)
install.sh                  (dev: builds host.jsx and copies to CEP extensions folder)
package.sh                  (release: bumps version, builds zip, creates GitHub release)
```

> `jsx/host.jsx` is **generated** — it concatenates all `lib/*.jsx` files then appends the host body. Edit the lib files, not host.jsx directly.

---

## Development Workflow

**Install (dev):**
```bash
bash install.sh
```
Builds `host.jsx`, copies the extension to `~/Library/Application Support/Adobe/CEP/extensions/com.aeiter.iteration/`. Restart After Effects after.

**Enable unsigned extensions (once per machine):**
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.12 PlayerDebugMode 1
```

**Release:**

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
bash package.sh          # auto-increments patch version
bash package.sh 1.2.0    # explicit version
```

Bumps `version.js`, builds `AE-Iterations.zip`, commits, tags, pushes, creates GitHub release with zip attached.

---

## Versioning

- `extension/js/version.js` — version string used at runtime in the panel
- `extension/CSXS/manifest.xml` — CEP bundle version (keep in sync)
- `extension/changelog.json` — human-readable release notes shown in panel

When releasing, update all three + add an entry to `changelog.json` before running `package.sh`.

---

## Presets

**Built-in library:** `extension/presets/library.json` — ships with the extension, updated on each release.

**User presets:** saved to `~/Library/Application Support/AE Iterations/user-presets.json` — outside the extension folder, survives updates.

Preset format:

```json
{
  "name": "Palette Name",
  "type": "color",
  "iterations": [
    { "color": "#FF0000" },
    { "color": "#00FF00" },
    ...
  ]
}
```

Video presets use `"type": "video"` and iteration objects with `{ flip, bw, tint, tintAmount, hue }`.

---

## Key ExtendScript APIs

| What | API |
| --- | --- |
| Current project file | `app.project.file` |
| Render frame as PNG | `comp.saveFrameToPng(0, new File(path))` |
| Shape fill color | `contents.property("ADBE Vector Shape - Fill").property("Color")` |
| Shape stroke color | `contents.property("ADBE Vector Shape - Stroke").property("Color")` |
| Text fill color | `layer.property("Source Text").value.fillColor` (set via TextDocument) |
| Text font | `layer.property("Source Text").value.font` (PostScript name) |
| Video flip | `layer.transform.scale.setValue([-x, y])` |
| Hue/Saturation effect | matchName `ADBE HUE SATURATION` |
| Tint effect | matchName `ADBE Tint` |
| Copy file | `srcFile.copy(destFsPath)` |
| Open project | `app.open(new File(path))` |
| Save project | `app.project.save(file)` |
