# Emoji Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add emoji overlay to `ae-iterations-next`'s ITR mode — per-iteration emoji file picker, shared position/size/layer-index config, a live Preview, and full run-loop integration — matching the production `extension/`'s feature exactly.

**Architecture:** The emoji step is a new, independent block inside `runIterationBatch` (host-side), structurally parallel to (not nested inside) the existing layer-value-application block, so it can run even in "emoji-only" mode (no layer selected). A reintroduced `resolveLayer` name-fallback protects layer-index lookups against the index-shifting side effect of the emoji Preview feature. Panel-side, a new `EmojiSection` (gated on ITR mode) holds a shared config plus one picker row per iteration, backed by a new `EmojiPickerGrid` that lists a host-scanned folder of bundled emoji images.

**Tech Stack:** BoltCEP (React + TypeScript + Vite), Zustand, ExtendScript (aeft/host side), Vitest + React Testing Library.

**Design spec:** `docs/superpowers/specs/2026-07-07-ae-iterations-emoji-overlay-design.md`

## Global Constraints

- Emoji overlay is **ITR-mode only** — VAR mode gets no emoji config, no UI, no run-loop changes.
- **"Emoji-only run" is preserved**: a batch can run with zero layer-value changes (no Refresh needed) if emoji is enabled — only the emoji varies per iteration.
- **Position, size, and layer-index are shared across all iterations** — only the per-iteration emoji *file* varies. No per-iteration position/size.
- Picker UX is a **visual thumbnail grid**, not a native file-browse dialog.
- No change to the current production `extension/` — this phase applies only to `ae-iterations-next`.
- Host-command convention: exported `aeft.ts` functions throw `Error` on failure, return a typed payload directly on success (no `JSON.stringify({error})` sentinel).
- `types-for-adobe`'s ambient AE types have known gaps (e.g. `AVLayer.Effects` capital vs. lowercase in the `.d.ts`) — verify against the real `node_modules/types-for-adobe/AfterEffects/22.0/index.d.ts` before reaching for an `any` cast; don't guess.
- No automated tests for AE-object-model host-side code (`src/jsx/aeft/**`) — established precedent (`applyChange.ts`, `applyVideo.ts`, `applyMedia.ts`, `findComp.ts` all shipped without tests). Panel-side code (`src/js/main/**`) gets Vitest + React Testing Library tests.
- Any `useAppStore(selector)` returning a new object literal MUST be wrapped in `useShallow` from `zustand/react/shallow` — an unwrapped object-returning selector throws React error #185 and blacks out the whole panel (a real production incident earlier in this project).

---

### Task 1: Shared types — `EmojiConfig`

**Files:**
- Modify: `ae-iterations-next/src/shared/types.ts`

**Interfaces:**
- Produces: `EmojiConfig` interface, and `RunConfig.emoji?: EmojiConfig`. Consumed by every later task in this plan (host and panel side both).

- [ ] **Step 1: Add the `EmojiConfig` interface and extend `RunConfig`**

Open `ae-iterations-next/src/shared/types.ts`. Add this interface anywhere after `LayerValue` and before `RunConfig`:

```ts
export interface EmojiConfig {
  enabled: boolean;
  perIteration: (string | null)[]; // emoji file path per iteration, count-length
  x: number;
  y: number;
  size: number;
  layerIndex: number; // 1-based position from top of layer stack
}
```

Then change the existing `RunConfig` interface from:

```ts
export interface RunConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][]; // [iter][layer row index], matching `layers` order
  count: number;
}
```

to:

```ts
export interface RunConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][]; // [iter][layer row index], matching `layers` order
  count: number;
  emoji?: EmojiConfig;
}
```

Do not touch `RunVarConfig` — VAR mode gets no emoji field, per the Global Constraints.

- [ ] **Step 2: Verify the build**

```bash
cd ae-iterations-next
npm run build
```

Expected: exit 0. This is a pure type change with no runtime logic, so there's no test to write — `npm run build`'s `tsc` pass is the verification.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/src/shared/types.ts
git commit -m "feat: add EmojiConfig type and RunConfig.emoji field"
```

---

### Task 2: `applyEmoji.ts` — add/remove the emoji layer

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/applyEmoji.ts`

