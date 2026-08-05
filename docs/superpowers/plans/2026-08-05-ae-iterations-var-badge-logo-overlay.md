# Badge + Logo Overlays for VAR Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new VAR-mode-only overlays to `ae-iterations-next` — a circle+free-text "badge" (per-iteration text) and a logo image (fixed across iterations, picked from a user-maintained folder) — each with raw X/Y/Size fields plus an optional visual drag-to-position popup, fully wired into VAR's run loop and its existing Preview mechanism.

**Architecture:** Badge is built from scratch every apply via AE's shape/text layer creation APIs (no existing asset to import). Logo reuses Emoji's existing image-overlay mechanics via a newly extracted shared helper (`applyImageOverlay.ts`). Both are independent of the existing per-layer `applyLayerValue` dispatch, applied only to the `"9x16"` VAR render comp, and integrated into both `runVarIterationBatch.ts` (real runs) and `previewApply` (live preview, reusing the row-level Preview button already wired for VAR mode). The logo picker sources from a new cross-platform, outside-the-extension folder (mirroring `userPresets.ts`'s location convention), scanned via Node `fs` panel-side — no host round-trip needed for listing. The position picker is a new shared popup component that renders an on-demand comp snapshot and lets the user drag a marker, writing into the same store fields the numeric X/Y inputs already use.

**Tech Stack:** BoltCEP (React + TypeScript + Vite), Zustand, ExtendScript (aeft/host side), Vitest + React Testing Library.

**Design spec:** `docs/superpowers/specs/2026-08-05-ae-iterations-var-badge-logo-overlay-design.md`

## Global Constraints

- Badge and logo overlays are **VAR-mode only** — ITR mode's existing Emoji overlay is untouched except for one mechanical extraction (Task 2).
- Badge and logo can both be active **at once** (stacked), each independently toggleable.
- Badge text is **per-iteration and free text** (e.g. "25+"), not limited to numbers.
- Logo is **one fixed image shared across all iterations**, picked from a thumbnail grid backed by a user-maintained folder — never a raw OS file-browse dialog.
- Position uses **raw X/Y number fields** as the source of truth, matching Emoji's existing UI, supplemented (not replaced) by an optional visual drag-to-position popup shared by both overlays.
- Badge/logo layers are added **only to the `"9x16"` entry of `VAR_ASPECT_SUFFIXES`** (`["9x16", "1x1", "16x9", "4x5"]`), never the other three.
- Colors (`circleColor`, `textColor`) are **0-1 float RGB triples**, matching this codebase's existing convention for all AE color values (`LayerValue.color`, `VideoState.tint`, etc. — confirmed via `applyChange.ts`'s `current.property("Color").setValue(colorRGB)` passing the array straight through with no scaling).
- `.aep`-UI import is **out of scope** for this plan entirely — do not attempt it.
- No change to the current production `extension/` — this plan applies only to `ae-iterations-next`.
- Host-command convention: exported `aeft.ts` functions throw `Error` on failure, return a typed payload directly on success.
- No automated tests for AE-object-model host-side code (`src/jsx/aeft/**`) — established precedent. Panel-side code (`src/js/main/**`) gets Vitest + React Testing Library tests, and pure Node-fs-touching panel-side utilities get `// @vitest-environment node` unit tests (matching `userPresets.test.ts`).
- Any `useAppStore(selector)` returning a new object literal MUST be wrapped in `useShallow` from `zustand/react/shallow` — an unwrapped object-returning selector throws React error #185 and blacks out the whole panel (a real production incident earlier in this project).
- `types-for-adobe`'s ambient AE types have known gaps — verify against the real `node_modules/types-for-adobe/AfterEffects/22.0/index.d.ts` before reaching for an `any` cast; don't guess. (This plan has already verified `ShapeLayer.addShape()`, `TextLayer.addText()`, `ParagraphJustification.CENTER_JUSTIFY`, and `Layer.sourceRectAtTime()` against that file — see Task 4.)

---

### Task 1: Shared types — `BadgeConfig`, `LogoConfig`

**Files:**
- Modify: `ae-iterations-next/src/shared/types.ts`

**Interfaces:**
- Produces: `BadgeConfig`, `LogoConfig` interfaces, and `RunVarConfig.badge?: BadgeConfig` / `RunVarConfig.logo?: LogoConfig`. Consumed by every later task in this plan (host and panel side both).

- [ ] **Step 1: Add the two interfaces and extend `RunVarConfig`**

Open `ae-iterations-next/src/shared/types.ts`. Add these two interfaces anywhere after `EmojiConfig` and before `CfgLayer`:

```ts
export interface BadgeConfig {
  enabled: boolean;
  perIteration: (string | null)[]; // badge text per iteration, count-length — free text, e.g. "25+"
  x: number;
  y: number;
  size: number; // uniform scale percentage, same convention as EmojiConfig
  circleColor: [number, number, number];
  textColor: [number, number, number];
}

export interface LogoConfig {
  enabled: boolean;
  path: string | null; // path to a file inside the logo library folder (see logoLibrary.ts)
  x: number;
  y: number;
  size: number;
}
```

Then change the existing `RunVarConfig` interface from:

```ts
export interface RunVarConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][]; // [iter][layer row index], matching `layers` order
  varNames: string[];
  count: number;
}
```

to:

```ts
export interface RunVarConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][]; // [iter][layer row index], matching `layers` order
  varNames: string[];
  count: number;
  badge?: BadgeConfig;
  logo?: LogoConfig;
}
```

Do not touch `RunConfig`/`EmojiConfig` (ITR) — badge/logo are VAR-only, per the Global Constraints.

- [ ] **Step 2: Verify the build**

```bash
cd ae-iterations-next
npm run build
```

Expected: exit 0. Pure type change, no runtime logic — `tsc`'s pass is the verification.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/src/shared/types.ts
git commit -m "feat: add BadgeConfig/LogoConfig types and RunVarConfig fields"
```

---

### Task 2: Extract `applyImageOverlay.ts` from `applyEmoji.ts`

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/applyImageOverlay.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/lib/applyEmoji.ts`

**Interfaces:**
- Produces: `addImageOverlayToComp(comp, footage, layerName, x, y, targetIndex, size): void`, `removeImageOverlayFromComp(comp, layerName): void`. Consumed by this task's own `applyEmoji.ts` rewrite, and by Task 3's `applyLogo.ts`.

`addEmojiToComp`/`removeEmojiFromComp`'s bodies are 100% generic except for the hardcoded `EMOJI_LAYER_NAME` — this task extracts that generic logic so Logo (Task 3) can reuse it instead of duplicating ~50 lines. This is the **only** touch to ITR's shipped emoji code path in this entire plan, and it is purely mechanical: same calls, same order, no behavior change.

- [ ] **Step 1: Create the shared helper**

Create `ae-iterations-next/src/jsx/aeft/lib/applyImageOverlay.ts`:

```ts
// lib/applyImageOverlay.ts — generic add/remove for a looping, time-remapped
// image overlay layer, identified by a caller-supplied sentinel name.
// Extracted from applyEmoji.ts's addEmojiToComp/removeEmojiFromComp (which
// were 100% generic except for the hardcoded EMOJI_LAYER_NAME) so Logo
// overlay (lib/applyLogo.ts) can reuse the exact same mechanics instead of
// duplicating them. applyEmoji.ts now wraps this with EMOJI_LAYER_NAME —
// same calls, same order, no behavior change for the shipped ITR feature.

// Remove any previously placed overlay layer matching layerName from the comp.
export function removeImageOverlayFromComp(comp: CompItem, layerName: string): void {
  for (let i = comp.numLayers; i >= 1; i--) {
    try {
      if (comp.layer(i).name === layerName) comp.layer(i).remove();
    } catch (e) {}
  }
}

// comp:        CompItem to add the overlay into
// footage:     already-imported overlay FootageItem (shared across comps by caller)
// layerName:   sentinel name so this exact overlay can be found/removed later
// x, y:        position in comp pixels
// targetIndex: 1-based layer position from top (1 = topmost)
// size:        uniform scale percentage
export function addImageOverlayToComp(
  comp: CompItem,
  footage: FootageItem,
  layerName: string,
  x: number,
  y: number,
  targetIndex: number,
  size: number
): void {
  // Remove any overlay left over from a previous iteration
  removeImageOverlayFromComp(comp, layerName);

  // Add at index 1 (top of stack)
  const layer = comp.layers.add(footage);
  layer.name = layerName;

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

- [ ] **Step 2: Rewrite `applyEmoji.ts` as a thin wrapper**

Open `ae-iterations-next/src/jsx/aeft/lib/applyEmoji.ts`. Replace its entire contents with:

```ts
// lib/applyEmoji.ts — add/remove the emoji overlay layer. Thin wrapper
// around lib/applyImageOverlay.ts's generic mechanics (extracted here since
// Logo overlay, lib/applyLogo.ts, needs the exact same behavior). No change
// in behavior from the original inline implementation — same calls, same
// order, just parameterized by EMOJI_LAYER_NAME through the shared helper.

import { addImageOverlayToComp, removeImageOverlayFromComp } from "./applyImageOverlay";

export const EMOJI_LAYER_NAME = "AEITER_EMOJI";

export function removeEmojiFromComp(comp: CompItem): void {
  removeImageOverlayFromComp(comp, EMOJI_LAYER_NAME);
}

export function addEmojiToComp(
  comp: CompItem,
  footage: FootageItem,
  x: number,
  y: number,
  targetIndex: number,
  size: number
): void {
  addImageOverlayToComp(comp, footage, EMOJI_LAYER_NAME, x, y, targetIndex, size);
}
```

- [ ] **Step 3: Verify the build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected (no test file for either of these files — AE-object-model code), build exits 0.

- [ ] **Step 4: Manually re-verify ITR emoji still works**

This touches shipped, reviewed code with no automated test, so confirm by eye (not just by build success) that the wrapper is a byte-for-byte behavioral match: read `applyImageOverlay.ts`'s `addImageOverlayToComp` side-by-side with the original `addEmojiToComp` body from before this change (`git show HEAD:ae-iterations-next/src/jsx/aeft/lib/applyEmoji.ts` if you need to see the pre-change version) and confirm every statement is present in the same order with only `EMOJI_LAYER_NAME` substituted for the generic `layerName` parameter. If a live AE session is available, use it to click "Preview Emoji" in ITR mode and confirm the emoji still appears and Ctrl+Z still removes it cleanly — otherwise, note in your task report that this specific manual check was skipped for lack of a live session, so the final task (Task 12) knows to include it in the end-to-end verification recipe.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/applyImageOverlay.ts ae-iterations-next/src/jsx/aeft/lib/applyEmoji.ts
git commit -m "refactor: extract applyImageOverlay.ts generic helper from applyEmoji.ts"
```

---