**Interfaces:**
- Produces: `EMOJI_LAYER_NAME` (constant), `removeEmojiFromComp(comp: CompItem): void`, `addEmojiToComp(comp: CompItem, footage: FootageItem, x: number, y: number, targetIndex: number, size: number): void`. Consumed by Task 5 (`previewEmoji`) and Task 6 (`runIterationBatch`'s emoji block).

- [ ] **Step 1: Create the file**

Ported from `extension/jsx/lib/apply-emoji.jsx`, with one deliberate deviation: `addEmojiToComp` takes an already-imported `FootageItem`, not a raw file path — the caller (Task 6) imports the emoji file once per iteration and shares that single `FootageItem` across all 4 render comps, so importing belongs in the orchestration function, not here. This mirrors how VAR mode's `applyMediaLayer` (`lib/applyMedia.ts`) is already split from its caller's import step.

```ts
// lib/applyEmoji.ts — add/remove a looping, time-remapped emoji overlay layer.
// Ported from extension/jsx/lib/apply-emoji.jsx. Deliberate deviation: this
// takes an already-imported FootageItem, not a raw file path — see this
// plan's Task 2 header for why.

export const EMOJI_LAYER_NAME = "AEITER_EMOJI";

// Remove any previously placed emoji layer from the comp.
export function removeEmojiFromComp(comp: CompItem): void {
  for (let i = comp.numLayers; i >= 1; i--) {
    try {
      if (comp.layer(i).name === EMOJI_LAYER_NAME) comp.layer(i).remove();
    } catch (e) {}
  }
}

// comp:        CompItem to add the emoji into
// footage:     already-imported emoji FootageItem (shared across comps by caller)
// x, y:        position in comp pixels
// targetIndex: 1-based layer position from top (1 = topmost)
// size:        uniform scale percentage
export function addEmojiToComp(
  comp: CompItem,
  footage: FootageItem,
  x: number,
  y: number,
  targetIndex: number,
  size: number
): void {
  // Remove any emoji left over from a previous iteration
  removeEmojiFromComp(comp);

  // Add at index 1 (top of stack)
  const layer = comp.layers.add(footage);
  layer.name = EMOJI_LAYER_NAME;

  // Span the full comp
  layer.inPoint = 0;
  layer.outPoint = comp.duration;

  // Position and scale
  layer.transform.position.setValue([x, y]);
  const sz = size || 100;
  layer.transform.scale.setValue([sz, sz]);

  // Time remapping so loopOut works regardless of source duration
  layer.timeRemapEnabled = true;
  layer.timeRemap.expression = 'loopOut("cycle")';

  // Move to target index.
  // After layers.add() our layer is at 1; original layers shifted to 2..N+1.
  // moveAfter(comp.layer(P)) places our layer at index P.
  if (targetIndex > 1) {
    if (targetIndex >= comp.numLayers) {
      layer.moveToEnd();
    } else {
      layer.moveAfter(comp.layer(targetIndex));
    }
  }
}
```

If `comp.layers.add(footage)`'s return type doesn't cleanly support `.timeRemapEnabled`/`.timeRemap`/`.moveAfter`/`.moveToEnd`, check the real declared signature in `node_modules/types-for-adobe/AfterEffects/22.0/index.d.ts` before reaching for a cast — these are common, well-typed AE APIs and most likely need no cast at all (matching VAR mode's `applyMedia.ts`, which needed zero casts for very similar APIs).

- [ ] **Step 2: Verify the build**

This file isn't imported anywhere yet (Task 6 wires it in), so confirm it at least type-checks within the project, then verify it bundles correctly via a throwaway scratch import (temporarily import `addEmojiToComp` into `aeft.ts`, run `npm run build`, inspect the compiled `dist/cep/jsx/index.js` to confirm the function's body appears, then revert the scratch import before committing) — this is the same pattern already used for `applyMedia.ts` in the VAR mode plan.

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected (this file has no test of its own — AE-object-model code, per Global Constraints), build exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/applyEmoji.ts
git commit -m "feat: add applyEmoji lib (add/remove emoji overlay layer)"
```

---

### Task 3: Reintroduce `resolveLayer` name-fallback

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/lib/findComp.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts`

**Interfaces:**
- Produces: `resolveLayer(comp: CompItem, lc: CfgLayer): Layer | null` in `lib/findComp.ts`. Consumed immediately by this same task's two call-site swaps, and by Task 6.

This closes a gap flagged since the ITR-core phase: `runIterationBatch.ts` and `aeft.ts`'s `previewApply` both do a plain `comp.layer(lc.index)` lookup, with a comment noting that a future feature inserting layers into the comp (emoji) would silently break index-based targeting. This task reintroduces the original's `resolveLayer` name-fallback (`extension/jsx/host.jsx`) — it degrades to the exact same plain index lookup whenever there's no name mismatch, so today's ITR runs (no emoji) are completely unaffected; it only changes behavior when a stale index is detected.

- [ ] **Step 1: Read the current `findComp.ts`**

```bash
cat ae-iterations-next/src/jsx/aeft/lib/findComp.ts
```

You'll see `findCompByName`, `findCompsBySuffixes`, `ITR_SUFFIXES`, and `findVarComp` — no imports at the top of the file currently.

- [ ] **Step 2: Add `resolveLayer` to `findComp.ts`**

Add this at the end of the file, and add the import line at the very top:

```ts
import type { CfgLayer } from "../../../shared/types";
```

```ts
// Look up a layer by its stored index; if that slot holds a different layer
// (e.g. an emoji-preview insertion shifted indices), fall back to searching
// by name so iteration still targets the right layer. Ported from
// extension/jsx/host.jsx's resolveLayer. Degrades to a plain index lookup
// whenever there's no name mismatch.
export function resolveLayer(comp: CompItem, lc: CfgLayer): Layer | null {
  let layer: Layer | null = null;
  try {
    layer = comp.layer(lc.index);
  } catch (e) {}
  if (layer && layer.name !== lc.name) {
    for (let i = 1; i <= comp.numLayers; i++) {
      try {
        if (comp.layer(i).name === lc.name) {
          layer = comp.layer(i);
          break;
        }
      } catch (e) {}
    }
  }
  return layer;
}
```

- [ ] **Step 3: Swap the call site in `runIterationBatch.ts`**

Open `ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts`. Change the import line from:

```ts
import { findCompByName, findCompsBySuffixes, ITR_SUFFIXES } from "../lib/findComp";
```

to:

```ts
import { findCompByName, findCompsBySuffixes, resolveLayer, ITR_SUFFIXES } from "../lib/findComp";
```

Then find this block inside the layer-apply loop:

```ts
        for (let li = 0; li < cfg.layers.length; li++) {
          const lc = cfg.layers[li];
          // Plain index lookup, no name-fallback: there's no emoji/index-shifting
          // feature in this plan yet. A future phase that inserts layers into the
          // comp (e.g. emoji overlay) must reintroduce name-fallback resolution
          // (like the original extension's `resolveLayer` in extension/jsx/host.jsx)
          // or index-based layer targeting will silently break.
          const layer = comp.layer(lc.index);
          if (!layer) {
```

and replace it with:

```ts
        for (let li = 0; li < cfg.layers.length; li++) {
          const lc = cfg.layers[li];
          const layer = resolveLayer(comp, lc);
          if (!layer) {
```

- [ ] **Step 4: Swap the call site in `aeft.ts`**

Open `ae-iterations-next/src/jsx/aeft/aeft.ts`. Change the import line from:

```ts
import { findCompByName } from "./lib/findComp";
```

to:

```ts
import { findCompByName, resolveLayer } from "./lib/findComp";
```

Then find this block inside `previewApply`:

```ts
  for (let li = 0; li < cfg.layers.length; li++) {
    const lc = cfg.layers[li];
    // Plain index lookup, no name-fallback: there's no emoji/index-shifting
    // feature in this plan yet. A future phase that inserts layers into the
    // comp (e.g. emoji overlay) must reintroduce name-fallback resolution
    // (like the original extension's `resolveLayer` in extension/jsx/host.jsx)
    // or index-based layer targeting will silently break.
    const layer = comp.layer(lc.index);
    if (!layer) {
```

and replace it with:

```ts
  for (let li = 0; li < cfg.layers.length; li++) {
    const lc = cfg.layers[li];
    const layer = resolveLayer(comp, lc);
    if (!layer) {
```

- [ ] **Step 5: Verify the build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected (no test file for `findComp.ts`/`runIterationBatch.ts`/`aeft.ts` — AE-object-model code), build exits 0. There is no automated test for `resolveLayer` itself — like every other function in this file, it needs a real `CompItem`, and this codebase's established precedent is to verify AE-object-model code by careful reading + build success, not by mocking the AE object model. Read both modified call sites once more and confirm by eye that `resolveLayer(comp, lc)` is a drop-in replacement: when `comp.layer(lc.index)`'s name already matches `lc.name`, the function returns that exact same layer with no extra work.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/findComp.ts ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts ae-iterations-next/src/jsx/aeft/aeft.ts
git commit -m "feat: reintroduce resolveLayer name-fallback for emoji index-shifting"
```

---

### Task 4: Bundle emoji assets + `listEmojiFiles` command

**Files:**
- Modify: `ae-iterations-next/vite.config.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts`

**Interfaces:**
- Produces: `listEmojiFiles(): { files: { path: string; name: string }[] }` in `aeft.ts`. Consumed by Task 8 (`EmojiPickerGrid`).

**Do not copy `extension/emojis/` anywhere.** It's 558MB across 166 files — duplicating it into a new folder would bloat git history for no reason, and a committed symlink is unreliable on Windows (this project explicitly supports it — see `install.ps1`). Instead, point Vite's `publicDir` directly at the existing folder so it gets copied into the build output verbatim, with `extension/emojis/` remaining the single source of truth.

- [ ] **Step 1: Point `publicDir` at `extension/emojis/`**

Open `ae-iterations-next/vite.config.ts`. Find this block:

```ts
export default defineConfig({
  plugins: [
    react(), 
    cep(config),
  ],
  resolve: {
    alias: [{ find: "@esTypes", replacement: path.resolve(__dirname, "src") }],
  },
  root,
  clearScreen: false,
```

and add `publicDir` right after `root,`:

```ts
export default defineConfig({
  plugins: [
    react(), 
    cep(config),
  ],
  resolve: {
    alias: [{ find: "@esTypes", replacement: path.resolve(__dirname, "src") }],
  },
  root,
  publicDir: path.resolve(__dirname, "../extension/emojis"),
  clearScreen: false,
```

`path.resolve(__dirname, ...)` makes this independent of Vite's `root` (which is `src/js`, not the project root) — `__dirname` is `ae-iterations-next/`, so this resolves to the sibling `extension/emojis/` folder one level up.

- [ ] **Step 2: Build and confirm the assets land in `dist/cep/emojis/`**

```bash
cd ae-iterations-next
npm run build
ls dist/cep/emojis | head -5
```

Expected: exit 0, and the `ls` shows real emoji filenames (e.g. `AnimatedEmojies-512px-10.gif`) copied verbatim into `dist/cep/emojis/`.

- [ ] **Step 3: Add the `listEmojiFiles` command**

Open `ae-iterations-next/src/jsx/aeft/aeft.ts`. Add this export (anywhere after `browseForMedia` is fine):

```ts
// Scans the bundled emojis/ folder (copied verbatim into dist/cep/emojis/ at
// build time from extension/emojis/ via vite.config.ts's publicDir) and
// returns image files, sorted by name. There is no ExtendScript equivalent
// of the panel-side cs.getSystemPath(SystemPath.EXTENSION), so this locates
// the folder by walking up from the currently-executing jsx bundle's own
// install path: dist/cep/jsx/index.js -> dist/cep/jsx -> dist/cep (the
// extension root, sibling to emojis/).
export const listEmojiFiles = (): { files: { path: string; name: string }[] } => {
  const scriptFile = new File($.fileName);
  const extensionRoot = scriptFile.parent.parent;
  const emojiFolder = new Folder(extensionRoot.fsName + "/emojis");
  if (!emojiFolder.exists) throw new Error("emojis/ folder not found at " + emojiFolder.fsName);

  const imgExts = [".gif", ".png", ".jpg", ".jpeg", ".webp"];
  const entries = emojiFolder.getFiles();
  const files: { path: string; name: string }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const f = entries[i];
    if (!(f instanceof File)) continue;
    const dot = f.name.lastIndexOf(".");
    if (dot === -1) continue;
    const ext = f.name.slice(dot).toLowerCase();
    if (imgExts.indexOf(ext) === -1) continue;
    files.push({ path: f.fsName, name: f.name });
  }
  files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { files };
};
```

This is the one piece of this plan with no exact prior-art call site in this codebase to verify the `$.fileName` walk-up against (the original extension's equivalent lookup is panel-side, using a CSInterface API with no ExtendScript equivalent). If `$.fileName` or `Folder.getFiles()` don't behave as expected, verify against `node_modules/types-for-adobe/AfterEffects/22.0/index.d.ts` and flag any doubt rather than guessing.

- [ ] **Step 4: Verify the build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected, build exits 0. Inspect `dist/cep/jsx/index.js` to confirm `listEmojiFiles` is present and registered in the compiled command map alongside `getLayerInfo`/`previewApply`/`runIterations`/`browseForMedia`.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/vite.config.ts ae-iterations-next/src/jsx/aeft/aeft.ts
git commit -m "feat: bundle extension/emojis/ via publicDir, add listEmojiFiles command"
```

---

### Task 5: `previewEmoji` command

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts`

**Interfaces:**
- Consumes: `addEmojiToComp` (Task 2), `findCompsBySuffixes`/`ITR_SUFFIXES` (existing, `lib/findComp.ts`).
- Produces: `previewEmoji(cfg: { emojiPath: string; x: number; y: number; size: number; layerIndex: number }): { compName: string }`. Consumed by Task 9 (`EmojiSection`'s "Preview Emoji" button).

Direct port of `extension/jsx/host.jsx`'s `previewEmojiJSON`: inserts a temporary, undo-groupable emoji layer into the active comp (or falls back to any found ITR render comp if nothing's active) so the user can check placement before running a real batch.

- [ ] **Step 1: Add the command**

Open `ae-iterations-next/src/jsx/aeft/aeft.ts`. Update the import from `./lib/findComp` (already changed in Task 3) to also bring in `findCompsBySuffixes` and `ITR_SUFFIXES`:

```ts
import { findCompByName, findCompsBySuffixes, resolveLayer, ITR_SUFFIXES } from "./lib/findComp";
```

Add this import for `addEmojiToComp`:

```ts
import { addEmojiToComp } from "./lib/applyEmoji";
```

Add the command itself (anywhere after `previewApply` is fine):

```ts
// Inserts a temporary, undo-groupable emoji layer into the active comp (or
// falls back to any found ITR render comp) so the user can check
// position/size before running a real batch. Ported from host.jsx's
// previewEmojiJSON.
export const previewEmoji = (cfg: {
  emojiPath: string;
  x: number;
  y: number;
  size: number;
  layerIndex: number;
}): { compName: string } => {
  let comp: CompItem | null = null;
  if (app.project.activeItem instanceof CompItem) {
    comp = app.project.activeItem;
  } else {
    const itrComps = findCompsBySuffixes(ITR_SUFFIXES);
    comp = itrComps["ITR_9x16"] || itrComps["ITR_1x1"] || itrComps["ITR_16x9"] || itrComps["ITR_4x5"] || null;
  }
  if (!comp) throw new Error("No active comp found. Open a comp first.");

  const file = new File(cfg.emojiPath);
  if (!file.exists) throw new Error("Emoji file not found: " + cfg.emojiPath);

  app.beginUndoGroup("Emoji Preview");
  const footage = app.project.importFile(new ImportOptions(file)) as FootageItem;
  if (!footage) {
    app.endUndoGroup();
    throw new Error("Could not import emoji");
  }
  addEmojiToComp(comp, footage, cfg.x, cfg.y, cfg.layerIndex, cfg.size);
  app.endUndoGroup();

  return { compName: comp.name };
};
```

Note the 4-way fallback (`ITR_9x16 || ITR_1x1 || ITR_16x9 || ITR_4x5`) is one wider than the original's 3-way — this project's ITR mode already added a 4th aspect ratio (`ITR_4x5`) in an earlier phase, so the fallback chain is extended to match, not a deviation from this plan's intent.

- [ ] **Step 2: Verify the build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected, build exits 0. Inspect `dist/cep/jsx/index.js` to confirm `previewEmoji` is present and registered in the compiled command map.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/aeft.ts
git commit -m "feat: add previewEmoji command"
```

---

### Task 6: `runIterationBatch.ts` emoji block (highest risk in this plan)

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts`

**Interfaces:**
- Consumes: `addEmojiToComp`/`removeEmojiFromComp` (Task 2), `EmojiConfig`/`RunConfig.emoji` (Task 1), `resolveLayer` (Task 3, already wired into this file).
- Produces: emoji application fully integrated into the ITR run loop. Consumed at runtime by `runIterations` (unchanged wrapper) once Task 10 wires the panel to send `cfg.emoji`.

**This is the highest-risk task in this plan.** The exact class of bug that has shipped twice already in this project (ITR's Task 16: a scrambled `app.open`/rename order; VAR's Task 9: a dialog-suppression window that only covered the first iteration) is easy to reintroduce here, because this task adds a `beginSuppressDialogs`/`endSuppressDialogs` pair **inside** a loop that already has its own outer suppression wrapping the whole batch. Read `extension/jsx/host.jsx`'s `runIterationsJSON` (lines 281-424) yourself, in full, before writing anything, and trace every step below against it.

**Watch out for, specifically:**
1. **The new inner `endSuppressDialogs`/`beginSuppressDialogs` pair must be fully contained within one iteration** — both calls execute back-to-back within the same iteration, before that iteration's save/close/reopen. This is different from VAR's Task 9 bug, where the `beginSuppressDialogs()` sat *outside* the loop entirely with its matching `end` inside — here, both halves of the pair belong inside the loop body from the start, so there's no cross-iteration gap to reintroduce. Confirm this explicitly: after the emoji block runs, suppression must be back ON before `app.project.save(...)`, on *every* iteration, not just the first.
2. **`removeEmojiFromComp` must run on the layer-value target comp *before* `resolveLayer` trusts any index** — clearing a leftover manual-preview emoji so indices are correct. `addEmojiToComp` already calls `removeEmojiFromComp` internally on the *render* comps (Task 2), so this is an *additional*, separate call needed only on the layer-value target comp, which may or may not be one of the 4 render comps.
3. **The emoji step must run independently of the layer-value-application gate** (`current.compName && cfg.layers.length > 0`) — it needs to fire even when neither is true (emoji-only mode), and it targets all 4 `ITR_SUFFIXES` render comps, not the single layer-value target comp.
4. **The emoji footage's `.name` must be captured into a variable before `app.project.close()`** — the `FootageItem` reference itself is invalidated by close/reopen, exactly like VAR mode already had to handle for render-comp references.
5. **The captured emoji footage name must be added to `cleanProject`'s protected-names list**, alongside the 4 render-comp names, so `cleanProject`'s unused-item pass doesn't delete it before the next iteration needs it.

- [ ] **Step 1: Read the current file**

```bash
cat ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts
```

Confirm it already has Task 3's `resolveLayer` swap (the layer-apply loop should already read `const layer = resolveLayer(comp, lc);`, not a plain `comp.layer(lc.index)`).

- [ ] **Step 2: Add the imports**

Change:

```ts
import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { findCompByName, findCompsBySuffixes, resolveLayer, ITR_SUFFIXES } from "../lib/findComp";
import type { RunConfig, RunResult } from "../../../shared/types";
```

to:

```ts
import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { addEmojiToComp, removeEmojiFromComp } from "../lib/applyEmoji";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { findCompByName, findCompsBySuffixes, resolveLayer, ITR_SUFFIXES } from "../lib/findComp";
import type { RunConfig, RunResult } from "../../../shared/types";
```

- [ ] **Step 3: Add `removeEmojiFromComp` to the layer-apply block**

Find:

```ts
        app.beginUndoGroup("Iteration " + (iter + 1));
        for (let li = 0; li < cfg.layers.length; li++) {
          const lc = cfg.layers[li];
          const layer = resolveLayer(comp, lc);
```

and change it to:

```ts
        app.beginUndoGroup("Iteration " + (iter + 1));
        removeEmojiFromComp(comp); // clear any leftover preview emoji before trusting layer indices
        for (let li = 0; li < cfg.layers.length; li++) {
          const lc = cfg.layers[li];
          const layer = resolveLayer(comp, lc);
```

- [ ] **Step 4: Add the emoji block**

Find the closing of the layer-apply `if` block and the save/close/reopen that follows it:

```ts
        if (strategy.perIterationExtra) strategy.perIterationExtra(comp, iter);
      }

      app.project.save(current.file);
```

and insert the emoji block between them, so it reads:

```ts
        if (strategy.perIterationExtra) strategy.perIterationExtra(comp, iter);
      }

      // Emoji is independent of the layer-value gate above — it must run
      // even in emoji-only mode (no comp/layers selected), and it targets
      // all 4 render comps, not the single layer-value target comp.
      let emojiFootageName: string | null = null;
      if (cfg.emoji && cfg.emoji.enabled) {
        const emojiPath = cfg.emoji.perIteration[iter];
        if (emojiPath) {
          // Import once for this iteration; suppress must be OFF for
          // importFile to work. Both halves of this pair are inside the
          // loop body, so there's no cross-iteration suppression gap.
          app.endSuppressDialogs(false);
          let emojiFootage: FootageItem | null = null;
          try {
            const emojiFile = new File(emojiPath);
            if (emojiFile.exists) {
              emojiFootage = app.project.importFile(new ImportOptions(emojiFile)) as FootageItem;
            } else {
              warnings.push("Iter " + (iter + 1) + " emoji: file not found");
            }
          } catch (e: any) {
            warnings.push("Iter " + (iter + 1) + " emoji import: " + e.message);
          }
          app.beginSuppressDialogs();

          if (emojiFootage) {
            emojiFootageName = emojiFootage.name; // captured before close invalidates the reference
            const emojiComps = findCompsBySuffixes(ITR_SUFFIXES);
            for (let es = 0; es < ITR_SUFFIXES.length; es++) {
              const emojiComp = emojiComps[ITR_SUFFIXES[es]];
              if (!emojiComp) continue;
              try {
                addEmojiToComp(emojiComp, emojiFootage, cfg.emoji.x, cfg.emoji.y, cfg.emoji.layerIndex, cfg.emoji.size);
              } catch (e: any) {
                warnings.push("Iter " + (iter + 1) + " emoji [" + ITR_SUFFIXES[es] + "]: " + e.message);
              }
            }
          }
        }
      }

      app.project.save(current.file);
```

- [ ] **Step 5: Protect the emoji footage name during clean**

Find:

```ts
      const protectedNames: string[] = [];
      for (let s = 0; s < ITR_SUFFIXES.length; s++) {
        const comp = itrComps[ITR_SUFFIXES[s]];
        if (comp) protectedNames.push(comp.name);
      }
      try {
        cleanProject(protectedNames);
```

and change it to:

```ts
      const protectedNames: string[] = [];
      for (let s = 0; s < ITR_SUFFIXES.length; s++) {
        const comp = itrComps[ITR_SUFFIXES[s]];
        if (comp) protectedNames.push(comp.name);
      }
      if (emojiFootageName) protectedNames.push(emojiFootageName);
      try {
        cleanProject(protectedNames);
```

- [ ] **Step 6: Verify the build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected (no test file for this orchestration function — AE-object-model code), build exits 0.

**Now do the critical verification** — inspect the compiled `dist/cep/jsx/index.js` and trace the compiled `runIterationBatch` body, not just the source, confirming:
- The emoji block's `endSuppressDialogs`/`beginSuppressDialogs` pair sits fully inside the loop, both calls present on every path through the loop body (not hoisted outside by any bundler transform).
- `emojiFootageName` is read from `emojiFootage.name` **before** the later `app.project.close()`/`app.open()` calls for save/reopen.
- The protected-names array includes `emojiFootageName` before `cleanProject` is called.

This is the single most important check in this task — trace it against the compiled output, matching the rigor already applied to VAR mode's Task 9.

- [ ] **Step 7: Self-review against the 5 "watch out for" items**

Before committing, check each of Task 6's 5 numbered items above against your actual final code, one by one, explicitly, and note in your report which line(s) satisfy each one.

- [ ] **Step 8: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts
git commit -m "feat: integrate emoji overlay into runIterationBatch"
```

---

### Task 7: Store — emoji state

**Files:**
- Modify: `ae-iterations-next/src/js/main/state/store.ts`
- Modify: `ae-iterations-next/src/js/main/state/store.test.ts`

**Interfaces:**
- Produces: `emojiEnabled: boolean`, `emojiPaths: (string | null)[]`, `emojiX/Y/Size/LayerIndex: number`, and setters `setEmojiEnabled`, `setEmojiPath(iter, path)`, `setEmojiX/Y/Size/LayerIndex`. Consumed by Task 8/9's components and Task 10's `RunButton`.

- [ ] **Step 1: Write the failing tests**

Open `ae-iterations-next/src/js/main/state/store.test.ts` and add this new `describe` block at the end of the file:

```ts
describe("emoji state", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: null, layerInfo: [], rowLayers: [], count: 5, sameForAll: true, values: {},
      mode: "itr", varNames: [],
      emojiEnabled: false, emojiPaths: [], emojiX: 540, emojiY: 1347, emojiSize: 100, emojiLayerIndex: 1,
    });
  });

  it("defaults match the original extension's shared config", () => {
    const s = useAppStore.getState();
    expect(s.emojiEnabled).toBe(false);
    expect(s.emojiX).toBe(540);
    expect(s.emojiY).toBe(1347);
    expect(s.emojiSize).toBe(100);
    expect(s.emojiLayerIndex).toBe(1);
  });

  it("setEmojiPath sets a path at the given index without disturbing others", () => {
    useAppStore.getState().setEmojiPath(0, "/emojis/a.gif");
    useAppStore.getState().setEmojiPath(2, "/emojis/b.gif");
    expect(useAppStore.getState().emojiPaths[0]).toBe("/emojis/a.gif");
    expect(useAppStore.getState().emojiPaths[2]).toBe("/emojis/b.gif");
    expect(useAppStore.getState().emojiPaths[1]).toBeUndefined();
  });

  it("setEmojiEnabled/X/Y/Size/LayerIndex update their fields independently", () => {
    useAppStore.getState().setEmojiEnabled(true);
    useAppStore.getState().setEmojiX(100);
    useAppStore.getState().setEmojiY(200);
    useAppStore.getState().setEmojiSize(50);
    useAppStore.getState().setEmojiLayerIndex(3);
    const s = useAppStore.getState();
    expect(s.emojiEnabled).toBe(true);
    expect(s.emojiX).toBe(100);
    expect(s.emojiY).toBe(200);
    expect(s.emojiSize).toBe(50);
    expect(s.emojiLayerIndex).toBe(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `emojiEnabled`/`emojiPaths`/etc. don't exist on the store yet.

- [ ] **Step 3: Add the state and setters**

Open `ae-iterations-next/src/js/main/state/store.ts`. Add these fields to the `AppState` interface, after `setVarName(index: number, name: string): void;`:

```ts
  emojiEnabled: boolean;
  emojiPaths: (string | null)[];
  emojiX: number;
  emojiY: number;
  emojiSize: number;
  emojiLayerIndex: number;
  setEmojiEnabled(v: boolean): void;
  setEmojiPath(iter: number, path: string | null): void;
  setEmojiX(v: number): void;
  setEmojiY(v: number): void;
  setEmojiSize(v: number): void;
  setEmojiLayerIndex(v: number): void;
```

Then add the implementation, after the existing `setVarName` implementation:

```ts
  emojiEnabled: false,
  emojiPaths: [],
  emojiX: 540,
  emojiY: 1347,
  emojiSize: 100,
  emojiLayerIndex: 1,
  setEmojiEnabled: (v) => set({ emojiEnabled: v }),
  setEmojiPath: (iter, path) =>
    set((s) => {
      const arr = [...s.emojiPaths];
      arr[iter] = path;
      return { emojiPaths: arr };
    }),
  setEmojiX: (v) => set({ emojiX: v }),
  setEmojiY: (v) => set({ emojiY: v }),
  setEmojiSize: (v) => set({ emojiSize: v }),
  setEmojiLayerIndex: (v) => set({ emojiLayerIndex: v }),
```

(These are plain fields at the top level of `AppState`, not a nested object — matching the `varNames` convention already used in this store, not a nested `emoji: {...}` object.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/state/store.ts ae-iterations-next/src/js/main/state/store.test.ts
git commit -m "feat: add emoji state fields and setters to store"
```

---

### Task 8: `EmojiPickerGrid` component

**Files:**
- Create: `ae-iterations-next/src/js/main/components/EmojiPickerGrid.tsx`
- Create: `ae-iterations-next/src/js/main/components/EmojiPickerGrid.test.tsx`

**Interfaces:**
- Consumes: `listEmojiFiles` host command (Task 4).
- Produces: `EmojiPickerGrid({ onSelect: (path: string, name: string) => void })`. Consumed by Task 9 (`EmojiSection`).

- [ ] **Step 1: Write the failing tests**

Create `ae-iterations-next/src/js/main/components/EmojiPickerGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiPickerGrid } from "./EmojiPickerGrid";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() =>
    Promise.resolve({
      files: [
        { path: "/emojis/fire.gif", name: "fire.gif" },
        { path: "/emojis/heart.gif", name: "heart.gif" },
      ],
    })
  ),
}));

describe("EmojiPickerGrid", () => {
  it("renders one thumbnail per returned file", async () => {
    render(<EmojiPickerGrid onSelect={() => {}} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTitle("fire.gif")).toBeInTheDocument();
    expect(screen.getByTitle("heart.gif")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked file's path and name", async () => {
    const onSelect = vi.fn();
    render(<EmojiPickerGrid onSelect={onSelect} />);
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByTitle("fire.gif"));
    expect(onSelect).toHaveBeenCalledWith("/emojis/fire.gif", "fire.gif");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./EmojiPickerGrid` doesn't exist yet.

- [ ] **Step 3: Create the component**

Create `ae-iterations-next/src/js/main/components/EmojiPickerGrid.tsx`:

```tsx
import { useEffect, useState } from "react";
import { evalTS } from "../../lib/utils/bolt";

interface EmojiFile {
  path: string;
  name: string;
}

export function EmojiPickerGrid({ onSelect }: { onSelect: (path: string, name: string) => void }) {
  const [files, setFiles] = useState<EmojiFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    evalTS("listEmojiFiles")
      .then((res) => setFiles(res.files))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return <div className="emoji-empty">{error}</div>;
  if (!files) return <div className="emoji-empty">Loading…</div>;
  if (files.length === 0) return <div className="emoji-empty">No emoji files found.</div>;

  return (
    <div id="emoji-picker-grid">
      {files.map((f) => (
        <div key={f.path} className="emoji-grid-item" title={f.name} onClick={() => onSelect(f.path, f.name)}>
          <img src={"file://" + f.path} alt={f.name} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the 2 new ones.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/EmojiPickerGrid.tsx ae-iterations-next/src/js/main/components/EmojiPickerGrid.test.tsx
git commit -m "feat: add EmojiPickerGrid component"
```

---

### Task 9: `EmojiSection` component

**Files:**
- Create: `ae-iterations-next/src/js/main/components/EmojiSection.tsx`
- Create: `ae-iterations-next/src/js/main/components/EmojiSection.test.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- Consumes: store emoji fields/setters (Task 7), `EmojiPickerGrid` (Task 8), `previewEmoji` host command (Task 5).
- Produces: `EmojiSection()` — no props. Consumed by Task 10 (`LayerInfoPanel`).

- [ ] **Step 1: Write the failing tests**

Create `ae-iterations-next/src/js/main/components/EmojiSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiSection } from "./EmojiSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn((command: string) => {
    if (command === "listEmojiFiles") {
      return Promise.resolve({ files: [{ path: "/emojis/fire.gif", name: "fire.gif" }] });
    }
    if (command === "previewEmoji") {
      return Promise.resolve({ compName: "Comp A" });
    }
    return Promise.reject(new Error("unexpected command: " + command));
  }),
}));