### Task 3: `applyLogo.ts`

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/applyLogo.ts`

**Interfaces:**
- Consumes: `addImageOverlayToComp`/`removeImageOverlayFromComp` (Task 2).
- Produces: `LOGO_LAYER_NAME` (constant), `removeLogoFromComp(comp): void`, `addLogoToComp(comp, footage, x, y, size): void`. Consumed by Task 11 (`runVarIterationBatch.ts`) and Task 12 (`previewApply`).

- [ ] **Step 1: Create the file**

Create `ae-iterations-next/src/jsx/aeft/lib/applyLogo.ts`:

```ts
// lib/applyLogo.ts — add/remove the logo overlay layer (VAR mode). Thin
// wrapper around lib/applyImageOverlay.ts's generic mechanics, same pattern
// as applyEmoji.ts. Logo has no configurable layer-index (unlike Emoji) —
// BadgeConfig/LogoConfig deliberately omit it, per the design spec — so this
// always targets index 1 (top of stack).

import { addImageOverlayToComp, removeImageOverlayFromComp } from "./applyImageOverlay";

export const LOGO_LAYER_NAME = "AEITER_LOGO";

export function removeLogoFromComp(comp: CompItem): void {
  removeImageOverlayFromComp(comp, LOGO_LAYER_NAME);
}

export function addLogoToComp(comp: CompItem, footage: FootageItem, x: number, y: number, size: number): void {
  addImageOverlayToComp(comp, footage, LOGO_LAYER_NAME, x, y, 1, size);
}
```

- [ ] **Step 2: Verify the build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected, build exits 0.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/applyLogo.ts
git commit -m "feat: add applyLogo lib (add/remove logo overlay layer)"
```

---

### Task 4: `applyBadge.ts` — from-scratch shape+text layer creation (highest API risk in this plan)

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/applyBadge.ts`

**Interfaces:**
- Produces: `BADGE_CIRCLE_LAYER_NAME`, `BADGE_TEXT_LAYER_NAME` (constants), `removeBadgeFromComp(comp): void`, `addBadgeToComp(comp, text, x, y, size, circleColor, textColor): void`. Consumed by Task 11 (`runVarIterationBatch.ts`) and Task 12 (`previewApply`).

**This is the one genuinely new AE-scripting API surface in this plan.** Every other `lib/apply*.ts` file in this codebase manipulates layers that already exist (`applyChange.ts`, `applyVideo.ts`) or adds an *imported* footage item (`applyEmoji.ts`, `applyMedia.ts`, and now `applyImageOverlay.ts`) — none of them synthesize a shape or text layer from nothing. The match-names and API signatures below (`ADBE Vector Group`, `ADBE Vector Shape - Ellipse`, `ADBE Vector Graphic - Fill`, `ADBE Vector Ellipse Size`, `ADBE Vector Fill Color`, `sourceRectAtTime`, `ParagraphJustification.CENTER_JUSTIFY`) are standard, well-documented AE scripting APIs, and `ShapeLayer.addShape()`/`TextLayer.addText()`/`ParagraphJustification.CENTER_JUSTIFY`/`Layer.sourceRectAtTime()` have all been confirmed present in `node_modules/types-for-adobe/AfterEffects/22.0/index.d.ts` — but **none of this has been run against a real, live After Effects instance yet.** Treat this the same way this codebase already treats `Array.prototype.map`'s absence from the ExtendScript engine (discovered only by live probing, never by reading documentation) — write the code as specified below, but flag it explicitly for live verification rather than assuming correctness from the API shape alone.

- [ ] **Step 1: Create the file**

Create `ae-iterations-next/src/jsx/aeft/lib/applyBadge.ts`:

```ts
// lib/applyBadge.ts — add/remove a from-scratch circle+text "badge" overlay
// (VAR mode). Unlike every other overlay in this codebase (Emoji, Logo,
// Media), there is no existing asset to import here — the circle (a shape
// layer) and the text (a text layer) are synthesized directly via AE's
// vector-shape and text-layer scripting APIs. Both layers are sized as a
// percentage of a fixed base diameter/font size, matching
// EmojiConfig/LogoConfig's scale-percentage convention (size: 100 = no
// scaling).

export const BADGE_CIRCLE_LAYER_NAME = "AEITER_BADGE_CIRCLE";
export const BADGE_TEXT_LAYER_NAME = "AEITER_BADGE_TEXT";

const BASE_DIAMETER = 100; // comp pixels, before the `size` percentage scale
const BASE_FONT_SIZE = 40; // comp pixels, before the `size` percentage scale

export function removeBadgeFromComp(comp: CompItem): void {
  for (let i = comp.numLayers; i >= 1; i--) {
    try {
      const name = comp.layer(i).name;
      if (name === BADGE_CIRCLE_LAYER_NAME || name === BADGE_TEXT_LAYER_NAME) comp.layer(i).remove();
    } catch (e) {}
  }
}

export function addBadgeToComp(
  comp: CompItem,
  text: string,
  x: number,
  y: number,
  size: number,
  circleColor: [number, number, number],
  textColor: [number, number, number]
): void {
  removeBadgeFromComp(comp);
  const sz = size || 100;

  // Circle: a shape layer with one ellipse + one fill, centered on its own
  // anchor point so the layer's Position IS the circle's visual center.
  const circleLayer = comp.layers.addShape();
  circleLayer.name = BADGE_CIRCLE_LAYER_NAME;
  circleLayer.inPoint = 0;
  circleLayer.outPoint = comp.duration;

  const contents = circleLayer.property("Contents") as any;
  const group = contents.addProperty("ADBE Vector Group");
  const groupContents = group.property("Contents") as any;
  const ellipse = groupContents.addProperty("ADBE Vector Shape - Ellipse");
  ellipse.property("ADBE Vector Ellipse Size").setValue([BASE_DIAMETER, BASE_DIAMETER]);
  const fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
  fill.property("ADBE Vector Fill Color").setValue(circleColor);
  // Ellipse is drawn centered on the group's own transform origin, which
  // defaults to [0, 0] -- explicit here so a future AE version's default
  // can't silently shift it.
  group.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue([0, 0]);

  circleLayer.transform.anchorPoint.setValue([0, 0]);
  circleLayer.transform.position.setValue([x, y]);
  circleLayer.transform.scale.setValue([sz, sz]);

  // Text: added AFTER the circle, so it lands on top of it in the layer
  // stack (comp.layers.addText() always inserts at index 1 -- the circle,
  // added first, is now at index 2, directly below). No explicit reordering
  // needed for text-over-circle.
  const textLayer = comp.layers.addText(text);
  textLayer.name = BADGE_TEXT_LAYER_NAME;
  textLayer.inPoint = 0;
  textLayer.outPoint = comp.duration;

  const textProp = textLayer.property("Source Text") as any;
  const textDoc = textProp.value;
  textDoc.fontSize = BASE_FONT_SIZE;
  textDoc.fillColor = textColor;
  textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
  textProp.setValue(textDoc);

  // A fresh text layer's anchor point is at its baseline origin, not its
  // visual center -- sourceRectAtTime + anchorPoint is the standard AE
  // scripting technique for centering a text layer on an arbitrary point.
  const rect = textLayer.sourceRectAtTime(0, false);
  textLayer.transform.anchorPoint.setValue([rect.left + rect.width / 2, rect.top + rect.height / 2]);
  textLayer.transform.position.setValue([x, y]);
  textLayer.transform.scale.setValue([sz, sz]);
}
```

- [ ] **Step 2: Verify the build**

This file isn't imported anywhere yet (Task 11 wires it in), so confirm it at least type-checks within the project, then verify it bundles correctly via a throwaway scratch import (temporarily import `addBadgeToComp` into `aeft.ts`, run `npm run build`, inspect the compiled `dist/cep/jsx/index.js` to confirm the function's body appears, then revert the scratch import before committing) — this is the same pattern already used for `applyMedia.ts`/`applyEmoji.ts` in prior plans.

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected (AE-object-model code, no test file), build exits 0.

- [ ] **Step 3: Flag for live verification**

Note explicitly in your task report (for Task 12's final manual verification recipe to pick up): this file's ellipse/fill/text-centering code has been verified against `types-for-adobe`'s ambient types and standard AE scripting documentation conventions, but has **never been run against a real After Effects instance**. Specifically call out: does the ellipse render as a filled circle at the expected diameter; does the text visually center inside it; does `sourceRectAtTime(0, false)`'s returned `{top, left, width, height}` actually produce correct centering (a wrong sign or axis here would push the text off-center in a specific, diagnosable direction).

- [ ] **Step 4: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/applyBadge.ts
git commit -m "feat: add applyBadge lib (from-scratch circle+text overlay)"
```

---

### Task 5: `logoLibrary.ts` — cross-platform logo folder resolution + listing

**Files:**
- Create: `ae-iterations-next/src/js/main/lib/logoLibrary.ts`
- Create: `ae-iterations-next/src/js/main/lib/logoLibrary.test.ts`

**Interfaces:**
- Produces: `logoLibraryPath(platform?, env?, homedir?): string`, `listLogoFiles(dirPath?): string[]`. Consumed by Task 6 (`LogoPickerGrid`).

Mirrors `ae-iterations-next/src/js/main/lib/userPresets.ts`'s cross-platform path resolution exactly. Unlike `userPresets.ts`, there's no save function here — the user manages the folder's contents directly via Finder/Explorer; this file only resolves the path and lists what's in it.

- [ ] **Step 1: Write the failing tests**

Create `ae-iterations-next/src/js/main/lib/logoLibrary.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { logoLibraryPath, listLogoFiles } from "./logoLibrary";

vi.mock("fs");

describe("logoLibraryPath", () => {
  it("resolves the macOS Application Support path", () => {
    const p = logoLibraryPath("darwin", {}, "/Users/test");
    expect(p).toBe("/Users/test/Library/Application Support/AE Iterations/logos");
  });

  it("resolves the Windows APPDATA path when APPDATA is set", () => {
    const p = logoLibraryPath("win32", { APPDATA: "C:\\Users\\Test\\AppData\\Roaming" }, "C:\\Users\\Test");
    expect(p).toBe("C:\\Users\\Test\\AppData\\Roaming\\AE Iterations\\logos");
  });

  it("falls back to homedir on Windows when APPDATA is unset", () => {
    const p = logoLibraryPath("win32", {}, "C:\\Users\\Test");
    expect(p).toBe("C:\\Users\\Test\\AE Iterations\\logos");
  });
});

describe("listLogoFiles", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.mkdirSync).mockReset();
    vi.mocked(fs.readdirSync).mockReset();
  });

  it("creates the folder and returns [] when it doesn't exist yet", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(listLogoFiles("/fake/logos")).toEqual([]);
    expect(fs.mkdirSync).toHaveBeenCalledWith("/fake/logos", { recursive: true });
  });

  it("returns image files as absolute paths, sorted, skipping non-images", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(["b.png", "a.jpg", "readme.txt", "c.PNG"] as any);
    expect(listLogoFiles("/fake/logos")).toEqual([
      "/fake/logos/a.jpg",
      "/fake/logos/b.png",
      "/fake/logos/c.PNG",
    ]);
  });

  it("returns [] without throwing when reading the directory fails", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error("EACCES");
    });
    expect(listLogoFiles("/fake/logos")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./logoLibrary` doesn't exist yet.