describe("EmojiSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      count: 3, emojiEnabled: false, emojiPaths: [], emojiX: 540, emojiY: 1347, emojiSize: 100, emojiLayerIndex: 1,
    });
  });

  it("hides the config until enabled is checked", () => {
    render(<EmojiSection />);
    expect(screen.queryByText("Preview Emoji")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Add emoji overlay"));
    expect(screen.getByText("Preview Emoji")).toBeInTheDocument();
  });

  it("opens the picker grid on thumbnail click and assigns the selected emoji to that row", async () => {
    useAppStore.setState({ emojiEnabled: true });
    render(<EmojiSection />);
    fireEvent.click(screen.getAllByText("+")[0]); // first row's empty thumbnail
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByTitle("fire.gif"));
    expect(useAppStore.getState().emojiPaths[0]).toBe("/emojis/fire.gif");
    expect(screen.getByText("fire.gif")).toBeInTheDocument();
  });

  it("previews using the first row with a path set", async () => {
    useAppStore.setState({ emojiEnabled: true, emojiPaths: [null, "/emojis/heart.gif"] });
    render(<EmojiSection />);
    fireEvent.click(screen.getByText("Preview Emoji"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText(/Previewed in Comp A/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./EmojiSection` doesn't exist yet.

- [ ] **Step 3: Create the component**

Create `ae-iterations-next/src/js/main/components/EmojiSection.tsx`:

```tsx
import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS } from "../../lib/utils/bolt";
import { EmojiPickerGrid } from "./EmojiPickerGrid";

export function EmojiSection() {
  const {
    emojiEnabled, emojiPaths, emojiX, emojiY, emojiSize, emojiLayerIndex, count,
    setEmojiEnabled, setEmojiPath, setEmojiX, setEmojiY, setEmojiSize, setEmojiLayerIndex,
  } = useAppStore(
    useShallow((s) => ({
      emojiEnabled: s.emojiEnabled, emojiPaths: s.emojiPaths, emojiX: s.emojiX, emojiY: s.emojiY,
      emojiSize: s.emojiSize, emojiLayerIndex: s.emojiLayerIndex, count: s.count,
      setEmojiEnabled: s.setEmojiEnabled, setEmojiPath: s.setEmojiPath, setEmojiX: s.setEmojiX,
      setEmojiY: s.setEmojiY, setEmojiSize: s.setEmojiSize, setEmojiLayerIndex: s.setEmojiLayerIndex,
    }))
  );
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState("");

  const toggleRow = (iter: number) => setOpenRow(openRow === iter ? null : iter);

  const selectEmoji = (iter: number, path: string) => {
    setEmojiPath(iter, path);
    setOpenRow(null);
  };

  const previewEmoji = () => {
    const firstPath = emojiPaths.find((p) => !!p);
    if (!firstPath) {
      setPreviewStatus("Select an emoji first.");
      return;
    }
    setPreviewStatus("Previewing…");
    evalTS("previewEmoji", { emojiPath: firstPath, x: emojiX, y: emojiY, size: emojiSize, layerIndex: emojiLayerIndex })
      .then((res) => setPreviewStatus(`Previewed in ${res.compName} — Ctrl+Z to undo`))
      .catch((err) => setPreviewStatus("Preview failed: " + String(err)));
  };

  return (
    <div id="emoji-section">
      <label className="emoji-enable-label">
        <input type="checkbox" checked={emojiEnabled} onChange={(e) => setEmojiEnabled(e.target.checked)} />
        Add emoji overlay
      </label>
      {emojiEnabled && (
        <div id="emoji-config">
          <div className="emoji-pos-row">
            <label>
              X
              <input type="number" value={emojiX} onChange={(e) => setEmojiX(parseInt(e.target.value, 10) || 0)} />
            </label>
            <label>
              Y
              <input type="number" value={emojiY} onChange={(e) => setEmojiY(parseInt(e.target.value, 10) || 0)} />
            </label>
            <label>
              Size
              <input type="number" value={emojiSize} onChange={(e) => setEmojiSize(parseInt(e.target.value, 10) || 100)} />
            </label>
            <label>
              Layer
              <input
                type="number"
                value={emojiLayerIndex}
                onChange={(e) => setEmojiLayerIndex(parseInt(e.target.value, 10) || 1)}
              />
            </label>
          </div>
          <div id="emoji-iter-rows">
            {Array.from({ length: count }, (_, iter) => {
              const path = emojiPaths[iter];
              const name = path ? path.split("/").pop() : "No emoji";
              return (
                <div key={iter} className="emoji-iter-row">
                  <span className="emoji-iter-num">{iter + 1}</span>
                  <div className={"emoji-iter-thumb" + (path ? " has-emoji" : "")} onClick={() => toggleRow(iter)}>
                    {path ? <img src={"file://" + path} alt={name} /> : "+"}
                  </div>
                  <span className="emoji-iter-name">{name}</span>
                  {openRow === iter && <EmojiPickerGrid onSelect={(p) => selectEmoji(iter, p)} />}
                </div>
              );
            })}
          </div>
          <button onClick={previewEmoji}>Preview Emoji</button>
          {previewStatus && <div className="emoji-preview-status">{previewStatus}</div>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Add baseline styling**

Open `ae-iterations-next/src/js/main/main.scss` and add this block at the end of the file:

```scss
// ── Emoji overlay ─────────────────────────────────────────────────────────

#emoji-section {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid $dark;
}

.emoji-enable-label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
}

#emoji-config {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.4rem;
}

.emoji-pos-row {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;

  label {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    font-size: 0.7rem;
    color: $highlight;
  }

  input[type="number"] {
    width: 3.2rem;
  }
}

#emoji-iter-rows {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.emoji-iter-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.emoji-iter-num {
  width: 1.2rem;
  color: $highlight;
  font-size: 0.7rem;
}

.emoji-iter-thumb {
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid $dark;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: $highlight;
  flex-shrink: 0;

  &:hover {
    border-color: $active;
  }

  &.has-emoji {
    border-color: rgba($active, 0.6);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
}

.emoji-iter-name {
  font-size: 0.7rem;
  color: $font;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

#emoji-picker-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.2rem;
  max-height: 8rem;
  overflow-y: auto;
  padding: 0.3rem;
  background-color: $darker;
  border-radius: 4px;
  margin: 0.2rem 0;
}

.emoji-grid-item {
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    border-color: rgba($active, 0.5);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
}

.emoji-empty {
  font-size: 0.7rem;
  color: $highlight;
  padding: 0.3rem;
}

.emoji-preview-status {
  font-size: 0.7rem;
  color: $highlight;
}
```

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/EmojiSection.tsx ae-iterations-next/src/js/main/components/EmojiSection.test.tsx ae-iterations-next/src/js/main/main.scss
git commit -m "feat: add EmojiSection component"
```

---

### Task 10: Final panel wiring — mode-gated section, mode-aware Run, manual verification recipe

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/components/RunButton.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: the complete, usable emoji overlay flow.

- [ ] **Step 1: Render `EmojiSection` in `LayerInfoPanel`, gated on ITR mode**

Open `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`. Add the import:

```ts
import { EmojiSection } from "./EmojiSection";
```

Find this block:

```tsx
      {mode === "itr" && rowLayers.length > 0 && (
        <div id="preview-row">
          {Array.from({ length: count }, (_, iter) => (
            <button key={iter} className="preview-btn" onClick={() => previewIteration(iter)}>
              Preview {iter + 1}
            </button>
          ))}
        </div>
      )}
```

and add `EmojiSection` right after it (still inside the same returned JSX, before the `mode === "var"` block):

```tsx
      {mode === "itr" && rowLayers.length > 0 && (
        <div id="preview-row">
          {Array.from({ length: count }, (_, iter) => (
            <button key={iter} className="preview-btn" onClick={() => previewIteration(iter)}>
              Preview {iter + 1}
            </button>
          ))}
        </div>
      )}
      {mode === "itr" && <EmojiSection />}
```

Note this renders `EmojiSection` unconditionally in ITR mode, regardless of `rowLayers.length` — unlike the preview row, emoji doesn't require a layer selection at all (it's the "emoji-only run" case), so it must not be nested inside that `rowLayers.length > 0` condition.

- [ ] **Step 2: Make `RunButton` mode-aware for emoji-only runs**

Open `ae-iterations-next/src/js/main/components/RunButton.tsx`. Read the current file in full first — it already has `useShallow` and status/statusKind state from an earlier bug fix; match that exactly.

Replace the whole file with:

```tsx
import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { toCfgLayers } from "../state/rowLayers";
import { evalTS } from "../../lib/utils/bolt";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue, RunResult } from "../../../shared/types";

type StatusKind = "idle" | "running" | "done" | "warning" | "error";

export function RunButton({ effectiveValue }: { effectiveValue: (row: RowLayer, iter: number) => LayerValue | undefined }) {
  const {
    compName, rowLayers, count, mode, varNames,
    emojiEnabled, emojiPaths, emojiX, emojiY, emojiSize, emojiLayerIndex,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, rowLayers: s.rowLayers, count: s.count, mode: s.mode, varNames: s.varNames,
      emojiEnabled: s.emojiEnabled, emojiPaths: s.emojiPaths, emojiX: s.emojiX, emojiY: s.emojiY,
      emojiSize: s.emojiSize, emojiLayerIndex: s.emojiLayerIndex,
    }))
  );
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");

  const emojiOnly = mode === "itr" && emojiEnabled;

  const handleResult = (res: RunResult, noun: string) => {
    if (res.warnings.length) {
      setStatus(`Done with warnings: ${res.warnings.join(" | ")}`);
      setStatusKind("warning");
    } else {
      setStatus(`Done — ${count} ${noun} complete.`);
      setStatusKind("done");
    }
  };
  const handleError = (err: unknown) => {
    setStatus("Error: " + String(err));
    setStatusKind("error");
  };

  const run = () => {
    if (!compName && !emojiOnly) {
      setStatus("Refresh a layer first.");
      setStatusKind("error");
      return;
    }
    const layers = toCfgLayers(rowLayers);
    const values = Array.from({ length: count }, (_, iter) => rowLayers.map((r) => effectiveValue(r, iter) ?? {}));

    if (mode === "var") {
      setStatus("Running VAR…");
      setStatusKind("running");
      const names = Array.from({ length: count }, (_, i) => varNames[i] || `VAR${i + 1}`);
      evalTS("runVarIterations", { compName: compName || "", layers, values, count, varNames: names })
        .then((res) => handleResult(res, "variants"))
        .catch(handleError);
    } else {
      setStatus("Running…");
      setStatusKind("running");
      const emoji = {
        enabled: emojiEnabled,
        perIteration: Array.from({ length: count }, (_, i) => emojiPaths[i] ?? null),
        x: emojiX,
        y: emojiY,
        size: emojiSize,
        layerIndex: emojiLayerIndex,
      };
      evalTS("runIterations", { compName: compName || "", layers, values, count, emoji })
        .then((res) => handleResult(res, "iterations"))
        .catch(handleError);
    }
  };

  return (
    <div id="run-section">
      <button id="btn-run" onClick={run} disabled={!compName && !emojiOnly}>
        {mode === "var" ? "Run VAR" : "Run Iterations"}
      </button>
      {status && <div id="status" className={`status-${statusKind}`}>{status}</div>}
    </div>
  );
}
```

The `emoji` object is now always sent on ITR runs (with `enabled: false` and the store's current shared config when the checkbox is off) rather than a partial `{enabled: false}` object — functionally identical to the original (the host only reads the other emoji fields when `enabled` is true), and keeps `RunConfig.emoji` fully and consistently typed at every call site.

- [ ] **Step 3: Run the full test suite**

```bash
cd ae-iterations-next
npm run test
```

Expected: PASS, no regressions across the whole suite. Pay particular attention to whether any existing test for `RunButton`/`LayerInfoPanel` exists and still passes with the added `emojiOnly` branch.

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx ae-iterations-next/src/js/main/components/RunButton.tsx
git commit -m "feat: wire EmojiSection into panel, mode-aware emoji-only Run gating"
```

- [ ] **Step 6: Write the manual verification recipe**

This is the real acceptance test for the whole plan — no subagent can perform it (no GUI access to After Effects). Write the following recipe into your task report:

**Setup:**
1. Pick or create a real ITR test project matching the naming convention, containing the 4 render precomps ending in `_ITR_9x16`, `_ITR_1x1`, `_ITR_16x9`, `_ITR_4x5`.
2. Build and reload the extension (`npm run build`, reopen the "AE Iterations (Next)" panel in AE).

**Test emoji Preview:**
3. Switch to (or confirm) ITR mode, check "Add emoji overlay", click a picker row's thumbnail — confirm the grid opens showing real thumbnails from the bundled `emojis/` folder. Click one — confirm it's assigned to that row and the grid closes.
4. Click "Preview Emoji" — confirm the emoji appears in the active comp at the configured x/y/size/layer-index, and that Ctrl+Z removes it cleanly.

**Test emoji-only run:**
5. Without clicking Refresh (no layer selected at all), with emoji enabled and at least one row's emoji set, click "Run Iterations" — confirm the button is enabled and the run actually starts (not blocked by "Refresh a layer first.").
6. Confirm the run completes with a status showing either "Done — N iterations complete." or a specific, readable warning list.
7. For each iteration's output folder, confirm the emoji appears (baked into the rendered PNGs/videos) at the correct position, and that different iterations show different emojis if different files were picked.

**Test combined run (layer values + emoji together):**
8. Click Refresh with a real layer selection, set colors/fonts for a few iterations, also enable emoji with per-iteration files set, click "Run Iterations".
9. Confirm both the layer values AND the emoji are correctly applied in each iteration's output — this is the scenario `resolveLayer`'s name-fallback exists to protect, since a prior "Preview Emoji" click (step 4) may have left a temporary layer in the comp before this run started.
10. Confirm the emoji layer (`AEITER_EMOJI`) never appears in the final collected project's *previous* iteration's copy — i.e., each iteration's emoji is fresh, not accumulated on top of the last one.

If any step from 5-10 fails, trace the specific failing step against Task 6's "watch out for" list before assuming it's an environment issue.

---

## Self-Review Notes

- **Spec coverage:** every decision in the design spec (ITR-only scope, emoji-only run capability, shared position/size config, visual thumbnail grid picker, `resolveLayer` reintroduction, asset bundling via `publicDir` referencing `extension/emojis/` directly) has a corresponding task.
- **Type consistency checked:** `EmojiConfig` (Task 1) is used unmodified through Tasks 5, 6, 7, 9, 10 — same field names (`enabled`, `perIteration`, `x`, `y`, `size`, `layerIndex`) everywhere. `resolveLayer(comp, lc)` (Task 3) has the same signature everywhere it's called (Task 3's own two call sites, Task 6). `EMOJI_LAYER_NAME`/`removeEmojiFromComp`/`addEmojiToComp` (Task 2) are used with identical signatures in Tasks 5 and 6.
- **No placeholders:** every task ships complete, real code — either a faithful port with an explicitly-labeled deviation (Task 2's import-once-per-caller split, Task 4's `publicDir`-reference-not-copy correction) or fresh code whose contract is derived from a real call site in the committed `extension/jsx/host.jsx` or `extension/js/main.js`.