- [ ] **Step 3: Create the implementation**

Create `ae-iterations-next/src/js/main/lib/logoLibrary.ts`:

```ts
// Cross-platform persistence for the user's logo library folder, stored
// outside the extension's own installed folder so it survives updates --
// same location category as userPresets.ts's user-presets.json (see that
// file's header comment for the full cross-platform-path-resolution
// reasoning, mirrored here exactly). Unlike userPresets.ts, there's no save
// function -- the user drops image files into this folder directly via
// Finder/Explorer; this file only resolves the path and lists its contents.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];

export function logoLibraryPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = ""
): string {
  try {
    const resolvedHomedir = homedir || os.homedir();
    if (platform === "win32") {
      return path.win32.join(env.APPDATA || resolvedHomedir, "AE Iterations", "logos");
    }
    return path.posix.join(resolvedHomedir, "Library", "Application Support", "AE Iterations", "logos");
  } catch (e) {
    return "";
  }
}

// Creates the folder (so there's always somewhere for the user to drop
// files into, empty-state or not) and returns absolute paths to the image
// files inside it, sorted by filename.
export function listLogoFiles(dirPath: string = logoLibraryPath()): string[] {
  try {
    if (!dirPath) return [];
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      return [];
    }
    return fs
      .readdirSync(dirPath)
      .filter((name) => IMAGE_EXTENSIONS.indexOf(path.extname(name).toLowerCase()) !== -1)
      .sort()
      .map((name) => path.join(dirPath, name));
  } catch (e) {
    return [];
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the new ones.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/lib/logoLibrary.ts ae-iterations-next/src/js/main/lib/logoLibrary.test.ts
git commit -m "feat: add logoLibrary.ts (cross-platform logo folder resolution + listing)"
```

---

### Task 6: `LogoPickerGrid` component

**Files:**
- Create: `ae-iterations-next/src/js/main/components/LogoPickerGrid.tsx`
- Create: `ae-iterations-next/src/js/main/components/LogoPickerGrid.test.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- Consumes: `listLogoFiles`, `logoLibraryPath` (Task 5).
- Produces: `LogoPickerGrid({ onSelect: (path: string) => void; selectedPath?: string })`. Consumed by Task 10 (`LogoSection`).

Structurally like `EmojiPickerGrid.tsx`, but reads a local folder via `listLogoFiles()` directly (no `evalTS` round-trip — this is a plain OS folder at a fixed, known path, unlike Emoji's folder which is bundled *inside* the running extension's own install path and only reachable from the host side).

- [ ] **Step 1: Write the failing tests**

Create `ae-iterations-next/src/js/main/components/LogoPickerGrid.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogoPickerGrid } from "./LogoPickerGrid";

vi.mock("../lib/logoLibrary", () => ({
  listLogoFiles: vi.fn(() => ["/logos/brand-a.png", "/logos/brand-b.png"]),
  logoLibraryPath: vi.fn(() => "/fake/logos"),
}));

describe("LogoPickerGrid", () => {
  it("renders one thumbnail per file returned by listLogoFiles", () => {
    render(<LogoPickerGrid onSelect={() => {}} />);
    expect(screen.getByTitle("brand-a.png")).toBeInTheDocument();
    expect(screen.getByTitle("brand-b.png")).toBeInTheDocument();
  });

  it("calls onSelect with the clicked file's absolute path", () => {
    const onSelect = vi.fn();
    render(<LogoPickerGrid onSelect={onSelect} />);
    fireEvent.click(screen.getByTitle("brand-a.png"));
    expect(onSelect).toHaveBeenCalledWith("/logos/brand-a.png");
  });

  it("marks the selected file with the selected class", () => {
    render(<LogoPickerGrid onSelect={() => {}} selectedPath="/logos/brand-b.png" />);
    expect(screen.getByTitle("brand-b.png").className).toContain("selected");
    expect(screen.getByTitle("brand-a.png").className).not.toContain("selected");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./LogoPickerGrid` doesn't exist yet.

- [ ] **Step 3: Create the component**

Create `ae-iterations-next/src/js/main/components/LogoPickerGrid.tsx`:

```tsx
import { useEffect, useState } from "react";
import { listLogoFiles, logoLibraryPath } from "../lib/logoLibrary";

export function LogoPickerGrid({
  onSelect,
  selectedPath,
}: {
  onSelect: (path: string) => void;
  selectedPath?: string;
}) {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    setFiles(listLogoFiles());
  }, []);

  if (files.length === 0) {
    return <div className="emoji-empty">No logos yet — drop image files into {logoLibraryPath()}</div>;
  }

  return (
    <div className="logo-picker-grid">
      {files.map((filePath) => {
        const name = filePath.split(/[\\/]/).pop() || filePath;
        return (
          <div
            key={filePath}
            className={"emoji-grid-item" + (filePath === selectedPath ? " selected" : "")}
            title={name}
            onClick={() => onSelect(filePath)}
          >
            <img src={"file://" + filePath} alt={name} />
          </div>
        );
      })}
    </div>
  );
}
```

Note this reuses the `.emoji-grid-item`/`.emoji-empty` classes verbatim (they're generic thumbnail-grid-item styling, not semantically emoji-specific) rather than duplicating that CSS — a deliberate, small DRY choice that touches zero existing files (only adds a new `.logo-picker-grid` container class in Step 5, since `#emoji-picker-grid` is an `id` selector on the *other* component and shouldn't be reused as an id here).

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Add the grid container styling**

Open `ae-iterations-next/src/js/main/main.scss`. Find the `#emoji-picker-grid` rule (search for `#emoji-picker-grid {`) and add this new rule directly after its closing `}`:

```scss
.logo-picker-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.2rem;
  max-height: 8rem;
  overflow-y: auto;
  padding: 0.3rem;
  background-color: $surface;
  border-radius: 4px;
  margin: 0.2rem 0 $space-3;
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
git add ae-iterations-next/src/js/main/components/LogoPickerGrid.tsx ae-iterations-next/src/js/main/components/LogoPickerGrid.test.tsx ae-iterations-next/src/js/main/main.scss
git commit -m "feat: add LogoPickerGrid component"
```

---

### Task 7: Store — badge/logo state

**Files:**
- Modify: `ae-iterations-next/src/js/main/state/store.ts`
- Modify: `ae-iterations-next/src/js/main/state/store.test.ts`

**Interfaces:**
- Produces: `badgeEnabled/badgeTexts/badgeX/badgeY/badgeSize/badgeCircleColor/badgeTextColor`, `logoEnabled/logoPath/logoX/logoY/logoSize`, and their setters. Consumed by Task 9/10's components and Task 12's `RunButton`/`LayerInfoPanel`.

- [ ] **Step 1: Write the failing tests**

Open `ae-iterations-next/src/js/main/state/store.test.ts` and add this new `describe` block at the end of the file:

```ts
describe("badge/logo overlay state", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: null, layerInfo: [], rowLayers: [], count: 5, sameForAll: true, values: {},
      mode: "var", varNames: [],
      badgeEnabled: false, badgeTexts: [], badgeX: 90, badgeY: 90, badgeSize: 100,
      badgeCircleColor: [1, 1, 1], badgeTextColor: [0, 0, 0],
      logoEnabled: false, logoPath: null, logoX: 990, logoY: 90, logoSize: 100,
    });
  });

  it("badge defaults are sane", () => {
    const s = useAppStore.getState();
    expect(s.badgeEnabled).toBe(false);
    expect(s.badgeX).toBe(90);
    expect(s.badgeY).toBe(90);
    expect(s.badgeSize).toBe(100);
    expect(s.badgeCircleColor).toEqual([1, 1, 1]);
    expect(s.badgeTextColor).toEqual([0, 0, 0]);
  });

  it("logo defaults are sane", () => {
    const s = useAppStore.getState();
    expect(s.logoEnabled).toBe(false);
    expect(s.logoPath).toBeNull();
    expect(s.logoX).toBe(990);
  });

  it("setBadgeText sets free text at the given iteration without disturbing others", () => {
    useAppStore.getState().setBadgeText(0, "25+");
    useAppStore.getState().setBadgeText(2, "50% OFF");
    expect(useAppStore.getState().badgeTexts[0]).toBe("25+");
    expect(useAppStore.getState().badgeTexts[2]).toBe("50% OFF");
    expect(useAppStore.getState().badgeTexts[1]).toBeUndefined();
  });

  it("setBadgeEnabled/X/Y/Size/CircleColor/TextColor update their fields independently", () => {
    useAppStore.getState().setBadgeEnabled(true);
    useAppStore.getState().setBadgeX(10);
    useAppStore.getState().setBadgeY(20);
    useAppStore.getState().setBadgeSize(50);
    useAppStore.getState().setBadgeCircleColor([0.5, 0.5, 0.5]);
    useAppStore.getState().setBadgeTextColor([1, 1, 0]);
    const s = useAppStore.getState();
    expect(s.badgeEnabled).toBe(true);
    expect(s.badgeX).toBe(10);
    expect(s.badgeY).toBe(20);
    expect(s.badgeSize).toBe(50);
    expect(s.badgeCircleColor).toEqual([0.5, 0.5, 0.5]);
    expect(s.badgeTextColor).toEqual([1, 1, 0]);
  });

  it("setLogoEnabled/Path/X/Y/Size update their fields independently", () => {
    useAppStore.getState().setLogoEnabled(true);
    useAppStore.getState().setLogoPath("/logos/brand.png");
    useAppStore.getState().setLogoX(100);
    useAppStore.getState().setLogoY(200);
    useAppStore.getState().setLogoSize(75);
    const s = useAppStore.getState();
    expect(s.logoEnabled).toBe(true);
    expect(s.logoPath).toBe("/logos/brand.png");
    expect(s.logoX).toBe(100);
    expect(s.logoY).toBe(200);
    expect(s.logoSize).toBe(75);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — none of the badge/logo fields or setters exist on the store yet.

- [ ] **Step 3: Add the state and setters**

Open `ae-iterations-next/src/js/main/state/store.ts`. Add these fields to the `AppState` interface, after `setEmojiLayerIndex(v: number): void;`:

```ts
  badgeEnabled: boolean;
  badgeTexts: (string | null)[];
  badgeX: number;
  badgeY: number;
  badgeSize: number;
  badgeCircleColor: [number, number, number];
  badgeTextColor: [number, number, number];
  logoEnabled: boolean;
  logoPath: string | null;
  logoX: number;
  logoY: number;
  logoSize: number;
  setBadgeEnabled(v: boolean): void;
  setBadgeText(iter: number, text: string | null): void;
  setBadgeX(v: number): void;
  setBadgeY(v: number): void;
  setBadgeSize(v: number): void;
  setBadgeCircleColor(color: [number, number, number]): void;
  setBadgeTextColor(color: [number, number, number]): void;
  setLogoEnabled(v: boolean): void;
  setLogoPath(path: string | null): void;
  setLogoX(v: number): void;
  setLogoY(v: number): void;
  setLogoSize(v: number): void;
```

Then add the implementation, after the existing `setEmojiLayerIndex: (v) => set({ emojiLayerIndex: v }),` line:

```ts
  badgeEnabled: false,
  badgeTexts: [],
  badgeX: 90,
  badgeY: 90,
  badgeSize: 100,
  badgeCircleColor: [1, 1, 1],
  badgeTextColor: [0, 0, 0],
  logoEnabled: false,
  logoPath: null,
  logoX: 990,
  logoY: 90,
  logoSize: 100,
  setBadgeEnabled: (v) => set({ badgeEnabled: v }),
  setBadgeText: (iter, text) =>
    set((s) => {
      const arr = [...s.badgeTexts];
      arr[iter] = text;
      return { badgeTexts: arr };
    }),
  setBadgeX: (v) => set({ badgeX: v }),
  setBadgeY: (v) => set({ badgeY: v }),
  setBadgeSize: (v) => set({ badgeSize: v }),
  setBadgeCircleColor: (color) => set({ badgeCircleColor: color }),
  setBadgeTextColor: (color) => set({ badgeTextColor: color }),
  setLogoEnabled: (v) => set({ logoEnabled: v }),
  setLogoPath: (path) => set({ logoPath: path }),
  setLogoX: (v) => set({ logoX: v }),
  setLogoY: (v) => set({ logoY: v }),
  setLogoSize: (v) => set({ logoSize: v }),
```

Colors default to `[1, 1, 1]` (white) and `[0, 0, 0]` (black) — 0-1 float RGB, matching this codebase's established color convention (not 0-255), per the Global Constraints.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the 5 new ones.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/state/store.ts ae-iterations-next/src/js/main/state/store.test.ts
git commit -m "feat: add badge/logo overlay state fields and setters to store"
```

---

### Task 8: `renderPreviewFrame` host command

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts`

**Interfaces:**
- Consumes: `findCompByName` (existing, `lib/findComp.ts`).
- Produces: `renderPreviewFrame(cfg?: { compName?: string }): { path: string; width: number; height: number }`. Consumed by Task 9 (`PositionPickerPopup`).

Backs the visual position picker: renders the current frame of a comp to a fixed temp-file path and reports the comp's pixel dimensions, so the panel can scale a draggable marker correctly.

- [ ] **Step 1: Add the command**

Open `ae-iterations-next/src/jsx/aeft/aeft.ts`. Add this export anywhere after `previewApply` (e.g. right before `previewEmoji`):

```ts
// Renders frame 0 of a comp to a fixed temp-file path (overwritten on every
// call -- no per-call unique filename, so no temp-file accumulation across
// repeated popup opens) and reports its pixel dimensions, backing the
// visual position-picker popup. Falls back to the active comp when no
// compName is given, matching previewApply's own comp-resolution fallback.
export const renderPreviewFrame = (cfg?: { compName?: string }): { path: string; width: number; height: number } => {
  let comp: CompItem | null = null;
  if (cfg && cfg.compName) comp = findCompByName(cfg.compName);
  if (!comp && app.project.activeItem instanceof CompItem) comp = app.project.activeItem;
  if (!comp) throw new Error("No comp found. Refresh a layer first.");

  const outFile = new File(Folder.temp.fsName + "/aeiter_position_preview.png");
  comp.saveFrameToPng(0, outFile);

  return { path: outFile.fsName, width: comp.width, height: comp.height };
};
```

- [ ] **Step 2: Verify the build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected, build exits 0. Inspect `dist/cep/jsx/index.js` to confirm `renderPreviewFrame` is present and registered in the compiled command map alongside `previewApply`/`previewEmoji`/`browseForMedia`.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/aeft.ts
git commit -m "feat: add renderPreviewFrame command for the position picker"
```

---

### Task 9: `PositionPickerPopup` component (coordinate-math risk)

**Files:**
- Create: `ae-iterations-next/src/js/main/components/PositionPickerPopup.tsx`
- Create: `ae-iterations-next/src/js/main/components/PositionPickerPopup.test.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- Consumes: `renderPreviewFrame` host command (Task 8).
- Produces: `PositionPickerPopup({ compName, x, y, onChange, onClose, markerKind })`. Consumed by Task 10 (`BadgeSection`/`LogoSection`).

Shared by both Badge and Logo (per the design spec's Decision 7). It does **not** render its own numeric X/Y inputs — those already exist in the calling section (`BadgeSection`/`LogoSection`) and read/write the exact same store fields via the same `onChange` path, so they stay in sync automatically without any extra wiring.

**This is the other genuinely new, unvalidated surface in this plan** (alongside Task 4's shape/text creation) — screen-space-to-comp-pixel coordinate conversion, scaled by a snapshot that's fit-to-width rather than shown 1:1. Get the RTL test passing against a real, deterministic `getBoundingClientRect` mock before trusting the arithmetic.

- [ ] **Step 1: Write the failing tests**

Create `ae-iterations-next/src/js/main/components/PositionPickerPopup.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PositionPickerPopup } from "./PositionPickerPopup";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

describe("PositionPickerPopup", () => {
  beforeEach(() => {
    // The popup's canvas is fixed at 320px display width (POPUP_WIDTH);
    // a 1080x1920 comp scales to displayHeight = 1920/1080*320 = 568.89.
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 320, bottom: 568.89, width: 320, height: 568.89,
      x: 0, y: 0, toJSON: () => {},
    }));
  });

  it("renders the fetched snapshot and a marker positioned from x/y", async () => {
    render(<PositionPickerPopup compName="Comp A" x={540} y={960} onChange={() => {}} onClose={() => {}} markerKind="badge" />);
    const img = await screen.findByAltText("Comp preview");
    expect(img).toBeInTheDocument();
  });

  it("dragging the canvas converts screen coordinates back to comp pixels", async () => {
    const onChange = vi.fn();
    render(<PositionPickerPopup compName="Comp A" x={0} y={0} onChange={onChange} onClose={() => {}} markerKind="logo" />);
    await screen.findByAltText("Comp preview");
    const canvas = screen.getByTestId("position-picker-canvas");
    // scale = 320 / 1080 ≈ 0.2963; clicking at (160, 284) -> ~(540, 958) comp px.
    fireEvent.mouseDown(canvas, { clientX: 160, clientY: 284 });
    expect(onChange).toHaveBeenCalled();
    const [calledX, calledY] = onChange.mock.calls[0];
    expect(calledX).toBeGreaterThan(500);
    expect(calledX).toBeLessThan(580);
    expect(calledY).toBeGreaterThan(920);
    expect(calledY).toBeLessThan(1000);
  });

  it("closes when the backdrop is clicked", async () => {
    const onClose = vi.fn();
    render(<PositionPickerPopup compName="Comp A" x={0} y={0} onChange={() => {}} onClose={onClose} markerKind="badge" />);
    await screen.findByAltText("Comp preview");
    fireEvent.click(screen.getByTestId("position-picker-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./PositionPickerPopup` doesn't exist yet.

- [ ] **Step 3: Create the component**

Create `ae-iterations-next/src/js/main/components/PositionPickerPopup.tsx`:

```tsx
import { useEffect, useRef, useState } from "react";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";

const POPUP_WIDTH = 320;

interface FrameInfo {
  path: string;
  width: number;
  height: number;
}

export function PositionPickerPopup({
  compName,
  x,
  y,
  onChange,
  onClose,
  markerKind,
}: {
  compName: string | null;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  onClose: () => void;
  markerKind: "badge" | "logo";
}) {
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust] = useState(() => Date.now());
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    evalTS("renderPreviewFrame", compName ? { compName } : undefined)
      .then((res) => setFrame(res))
      .catch((err) => setError(evalTSErrorMessage(err)));
  }, [compName]);

  const scale = frame ? POPUP_WIDTH / frame.width : 1;
  const displayHeight = frame ? frame.height * scale : POPUP_WIDTH;

  const updateFromClientPos = (clientX: number, clientY: number) => {
    if (!frame || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const relX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const relY = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    onChange(Math.round(relX / scale), Math.round(relY / scale));
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) updateFromClientPos(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  return (
    <div className="position-picker-backdrop" data-testid="position-picker-backdrop" onClick={onClose}>
      <div className="position-picker-popup" onClick={(e) => e.stopPropagation()}>
        {error && <div className="position-picker-error">{error}</div>}
        {!error && !frame && <div className="position-picker-loading">Rendering preview…</div>}
        {frame && (
          <div
            ref={canvasRef}
            data-testid="position-picker-canvas"
            className="position-picker-canvas"
            style={{ width: POPUP_WIDTH, height: displayHeight }}
            onMouseDown={(e) => {
              draggingRef.current = true;
              updateFromClientPos(e.clientX, e.clientY);
            }}
          >
            <img src={"file://" + frame.path + "?t=" + cacheBust} alt="Comp preview" draggable={false} />
            <div
              className={"position-picker-marker position-picker-marker-" + markerKind}
              style={{ left: x * scale, top: y * scale }}
            />
          </div>
        )}
        <button className="video-toggle position-picker-close" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all 3 new tests. If the drag test's asserted range doesn't match (e.g. the sign of `relX - rect.left` is flipped), that's exactly the class of bug this task exists to catch before it reaches a real popup — fix the coordinate math, not the test's expected range.

- [ ] **Step 5: Add the popup styling**

Open `ae-iterations-next/src/js/main/main.scss`. Add this block at the end of the file:

```scss
// ── Position picker popup (badge + logo) ─────────────────────────────────

.position-picker-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

.position-picker-popup {
  background-color: $surface;
  border: 1px solid $border-strong;
  border-radius: $radius-md;
  box-shadow: $shadow-md;
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-3;
  align-items: center;
}

.position-picker-canvas {
  position: relative;
  cursor: crosshair;
  border-radius: $radius-sm;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
  }
}

.position-picker-marker {
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid $accent;
  background-color: rgba($accent, 0.25);
  transform: translate(-50%, -50%);
  pointer-events: none;

  &.position-picker-marker-logo {
    border-radius: 4px;
  }
}

.position-picker-loading,
.position-picker-error {
  font-size: $text-sm;
  color: $text-dim;
  padding: $space-4;
}

.position-picker-close {
  align-self: stretch;
}
```

Then find the existing `.video-toggle` rule (search for `.video-toggle {`) and add a `:disabled` state to it — this class is about to gain its first disabled consumer (Task 10's "Position visually…" button), and it doesn't have one yet:

```scss
.video-toggle {
  background-color: $surface-raised !important;
  color: $text !important;
  border: 1px solid $border-strong !important;
  box-shadow: $shadow-sm;
  height: 26px;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  gap: $space-1;
  padding: 0 $space-4 !important;
  transition: background-color $transition-fast, box-shadow $transition-fast;

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover:not(:disabled) {
    background-color: $surface-hover !important;
    box-shadow: $shadow-md;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
```

(Only the new `&:disabled` block is added — everything else in that rule is unchanged, shown here for exact match context.)

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/PositionPickerPopup.tsx ae-iterations-next/src/js/main/components/PositionPickerPopup.test.tsx ae-iterations-next/src/js/main/main.scss
git commit -m "feat: add PositionPickerPopup component"
```

---

### Task 10: `BadgeSection` + `LogoSection` + settings-card wiring

**Files:**
- Create: `ae-iterations-next/src/js/main/components/BadgeSection.tsx`
- Create: `ae-iterations-next/src/js/main/components/BadgeSection.test.tsx`
- Create: `ae-iterations-next/src/js/main/components/LogoSection.tsx`
- Create: `ae-iterations-next/src/js/main/components/LogoSection.test.tsx`
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- Consumes: store badge/logo fields/setters (Task 7), `LogoPickerGrid` (Task 6), `PositionPickerPopup` (Task 9).
- Produces: `BadgeSection()`, `LogoSection()` — no props (read/write the store directly, matching `EmojiSection`'s pattern). Consumed by `LayerInfoPanel.tsx`'s new VAR settings-card.

Note on file organization: the design spec described a `VarOverlaysCard.tsx` wrapper, but this codebase's established pattern (ITR's Emoji+Presets card) renders the `.settings-card` shell **inline** in `LayerInfoPanel.tsx`, not as a separate wrapper component — only the expanded per-toggle content (`EmojiSection`) is its own file. This task follows that same established pattern: no `VarOverlaysCard.tsx`, just a new `{mode === "var" && ...}` block inline in `LayerInfoPanel.tsx`, mirroring the existing `{mode === "itr" && ...}` block structurally.

- [ ] **Step 1: Write `BadgeSection`'s failing tests**

Create `ae-iterations-next/src/js/main/components/BadgeSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BadgeSection } from "./BadgeSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

describe("BadgeSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: "Comp A", count: 3,
      badgeTexts: [], badgeX: 90, badgeY: 90, badgeSize: 100, badgeCircleColor: [1, 1, 1], badgeTextColor: [0, 0, 0],
    });
  });

  it("renders one free-text input per iteration and writes into the store", () => {
    render(<BadgeSection />);
    const inputs = screen.getAllByPlaceholderText("Badge text");
    expect(inputs).toHaveLength(3);
    fireEvent.change(inputs[0], { target: { value: "25+" } });
    expect(useAppStore.getState().badgeTexts[0]).toBe("25+");
  });

  it("updates X/Y/Size fields independently", () => {
    render(<BadgeSection />);
    const [xInput, yInput] = screen.getAllByRole("spinbutton").slice(0, 2);
    fireEvent.change(xInput, { target: { value: "150" } });
    fireEvent.change(yInput, { target: { value: "250" } });
    expect(useAppStore.getState().badgeX).toBe(150);
    expect(useAppStore.getState().badgeY).toBe(250);
  });

  it("opens the position picker on button click when a comp is set", async () => {
    render(<BadgeSection />);
    fireEvent.click(screen.getByText("Position visually…"));
    expect(await screen.findByAltText("Comp preview")).toBeInTheDocument();
  });

  it("disables the position-picker button when no comp is set", () => {
    useAppStore.setState({ compName: null });
    render(<BadgeSection />);
    expect(screen.getByText("Position visually…")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./BadgeSection` doesn't exist yet.

- [ ] **Step 3: Create `BadgeSection`**

Create `ae-iterations-next/src/js/main/components/BadgeSection.tsx`:

```tsx
import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { hexToRgb, rgbToHex } from "../lib/color";
import { PositionPickerPopup } from "./PositionPickerPopup";

export function BadgeSection() {
  const {
    compName, count, badgeTexts, badgeX, badgeY, badgeSize, badgeCircleColor, badgeTextColor,
    setBadgeText, setBadgeX, setBadgeY, setBadgeSize, setBadgeCircleColor, setBadgeTextColor,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, count: s.count, badgeTexts: s.badgeTexts, badgeX: s.badgeX, badgeY: s.badgeY,
      badgeSize: s.badgeSize, badgeCircleColor: s.badgeCircleColor, badgeTextColor: s.badgeTextColor,
      setBadgeText: s.setBadgeText, setBadgeX: s.setBadgeX, setBadgeY: s.setBadgeY, setBadgeSize: s.setBadgeSize,
      setBadgeCircleColor: s.setBadgeCircleColor, setBadgeTextColor: s.setBadgeTextColor,
    }))
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div id="badge-section">
      <div className="emoji-fields-row">
        <div className="emoji-field emoji-field-position">
          <label className="emoji-field-label">Position</label>
          <div className="emoji-position-group">
            <span className="emoji-axis">X</span>
            <input type="number" value={badgeX} onChange={(e) => setBadgeX(parseInt(e.target.value, 10) || 0)} />
            <span className="emoji-position-sep" />
            <span className="emoji-axis">Y</span>
            <input type="number" value={badgeY} onChange={(e) => setBadgeY(parseInt(e.target.value, 10) || 0)} />
          </div>
        </div>
        <div className="emoji-field emoji-field-size">
          <label className="emoji-field-label">Size</label>
          <input type="number" value={badgeSize} onChange={(e) => setBadgeSize(parseInt(e.target.value, 10) || 100)} />
        </div>
      </div>
      <div className="overlay-color-row">
        <label className="overlay-color-field">
          Circle
          <input
            type="color"
            value={rgbToHex(badgeCircleColor).toLowerCase()}
            onChange={(e) => setBadgeCircleColor(hexToRgb(e.target.value))}
          />
        </label>
        <label className="overlay-color-field">
          Text
          <input
            type="color"
            value={rgbToHex(badgeTextColor).toLowerCase()}
            onChange={(e) => setBadgeTextColor(hexToRgb(e.target.value))}
          />
        </label>
        <button
          className="video-toggle"
          disabled={!compName}
          title={compName ? "Position visually" : "Refresh a layer first"}
          onClick={() => setPickerOpen(true)}
        >
          Position visually…
        </button>
      </div>
      <div id="emoji-iter-rows">
        {Array.from({ length: count }, (_, iter) => (
          <div key={iter} className="badge-iter-row">
            <span className="emoji-iter-num">{iter + 1}</span>
            <input
              type="text"
              className="badge-text-input"
              placeholder="Badge text"
              value={badgeTexts[iter] ?? ""}
              onChange={(e) => setBadgeText(iter, e.target.value || null)}
            />
          </div>
        ))}
      </div>
      {pickerOpen && (
        <PositionPickerPopup
          compName={compName}
          x={badgeX}
          y={badgeY}
          markerKind="badge"
          onChange={(nx, ny) => {
            setBadgeX(nx);
            setBadgeY(ny);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run `BadgeSection`'s tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all 4 new tests.

- [ ] **Step 5: Write `LogoSection`'s failing tests**

Create `ae-iterations-next/src/js/main/components/LogoSection.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LogoSection } from "./LogoSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/tmp/preview.png", width: 1080, height: 1920 })),
  evalTSErrorMessage: (err: unknown) => String(err),
}));

vi.mock("../lib/logoLibrary", () => ({
  listLogoFiles: vi.fn(() => ["/logos/brand-a.png"]),
  logoLibraryPath: vi.fn(() => "/fake/logos"),
}));

describe("LogoSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: "Comp A", logoPath: null, logoX: 990, logoY: 90, logoSize: 100,
    });
  });

  it("selecting a logo from the grid writes its path into the store", () => {
    render(<LogoSection />);
    fireEvent.click(screen.getByTitle("brand-a.png"));
    expect(useAppStore.getState().logoPath).toBe("/logos/brand-a.png");
  });

  it("updates X/Y/Size fields independently", () => {
    render(<LogoSection />);
    const [xInput, yInput, sizeInput] = screen.getAllByRole("spinbutton");
    fireEvent.change(xInput, { target: { value: "500" } });
    fireEvent.change(yInput, { target: { value: "600" } });
    fireEvent.change(sizeInput, { target: { value: "80" } });
    expect(useAppStore.getState().logoX).toBe(500);
    expect(useAppStore.getState().logoY).toBe(600);
    expect(useAppStore.getState().logoSize).toBe(80);
  });

  it("opens the position picker on button click", async () => {
    render(<LogoSection />);
    fireEvent.click(screen.getByText("Position visually…"));
    expect(await screen.findByAltText("Comp preview")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `./LogoSection` doesn't exist yet.

- [ ] **Step 7: Create `LogoSection`**

Create `ae-iterations-next/src/js/main/components/LogoSection.tsx`:

```tsx
import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { LogoPickerGrid } from "./LogoPickerGrid";
import { PositionPickerPopup } from "./PositionPickerPopup";

export function LogoSection() {
  const {
    compName, logoPath, logoX, logoY, logoSize,
    setLogoPath, setLogoX, setLogoY, setLogoSize,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, logoPath: s.logoPath, logoX: s.logoX, logoY: s.logoY, logoSize: s.logoSize,
      setLogoPath: s.setLogoPath, setLogoX: s.setLogoX, setLogoY: s.setLogoY, setLogoSize: s.setLogoSize,
    }))
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div id="logo-section">
      <LogoPickerGrid onSelect={setLogoPath} selectedPath={logoPath ?? undefined} />
      <div className="emoji-fields-row">
        <div className="emoji-field emoji-field-position">
          <label className="emoji-field-label">Position</label>
          <div className="emoji-position-group">
            <span className="emoji-axis">X</span>
            <input type="number" value={logoX} onChange={(e) => setLogoX(parseInt(e.target.value, 10) || 0)} />
            <span className="emoji-position-sep" />
            <span className="emoji-axis">Y</span>
            <input type="number" value={logoY} onChange={(e) => setLogoY(parseInt(e.target.value, 10) || 0)} />
          </div>
        </div>
        <div className="emoji-field emoji-field-size">
          <label className="emoji-field-label">Size</label>
          <input type="number" value={logoSize} onChange={(e) => setLogoSize(parseInt(e.target.value, 10) || 100)} />
        </div>
      </div>
      <button
        className="video-toggle"
        disabled={!compName}
        title={compName ? "Position visually" : "Refresh a layer first"}
        onClick={() => setPickerOpen(true)}
      >
        Position visually…
      </button>
      {pickerOpen && (
        <PositionPickerPopup
          compName={compName}
          x={logoX}
          y={logoY}
          markerKind="logo"
          onChange={(nx, ny) => {
            setLogoX(nx);
            setLogoY(ny);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Run all tests to verify they pass**

```bash
npm run test
```

Expected: PASS, entire suite including all new tests from this task.

- [ ] **Step 9: Wire both sections into `LayerInfoPanel`'s VAR settings-card**

Open `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`. Add these imports alongside the existing `EmojiSection`/`PresetPanel` imports:

```ts
import { BadgeSection } from "./BadgeSection";
import { LogoSection } from "./LogoSection";
```

Add `Badge`, `Image` to the existing `lucide-react` import line — change:

```ts
import { RefreshCw, Plus, ChevronUp, ChevronDown, Smile, Star, ChevronRight, Info } from "lucide-react";
```

to:

```ts
import { RefreshCw, Plus, ChevronUp, ChevronDown, Smile, Star, ChevronRight, Info, Badge, Image } from "lucide-react";
```

Add the new store fields to the existing `useAppStore` destructure — change:

```ts
  const {
    compName, rowLayers, count, setCount, values, sameForAll, setSameForAll, setLayerInfo, addLayerInfo, mode,
    emojiEnabled, setEmojiEnabled,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName,
      rowLayers: s.rowLayers,
      count: s.count,
      setCount: s.setCount,
      values: s.values,
      sameForAll: s.sameForAll,
      setSameForAll: s.setSameForAll,
      setLayerInfo: s.setLayerInfo,
      addLayerInfo: s.addLayerInfo,
      mode: s.mode,
      emojiEnabled: s.emojiEnabled,
      setEmojiEnabled: s.setEmojiEnabled,
    }))
  );
```

to:

```ts
  const {
    compName, rowLayers, count, setCount, values, sameForAll, setSameForAll, setLayerInfo, addLayerInfo, mode,
    emojiEnabled, setEmojiEnabled,
    badgeEnabled, setBadgeEnabled, logoEnabled, setLogoEnabled,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName,
      rowLayers: s.rowLayers,
      count: s.count,
      setCount: s.setCount,
      values: s.values,
      sameForAll: s.sameForAll,
      setSameForAll: s.setSameForAll,
      setLayerInfo: s.setLayerInfo,
      addLayerInfo: s.addLayerInfo,
      mode: s.mode,
      emojiEnabled: s.emojiEnabled,
      setEmojiEnabled: s.setEmojiEnabled,
      badgeEnabled: s.badgeEnabled,
      setBadgeEnabled: s.setBadgeEnabled,
      logoEnabled: s.logoEnabled,
      setLogoEnabled: s.setLogoEnabled,
    }))
  );
```

Find the existing VAR mode block:

```tsx
      {mode === "var" && (
        <>
          <VarNamesRow />
          <button className="var-test-btn" onClick={testVarComps}>Test</button>
          {testLog && <pre id="var-test-log">{testLog.join("\n")}</pre>}
        </>
      )}
```

and add a new settings-card directly before it, mirroring the ITR block's structure exactly:

```tsx
      {mode === "var" && (
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-label">
              <Badge />
              Badge overlay
            </div>
            <button
              className={"settings-switch" + (badgeEnabled ? " on" : "")}
              role="switch"
              aria-checked={badgeEnabled}
              title="Badge overlay"
              onClick={() => setBadgeEnabled(!badgeEnabled)}
            />
          </div>
          {badgeEnabled && <BadgeSection />}
          <div className="settings-divider" />
          <div className="settings-row">
            <div className="settings-row-label">
              <Image />
              Logo overlay
            </div>
            <button
              className={"settings-switch" + (logoEnabled ? " on" : "")}
              role="switch"
              aria-checked={logoEnabled}
              title="Logo overlay"
              onClick={() => setLogoEnabled(!logoEnabled)}
            />
          </div>
          {logoEnabled && <LogoSection />}
        </div>
      )}
      {mode === "var" && (
        <>
          <VarNamesRow />
          <button className="var-test-btn" onClick={testVarComps}>Test</button>
          {testLog && <pre id="var-test-log">{testLog.join("\n")}</pre>}
        </>
      )}
```

- [ ] **Step 10: Add the remaining new SCSS (color row + text input)**

Open `ae-iterations-next/src/js/main/main.scss`. Add this block right after the `.logo-picker-grid` rule added in Task 6:

```scss
// ── VAR badge overlay fields ──────────────────────────────────────────────

.overlay-color-row {
  display: flex;
  align-items: center;
  gap: $space-3;
  margin-bottom: $space-3;
}

.overlay-color-field {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-size: $text-xs;
  color: $text-faint;

  input[type="color"] {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    padding: 0;
    border: none;
    box-shadow: 0 0 0 1px $border-strong;
    flex-shrink: 0;
  }
}

.badge-iter-row {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-2;
  border-radius: $radius-sm;
  transition: background-color $transition-fast;

  &:hover {
    background-color: $surface-hover;
  }
}

.badge-text-input {
  flex: 1;
  background-color: $inset;
  border: 1px solid $border;
  border-radius: $radius-sm;
  padding: 0.15rem $space-2;
  color: $text;
  font-size: $text-sm;
}
```

- [ ] **Step 11: Run the full test suite**

```bash
npm run test
```

Expected: PASS, no regressions across the whole suite.

- [ ] **Step 12: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 13: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/BadgeSection.tsx ae-iterations-next/src/js/main/components/BadgeSection.test.tsx ae-iterations-next/src/js/main/components/LogoSection.tsx ae-iterations-next/src/js/main/components/LogoSection.test.tsx ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx ae-iterations-next/src/js/main/main.scss
git commit -m "feat: wire BadgeSection/LogoSection into VAR mode's settings-card"
```

---

### Task 11: `runVarIterationBatch.ts` badge/logo integration (highest run-loop risk in this plan)

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/engine/runVarIterationBatch.ts`

**Interfaces:**
- Consumes: `addBadgeToComp`/`removeBadgeFromComp` (Task 4), `addLogoToComp`/`removeLogoFromComp` (Task 3), `BadgeConfig`/`LogoConfig`/`RunVarConfig.badge`/`.logo` (Task 1).
- Produces: badge/logo fully integrated into the VAR run loop. Consumed at runtime by `runVarIterations` (unchanged wrapper) once Task 12 wires `RunButton` to send `cfg.badge`/`cfg.logo`.

**This is the highest-risk task in this plan**, in the same category as the ITR emoji plan's run-loop task and VAR mode's own original media-import task: it touches a dialog-suppression window and an already-carefully-sequenced save/close/reopen flow. Read the current full file yourself before editing (`cat ae-iterations-next/src/jsx/aeft/engine/runVarIterationBatch.ts`) and trace every change below against it.

**Watch out for, specifically:**

1. **Logo's `importFile` call must happen inside the existing lifted-suppression window** — the one already opened by `app.endSuppressDialogs(false);` right before the `preImportedMedia` loop, and closed by the `app.beginSuppressDialogs();` right after it. Do not open a second, separate suppression window — extend the existing one.
2. **`removeBadgeFromComp`/`removeLogoFromComp` must run before adding, every iteration, even though VAR mode's `tempFile` is a fresh copy of the *original* project for every iteration (not chained forward like ITR).** This is NOT primarily about clearing a previous iteration's leftover (VAR doesn't chain iterations forward the way ITR does) — it is about a real, reachable bug: `runVarIterationBatch` starts with `app.project.save(projectFile)` on whatever is *currently open*, before copying it to `tempFile`. If the user clicked a row's "Preview" button (Task 12 — which applies badge/logo directly to the live, currently-open project inside an undo group) and then clicked "Run" **without undoing**, that leftover preview badge/logo layer would get saved into `tempFile` and inherited by *every single* VAR iteration's copy, not just the first. The remove-before-add calls are the defense against exactly this.
3. **Badge/logo apply only to `renderComps["9x16"]`**, never `renderComps["1x1"]`/`renderComps["16x9"]`/`renderComps["4x5"]` — this is a plain object-key lookup, not a loop over `VAR_ASPECT_SUFFIXES`.
4. **Guard for a missing `"9x16"` render comp** — if the project doesn't have one (e.g. a malformed or partial VAR setup), badge/logo must be skipped with a warning, not throw and abort the whole iteration.
5. **Badge/logo application sits inside the existing `"VAR " + varName` undo group**, alongside the layer-value loop — not in a separate undo group, and not after `app.endUndoGroup()`.

- [ ] **Step 1: Read the current file**

```bash
cat ae-iterations-next/src/jsx/aeft/engine/runVarIterationBatch.ts
```

Confirm the current shape matches what's shown in Steps 2-3 below (the `preImportedMedia` loop, the per-layer loop inside `beginUndoGroup("VAR " + varName)`/`endUndoGroup()`, and the suppression calls around them) before editing — if it doesn't match exactly, stop and reconcile before proceeding; a mismatch means this file changed since this plan was written and applying these diffs blind would silently corrupt the logic.

- [ ] **Step 2: Add the imports**

Change:

```ts
import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { applyMediaLayer } from "../lib/applyMedia";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { stripAspectSuffix, VAR_ASPECT_SUFFIXES } from "../lib/naming";
import { findVarComp } from "../lib/findComp";
import type { RunVarConfig, RunResult } from "../../../shared/types";
```

to:

```ts
import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { applyMediaLayer } from "../lib/applyMedia";
import { addBadgeToComp, removeBadgeFromComp } from "../lib/applyBadge";
import { addLogoToComp, removeLogoFromComp } from "../lib/applyLogo";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { stripAspectSuffix, VAR_ASPECT_SUFFIXES } from "../lib/naming";
import { findVarComp } from "../lib/findComp";
import type { RunVarConfig, RunResult } from "../../../shared/types";
```

- [ ] **Step 3: Add logo import inside the existing lifted-suppression window**

Find:

```ts
      const preImportedMedia: Record<number, FootageItem> = {};
      for (let pli = 0; pli < cfg.layers.length; pli++) {
        const plc = cfg.layers[pli];
        if (plc.layerType !== "media") continue;
        const pval = cfg.values[iter][pli];
        if (!pval || !pval.mediaPath) continue;
        try {
          const mf = new File(pval.mediaPath);
          if (!mf.exists) {
            warnings.push("VAR " + varName + " layer " + plc.index + ": media file not found");
            continue;
          }
          const fi = app.project.importFile(new ImportOptions(mf));
          if (fi) {
            preImportedMedia[plc.index] = fi as FootageItem;
          } else {
            warnings.push("VAR " + varName + " layer " + plc.index + ": importFile returned null");
          }
        } catch (e: any) {
          warnings.push("VAR " + varName + " layer " + plc.index + ": import error: " + e.message);
        }
      }

      // Restore suppression for apply / save / render / collect.
      app.beginSuppressDialogs();
```

and change it to:

```ts
      const preImportedMedia: Record<number, FootageItem> = {};
      for (let pli = 0; pli < cfg.layers.length; pli++) {
        const plc = cfg.layers[pli];
        if (plc.layerType !== "media") continue;
        const pval = cfg.values[iter][pli];
        if (!pval || !pval.mediaPath) continue;
        try {
          const mf = new File(pval.mediaPath);
          if (!mf.exists) {
            warnings.push("VAR " + varName + " layer " + plc.index + ": media file not found");
            continue;
          }
          const fi = app.project.importFile(new ImportOptions(mf));
          if (fi) {
            preImportedMedia[plc.index] = fi as FootageItem;
          } else {
            warnings.push("VAR " + varName + " layer " + plc.index + ": importFile returned null");
          }
        } catch (e: any) {
          warnings.push("VAR " + varName + " layer " + plc.index + ": import error: " + e.message);
        }
      }

      // Logo's import shares this same lifted-suppression window -- it's the
      // same importFile-silently-returns-null-while-suppressed constraint as
      // media above, so there's no reason to open a second window for it.
      let logoFootage: FootageItem | null = null;
      if (cfg.logo && cfg.logo.enabled && cfg.logo.path) {
        try {
          const lf = new File(cfg.logo.path);
          if (!lf.exists) {
            warnings.push("VAR " + varName + ": logo file not found");
          } else {
            logoFootage = app.project.importFile(new ImportOptions(lf)) as FootageItem;
            if (!logoFootage) warnings.push("VAR " + varName + ": logo importFile returned null");
          }
        } catch (e: any) {
          warnings.push("VAR " + varName + ": logo import error: " + e.message);
        }
      }

      // Restore suppression for apply / save / render / collect.
      app.beginSuppressDialogs();
```

- [ ] **Step 4: Add the badge/logo apply block, inside the existing undo group**

Find:

```ts
      app.beginUndoGroup("VAR " + varName);
      for (let li = 0; li < cfg.layers.length; li++) {
        const lc = cfg.layers[li];
        const layer = comp.layer(lc.index);
        if (!layer) {
          warnings.push("VAR " + varName + ": layer " + lc.index + " not found");
          continue;
        }
        const val = cfg.values[iter][li];
        if (lc.layerType === "media") {
          const fi2 = preImportedMedia[lc.index];
          if (fi2) {
            const ok = applyMediaLayer(layer as AVLayer, fi2, !!val.flip);
            if (!ok) warnings.push("VAR " + varName + ": replaceSource failed on layer " + lc.index);
          }
        }
        const log = applyLayerValue(layer, lc, val);
        for (const failure of applyLayerValueFailures(log)) {
          warnings.push("VAR " + varName + " layer " + lc.index + ": " + failure);
        }
      }
      app.endUndoGroup();
      app.endSuppressDialogs(false);
```

and change it to:

```ts
      app.beginUndoGroup("VAR " + varName);
      for (let li = 0; li < cfg.layers.length; li++) {
        const lc = cfg.layers[li];
        const layer = comp.layer(lc.index);
        if (!layer) {
          warnings.push("VAR " + varName + ": layer " + lc.index + " not found");
          continue;
        }
        const val = cfg.values[iter][li];
        if (lc.layerType === "media") {
          const fi2 = preImportedMedia[lc.index];
          if (fi2) {
            const ok = applyMediaLayer(layer as AVLayer, fi2, !!val.flip);
            if (!ok) warnings.push("VAR " + varName + ": replaceSource failed on layer " + lc.index);
          }
        }
        const log = applyLayerValue(layer, lc, val);
        for (const failure of applyLayerValueFailures(log)) {
          warnings.push("VAR " + varName + " layer " + lc.index + ": " + failure);
        }
      }

      // Badge/logo apply only to the 9x16 render comp, never 1x1/16x9/4x5 --
      // independent of the per-layer loop above, same as Emoji is
      // independent of the layer-value gate in ITR mode. Remove-before-add
      // runs even though VAR doesn't chain iterations forward (unlike ITR):
      // it's defending against a leftover Preview-button badge/logo layer
      // that got saved into `tempFile` before this loop ever started (see
      // this task's "watch out for" item 2).
      const badgeLogoComp = renderComps["9x16"];
      if (badgeLogoComp) {
        if (cfg.badge && cfg.badge.enabled) {
          removeBadgeFromComp(badgeLogoComp);
          const badgeText = cfg.badge.perIteration[iter];
          if (badgeText) {
            addBadgeToComp(
              badgeLogoComp, badgeText, cfg.badge.x, cfg.badge.y, cfg.badge.size,
              cfg.badge.circleColor, cfg.badge.textColor
            );
          }
        }
        if (cfg.logo && cfg.logo.enabled && logoFootage) {
          removeLogoFromComp(badgeLogoComp);
          addLogoToComp(badgeLogoComp, logoFootage, cfg.logo.x, cfg.logo.y, cfg.logo.size);
        }
      } else if ((cfg.badge && cfg.badge.enabled) || (cfg.logo && cfg.logo.enabled)) {
        warnings.push("VAR " + varName + ": 9x16 render comp not found, badge/logo skipped");
      }

      app.endUndoGroup();
      app.endSuppressDialogs(false);
```

- [ ] **Step 5: Verify the build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: existing tests unaffected (no test file for this orchestration function — AE-object-model code), build exits 0.

**Now do the critical verification** — inspect the compiled `dist/cep/jsx/index.js` and trace the compiled `runVarIterationBatch` body, not just the source, confirming:
- The logo-import block's suppression stays inside the SAME lifted window as the media-import loop — no new, separate `endSuppressDialogs`/`beginSuppressDialogs` pair was introduced.
- `badgeLogoComp` is read from `renderComps["9x16"]`, and the badge/logo block only runs when that key resolves to a real `CompItem`.
- The badge/logo block sits between the per-layer loop and `app.endUndoGroup()` — inside the same undo group, not after it.

- [ ] **Step 6: Self-review against the 5 "watch out for" items**

Before committing, check each of this task's 5 numbered items above against your actual final code, one by one, explicitly, and note in your report which line(s) satisfy each one.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/engine/runVarIterationBatch.ts
git commit -m "feat: integrate badge/logo overlays into runVarIterationBatch"
```

---

### Task 12: `previewApply` integration + final panel wiring + manual verification recipe

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts`
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/components/RunButton.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-11.
- Produces: the complete, usable badge + logo overlay flow, in both Preview and real Run.

- [ ] **Step 1: Add badge/logo to `previewApply`**

Open `ae-iterations-next/src/jsx/aeft/aeft.ts`. Add these imports alongside the existing `applyMediaLayer`/`addEmojiToComp` imports:

```ts
import { addBadgeToComp, removeBadgeFromComp } from "./lib/applyBadge";
import { addLogoToComp, removeLogoFromComp } from "./lib/applyLogo";
```

Change `previewApply`'s signature from:

```ts
export const previewApply = (cfg: { compName: string; layers: CfgLayer[]; values: LayerValue[] }): { log: string[] } => {
```

to:

```ts
export const previewApply = (cfg: {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[];
  badge?: { text: string; x: number; y: number; size: number; circleColor: [number, number, number]; textColor: [number, number, number] };
  logo?: { path: string; x: number; y: number; size: number };
}): { log: string[] } => {
```

Find:

```ts
  const log: string[] = [];
  app.beginUndoGroup("Preview Apply");
  app.beginSuppressDialogs();
  removeEmojiFromComp(comp);

  // Media swaps need importFile, which (per runVarIterationBatch) silently
  // returns null while dialogs are suppressed -- lift suppression just for
  // the import pass, then restore it for the rest of the apply.
  app.endSuppressDialogs(false);
  const preImportedMedia: Record<number, FootageItem> = {};
```

and change it to:

```ts
  const log: string[] = [];
  app.beginUndoGroup("Preview Apply");
  app.beginSuppressDialogs();
  removeEmojiFromComp(comp);
  // Unconditional, regardless of whether THIS call includes cfg.badge/cfg.logo
  // -- if a previous Preview click left one behind (e.g. the user then
  // disabled the toggle and clicked Preview again), it must not linger and
  // shift layer indices, same reasoning as removeEmojiFromComp above.
  removeBadgeFromComp(comp);
  removeLogoFromComp(comp);

  // Media/logo swaps need importFile, which (per runVarIterationBatch)
  // silently returns null while dialogs are suppressed -- lift suppression
  // just for the import pass, then restore it for the rest of the apply.
  app.endSuppressDialogs(false);
  const preImportedMedia: Record<number, FootageItem> = {};
```

Find:

```ts
  }
  app.beginSuppressDialogs();

  for (let li = 0; li < cfg.layers.length; li++) {
```

and change it to:

```ts
  }

  let logoFootage: FootageItem | null = null;
  if (cfg.logo) {
    try {
      const lf = new File(cfg.logo.path);
      if (!lf.exists) {
        log.push("Logo: file not found");
      } else {
        logoFootage = app.project.importFile(new ImportOptions(lf)) as FootageItem;
        if (!logoFootage) log.push("Logo: importFile returned null");
      }
    } catch (e: any) {
      log.push("Logo: import error: " + e.message);
    }
  }
  app.beginSuppressDialogs();

  for (let li = 0; li < cfg.layers.length; li++) {
```

Find the end of the main loop:

```ts
    const results = applyLayerValue(layer, lc, cfg.values[li]);
    for (let ri = 0; ri < results.length; ri++) {
      log.push("  " + results[ri]);
    }
  }
  app.endUndoGroup();
  app.endSuppressDialogs(false);

  return { log };
};
```

and change it to:

```ts
    const results = applyLayerValue(layer, lc, cfg.values[li]);
    for (let ri = 0; ri < results.length; ri++) {
      log.push("  " + results[ri]);
    }
  }

  // Independent of the per-layer loop above, same as the media-import block.
  if (cfg.badge) {
    addBadgeToComp(comp, cfg.badge.text, cfg.badge.x, cfg.badge.y, cfg.badge.size, cfg.badge.circleColor, cfg.badge.textColor);
    log.push("Badge: applied");
  }
  if (cfg.logo && logoFootage) {
    addLogoToComp(comp, logoFootage, cfg.logo.x, cfg.logo.y, cfg.logo.size);
    log.push("Logo: applied");
  }

  app.endUndoGroup();
  app.endSuppressDialogs(false);

  return { log };
};
```

- [ ] **Step 2: Wire `LayerInfoPanel`'s `previewIteration` to send badge/logo**

Open `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`. Add the badge/logo store fields to the existing `useAppStore` destructure (the one already modified in Task 10) — change:

```ts
      badgeEnabled: s.badgeEnabled,
      setBadgeEnabled: s.setBadgeEnabled,
      logoEnabled: s.logoEnabled,
      setLogoEnabled: s.setLogoEnabled,
```

to:

```ts
      badgeEnabled: s.badgeEnabled,
      setBadgeEnabled: s.setBadgeEnabled,
      badgeTexts: s.badgeTexts,
      badgeX: s.badgeX,
      badgeY: s.badgeY,
      badgeSize: s.badgeSize,
      badgeCircleColor: s.badgeCircleColor,
      badgeTextColor: s.badgeTextColor,
      logoEnabled: s.logoEnabled,
      setLogoEnabled: s.setLogoEnabled,
      logoPath: s.logoPath,
      logoX: s.logoX,
      logoY: s.logoY,
      logoSize: s.logoSize,
```

and add the corresponding names to the outer destructure line right above it — change:

```ts
    emojiEnabled, setEmojiEnabled,
    badgeEnabled, setBadgeEnabled, logoEnabled, setLogoEnabled,
  } = useAppStore(
```

to:

```ts
    emojiEnabled, setEmojiEnabled,
    badgeEnabled, setBadgeEnabled, badgeTexts, badgeX, badgeY, badgeSize, badgeCircleColor, badgeTextColor,
    logoEnabled, setLogoEnabled, logoPath, logoX, logoY, logoSize,
  } = useAppStore(
```

Find `previewIteration`:

```ts
  const previewIteration = (iter: number) => {
    if (!compName) return;
    const layers = toCfgLayers(rowLayers);
    const iterValues = rowLayers.map((r) => effectiveValue(r, iter));
    evalTS("previewApply", { compName, layers, values: iterValues })
      .then((res) => console.log(res.log.join("\n")))
      .catch((err) => alert("Preview failed: " + evalTSErrorMessage(err)));
  };
```

and change it to:

```ts
  const previewIteration = (iter: number) => {
    if (!compName) return;
    const layers = toCfgLayers(rowLayers);
    const iterValues = rowLayers.map((r) => effectiveValue(r, iter));
    // Gated on mode === "var", not just badgeEnabled/logoEnabled: those flags
    // persist in the store across a mode switch (nothing resets them), so an
    // ITR-mode Preview must not send a leftover VAR-mode badge/logo config.
    const badge =
      mode === "var" && badgeEnabled
        ? { text: badgeTexts[iter] ?? "", x: badgeX, y: badgeY, size: badgeSize, circleColor: badgeCircleColor, textColor: badgeTextColor }
        : undefined;
    const logo =
      mode === "var" && logoEnabled && logoPath
        ? { path: logoPath, x: logoX, y: logoY, size: logoSize }
        : undefined;
    evalTS("previewApply", { compName, layers, values: iterValues, badge, logo })
      .then((res) => console.log(res.log.join("\n")))
      .catch((err) => alert("Preview failed: " + evalTSErrorMessage(err)));
  };
```

- [ ] **Step 3: Wire `RunButton` to send badge/logo on VAR runs**

Open `ae-iterations-next/src/js/main/components/RunButton.tsx`. Change the `useAppStore` call from:

```ts
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
```

to:

```ts
  const {
    compName, rowLayers, count, mode, varNames,
    emojiEnabled, emojiPaths, emojiX, emojiY, emojiSize, emojiLayerIndex,
    badgeEnabled, badgeTexts, badgeX, badgeY, badgeSize, badgeCircleColor, badgeTextColor,
    logoEnabled, logoPath, logoX, logoY, logoSize,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, rowLayers: s.rowLayers, count: s.count, mode: s.mode, varNames: s.varNames,
      emojiEnabled: s.emojiEnabled, emojiPaths: s.emojiPaths, emojiX: s.emojiX, emojiY: s.emojiY,
      emojiSize: s.emojiSize, emojiLayerIndex: s.emojiLayerIndex,
      badgeEnabled: s.badgeEnabled, badgeTexts: s.badgeTexts, badgeX: s.badgeX, badgeY: s.badgeY,
      badgeSize: s.badgeSize, badgeCircleColor: s.badgeCircleColor, badgeTextColor: s.badgeTextColor,
      logoEnabled: s.logoEnabled, logoPath: s.logoPath, logoX: s.logoX, logoY: s.logoY, logoSize: s.logoSize,
    }))
  );
```

Find the `mode === "var"` branch:

```ts
    if (mode === "var") {
      setStatus("Running VAR…");
      setStatusKind("running");
      const names = Array.from({ length: count }, (_, i) => varNames[i] || `VAR${i + 1}`);
      evalTS("runVarIterations", { compName: compName || "", layers, values, count, varNames: names })
        .then((res) => handleResult(res, "variants"))
        .catch(handleError);
    } else {
```

and change it to:

```ts
    if (mode === "var") {
      setStatus("Running VAR…");
      setStatusKind("running");
      const names = Array.from({ length: count }, (_, i) => varNames[i] || `VAR${i + 1}`);
      const badge = {
        enabled: badgeEnabled,
        perIteration: Array.from({ length: count }, (_, i) => badgeTexts[i] ?? null),
        x: badgeX,
        y: badgeY,
        size: badgeSize,
        circleColor: badgeCircleColor,
        textColor: badgeTextColor,
      };
      const logo = { enabled: logoEnabled, path: logoPath, x: logoX, y: logoY, size: logoSize };
      evalTS("runVarIterations", { compName: compName || "", layers, values, count, varNames: names, badge, logo })
        .then((res) => handleResult(res, "variants"))
        .catch(handleError);
    } else {
```

`badge`/`logo` are always sent (never `undefined`), matching ITR's existing `emoji` object right below in this same function — the host reads `.enabled` internally, so an "off" toggle just means `enabled: false` with the rest of the object still fully, consistently typed.

- [ ] **Step 4: Run the full test suite**

```bash
cd ae-iterations-next
npm run test
```

Expected: PASS, no regressions across the whole suite.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/aeft.ts ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx ae-iterations-next/src/js/main/components/RunButton.tsx
git commit -m "feat: wire badge/logo into previewApply, RunButton, and LayerInfoPanel"
```

- [ ] **Step 7: Write the manual verification recipe**

This is the real acceptance test for the whole plan — no subagent can perform it (no GUI access to After Effects). Write the following recipe into your task report:

**Setup:**
1. Pick or create a real VAR test project matching the naming convention, containing the 4 render precomps ending in `_9x16`, `_1x1`, `_16x9`, `_4x5`.
2. Create at least one logo image file (any small PNG) and drop it into the logo library folder (`~/Library/Application Support/AE Iterations/logos/` on macOS — check the panel's empty-state text if unsure of the exact path on your OS).
3. Build and reload the extension (`npm run build`, reopen the "AE Iterations (Next)" panel in AE).

**Test badge overlay (Preview):**
4. Switch to VAR mode, refresh a layer selection so `compName` is set. Toggle on "Badge overlay" — confirm `BadgeSection` expands with Position/Size fields, circle/text color pickers, a "Position visually…" button, and one text input per iteration.
5. Type free text into a couple of rows (e.g. "25+", "50% OFF" — confirm it's not restricted to digits).
6. Click "Position visually…" — confirm a popup opens showing a real snapshot of the current comp (not a blank box), with a circular marker at the current X/Y. Drag the marker — confirm it moves smoothly and the X/Y number fields update live to match. Click "Done" to close.
7. Click a row's Preview button — confirm the badge (a filled circle with centered, legible text) appears on the currently active comp at the configured position/size/colors, and that Ctrl+Z removes it cleanly. **This is Task 4's live-verification point** — if the circle doesn't render, the text isn't centered, or an error is thrown, trace it against `applyBadge.ts`'s vector-shape match-names before assuming it's an environment issue.

**Test logo overlay (Preview):**
8. Toggle on "Logo overlay" — confirm `LogoSection` shows a thumbnail grid containing the file you dropped into the logo folder in Setup step 2 (not an empty-state message).
9. Click the thumbnail to select it, adjust Position/Size, click a row's Preview button — confirm the logo image appears on the active comp at the configured position, and Ctrl+Z removes it cleanly.
10. With both Badge and Logo toggled on simultaneously, click Preview again — confirm **both** appear together (Decision 2: stacked, not mutually exclusive).

**Test a real VAR Run:**
11. With badge text set on a few iterations and a logo selected, click "Run VAR" — confirm the run completes with a status showing either success or a specific, readable warning list.
12. For each variant's output folder, open the collected `.aep` and confirm: the badge (with that variant's own text) and logo both appear correctly positioned on the **9x16** render comp only — confirm they do **not** appear on the 1x1/16x9/4x5 render comps.
13. Confirm the exported PNG/video renders for each variant show the badge/logo baked in at the correct position.

**Test the leftover-preview-layer defense (Task 11's "watch out for" item 2):**
14. Click a row's Preview button (leaving a live badge/logo layer in the currently open project), then **without pressing Ctrl+Z**, click "Run VAR" immediately. Confirm every variant's badge text/logo still matches that variant's own configured values — not a single duplicated/leftover layer from the preview click that was still on the canvas when the run started.

**Test the emoji-extraction regression check (Task 2, if skipped for lack of a live session there):**
15. Switch to ITR mode, enable "Emoji overlay", click a thumbnail, click "Preview Emoji" — confirm the emoji still appears correctly and Ctrl+Z still removes it. This confirms Task 2's `applyImageOverlay.ts` extraction didn't change ITR's shipped behavior.

If any step fails, trace the specific failing step against the relevant task's "watch out for" list or live-verification callout before assuming it's an environment issue.

---

## Self-Review Notes

- **Spec coverage:** every decision in the design spec (VAR-only scope; both overlays stackable; free-text per-iteration badge; folder-backed logo picker, not a Browse dialog; raw X/Y as source of truth plus an optional visual popup; 9x16-only application; `.aep`-UI import out of scope) has a corresponding task. The two Risks the spec called out explicitly (shape/text layer creation; drag coordinate math) are Tasks 4 and 9, each flagged for live/test verification rather than assumed correct.
- **Type consistency checked:** `BadgeConfig`/`LogoConfig` (Task 1) are used with identical field names (`enabled`, `perIteration`, `x`, `y`, `size`, `circleColor`, `textColor` / `enabled`, `path`, `x`, `y`, `size`) across Tasks 7, 11, 12. `addBadgeToComp(comp, text, x, y, size, circleColor, textColor)` (Task 4) and `addLogoToComp(comp, footage, x, y, size)` (Task 3) have the same signatures everywhere they're called (Tasks 11, 12). `addImageOverlayToComp`/`removeImageOverlayFromComp` (Task 2) are used identically by both `applyEmoji.ts` and `applyLogo.ts` (Task 3).
- **Colors are 0-1 float RGB** throughout (Task 7's defaults `[1,1,1]`/`[0,0,0]`, not `[255,255,255]`/`[0,0,0]`) — corrected from a cosmetic-default inconsistency in the design spec's own example values, verified against `applyChange.ts`'s existing `.setValue(colorRGB)` convention before writing Task 1/7/4.
- **No placeholders:** every task ships complete, real code — either extracted/wrapped from a real existing implementation (Task 2's `applyImageOverlay.ts`, Task 3's `applyLogo.ts`) or fresh code whose AE-scripting API surface (Task 4) and coordinate math (Task 9) are explicitly flagged as unvalidated-until-tested rather than silently assumed correct.
