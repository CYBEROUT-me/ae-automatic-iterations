# VAR Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add VAR mode (named-variant runs with per-layer media replacement) to `ae-iterations-next`, Phase 3 of the BoltCEP rewrite, with a "Test" diagnostic button that scans for expected render comps before a real run.

**Architecture:** VAR gets its own `runVarIterationBatch` orchestration function — not forced into ITR's `IterationStrategy` — sharing the same underlying lib primitives (`applyLayerValue`, `renderPNGs`/`renderVideos`, `cleanProject`, `performCollect`). A `mode: "itr" | "var"` field in the Zustand store drives both which layer-type handler renders a footage layer's row (`video` vs `media`) and which host command the Run button calls.

**Tech Stack:** Same as Phase 1-2 — BoltCEP (React, TypeScript, Vite), Zustand, Vitest + React Testing Library, `types-for-adobe` ambient ExtendScript types.

## Global Constraints

- New work lands entirely in `ae-iterations-next/` (this session's decision: ITR_4x5 and VAR mode apply only to the new extension, not the current production `extension/`).
- Baseline is still the last commit of the current production extension, v1.0.11, for anything ported from it — EXCEPT `stripAspectSuffix` and the aspect-suffix list, which were never actually committed anywhere in this repo's history despite the committed `runVarIterationsJSON` calling them throughout (verified via `git log --all -S`). Those two pieces are written fresh in this plan, inferred from their call sites in the committed code, not ported from an existing file.
- VAR renders 4 aspect ratios: `9x16`, `1x1`, `16x9`, `4x5` (`VAR_ASPECT_SUFFIXES`), matching ITR's `ITR_4x5` addition. VAR's suffixes have no `ITR_` prefix, matching the original convention.
- Scope: Run + a read-only "Test" diagnostic only. No VAR-mode Preview in this phase (a deliberate scope cut, not an oversight — hide the Preview UI in VAR mode rather than leaving a half-working button).
- Host-command convention (unchanged from Phase 1-2): exported command entry points throw `Error` on failure, return their typed payload directly on success. Internal library functions keep their own established return conventions.
- Real ExtendScript ambient types come from `types-for-adobe/AfterEffects/22.0`. Known gaps already found and fixed in this codebase: `AVLayer.Effects` (capital) is missing from the ambient types (only lowercase `effect` is declared) — always use `(x as any).Effects`, never `layer.effect`. If you hit a NEW gap, check the CURRENT SHIPPING `extension/jsx/host.jsx`'s `runVarIterationsJSON` (lines 429-690) for the real property name before assuming the type package is authoritative — never substitute a plausible-but-different name.
- A clean `npm run build` does NOT prove an `evalTS(...)` call site's argument/return shape matches the real host function signature — that config type-checks against a permissive stub, not the real `aeft` module. Verify every new call site by reading both sides yourself.
- **Zustand selector rule (this crashed the panel once already):** any `useAppStore(...)` selector that returns a plain object literal (`(s) => ({ a: s.a, b: s.b })`) MUST be wrapped in `useShallow` from `zustand/react/shallow`. An unwrapped object-returning selector makes `useSyncExternalStore` treat the snapshot as always-changing, which throws React error #185 ("Maximum update depth exceeded") before anything renders. Selectors returning a single primitive/field (`(s) => s.count`) don't need this.
- No subagent in this pipeline has GUI access to After Effects. Every task touching the live AE object model is verified via: TypeScript reasoning, `npm run build` succeeding, inspecting the compiled `dist/cep/jsx/index.js` bundle, and line-by-line comparison against the current shipping `.jsx` source. The final task's manual verification recipe is the real gate — flag it as such.
- This plan does not add any throwaway/temporary debug commands or buttons (unlike some Phase 1-2 tasks) — every host function lands directly wired into its real caller within the same or an immediately adjacent task, so there's no scaffolding to clean up later.

---

## File Structure

```
ae-iterations-next/src/
  shared/
    types.ts                         # MODIFY: "media" LayerType, LayerValue.mediaPath,
                                      #   RunVarConfig, TestVarCompsResult
  jsx/aeft/
    lib/
      naming.ts                      # MODIFY: add stripAspectSuffix, VAR_ASPECT_SUFFIXES
      naming.test.ts                 # MODIFY: add stripAspectSuffix tests
      render.ts                      # MODIFY: renderPNGs/renderVideos take a suffixes param
      applyMedia.ts                  # NEW: applyMediaLayer
    engine/
      runIterationBatch.ts           # MODIFY: pass ITR_SUFFIXES to renderPNGs/renderVideos
      runVarIterationBatch.ts        # NEW: VAR's own orchestration function
    aeft.ts                          # MODIFY: add runVarIterations, testVarRenderComps,
                                      #   browseForMedia commands
  js/main/
    components/
      MediaFields.tsx                # NEW
      MediaFields.test.tsx           # NEW
      ModeTabs.tsx                   # MODIFY: VAR tab becomes clickable
      ModeTabs.test.tsx              # NEW
      VarNamesRow.tsx                # NEW
      VarNamesRow.test.tsx           # NEW
      RunButton.tsx                  # MODIFY: mode-aware (calls runIterations or
                                      #   runVarIterations)
      LayerInfoPanel.tsx             # MODIFY: render VarNamesRow + Test button in VAR mode,
                                      #   hide Preview row + same-for-all checkbox in VAR mode
    state/
      store.ts                       # MODIFY: add mode, varNames, setMode, setVarName
      store.test.ts                  # MODIFY: add setMode/setVarName tests
      rowLayers.ts                   # MODIFY: buildRowLayers takes a mode param
      rowLayers.test.ts              # MODIFY: add media-relabeling tests
      effectiveValue.ts              # MODIFY: never borrows under VAR mode
      effectiveValue.test.ts         # MODIFY: add "never borrows in VAR mode" test
      layerHandlers.ts               # MODIFY: register the "media" handler
```

---

### Task 1: `stripAspectSuffix` + `VAR_ASPECT_SUFFIXES`

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/lib/naming.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/lib/naming.test.ts`

**Interfaces:**
- Produces: `VAR_ASPECT_SUFFIXES: string[]`, `stripAspectSuffix(name: string): string`. Consumed by `runVarIterationBatch.ts` (Task 9) and `aeft.ts`'s `testVarRenderComps` (Task 10).

Per the Global Constraints, `stripAspectSuffix`/the aspect-suffix list were never actually committed anywhere in this repo despite the committed `runVarIterationsJSON` calling them throughout. This task writes them fresh, inferred from every call site in `extension/jsx/host.jsx`'s `runVarIterationsJSON` (lines 429-690): it strips a trailing `_9x16`/`_1x1`/`_16x9` suffix (now also `_4x5`) to get a project/comp base name, leaving the name unchanged if no such suffix is present.

- [ ] **Step 1: Write the failing tests**

Add to `src/jsx/aeft/lib/naming.test.ts` (alongside the existing `incrementProjectId` tests — read the file first to match its existing import/describe style exactly):

```ts
import { stripAspectSuffix } from "./naming";

describe("stripAspectSuffix", () => {
  it("strips a trailing _9x16 suffix", () => {
    expect(stripAspectSuffix("TL_11352_Video_VAR_9x16")).toBe("TL_11352_Video_VAR");
  });

  it("strips a trailing _4x5 suffix", () => {
    expect(stripAspectSuffix("TL_11352_Video_VAR_4x5")).toBe("TL_11352_Video_VAR");
  });

  it("returns the name unchanged when no aspect suffix is present", () => {
    expect(stripAspectSuffix("TL_11352_Video_VAR")).toBe("TL_11352_Video_VAR");
  });

  it("only strips a trailing suffix, not one that appears mid-string", () => {
    expect(stripAspectSuffix("TL_9x16_Video_VAR_1x1")).toBe("TL_9x16_Video_VAR");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — `stripAspectSuffix` is not exported from `./naming`.

- [ ] **Step 3: Implement**

Add to `src/jsx/aeft/lib/naming.ts` (keep the existing `incrementProjectId` untouched):

```ts
export const VAR_ASPECT_SUFFIXES = ["9x16", "1x1", "16x9", "4x5"];

export function stripAspectSuffix(name: string): string {
  for (let s = 0; s < VAR_ASPECT_SUFFIXES.length; s++) {
    const suffix = "_" + VAR_ASPECT_SUFFIXES[s];
    if (name.slice(-suffix.length) === suffix) {
      return name.slice(0, -suffix.length);
    }
  }
  return name;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test
```

Expected: PASS, no regressions in the existing suite.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/naming.ts ae-iterations-next/src/jsx/aeft/lib/naming.test.ts
git commit -m "feat: add stripAspectSuffix and VAR_ASPECT_SUFFIXES"
```

---

### Task 2: Shared types + `buildRowLayers` mode-awareness

**Files:**
- Modify: `ae-iterations-next/src/shared/types.ts`
- Modify: `ae-iterations-next/src/js/main/state/rowLayers.ts`
- Modify: `ae-iterations-next/src/js/main/state/rowLayers.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `LayerType` including `"media"`; `LayerValue.mediaPath?: string | null`; `RunVarConfig`, `TestVarCompsResult` types; `type Mode = "itr" | "var"`; `buildRowLayers(layers: LayerInfo[], mode: Mode): RowLayer[]` (signature change — every existing call site must be updated). Consumed by Task 3 (`MediaFields`/`layerHandlers`), Task 4 (`store.ts`), Task 9/10 (host-side `RunVarConfig`/`TestVarCompsResult`), Task 11 (`RunButton`).

`getLayerType` still reports a footage/video layer as `"video"` — this task's relabeling to `"media"` happens only in `buildRowLayers`, only under VAR mode, matching the original extension's `if (li.type === "video" && currentMode === "var") layerType = "media"`.

- [ ] **Step 1: Add the type changes**

In `src/shared/types.ts`, change:

```ts
export type LayerType = "shape" | "text" | "stroke" | "video" | "unknown";
```

to:

```ts
export type LayerType = "shape" | "text" | "stroke" | "video" | "media" | "unknown";
```

Add `mediaPath` to `LayerValue`:

```ts
export interface LayerValue {
  color?: [number, number, number] | null;
  font?: string | null;
  content?: string | null;
  flip?: boolean;
  bw?: boolean;
  tint?: [number, number, number] | null;
  tintAmount?: number;
  hue?: number;
  mediaPath?: string | null;
}
```

Add two new interfaces at the end of the file:

```ts
export interface RunVarConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][]; // [iter][layer row index], matching `layers` order
  varNames: string[];
  count: number;
}

export interface TestVarCompsResult {
  log: string[];
}
```

- [ ] **Step 2: Write the failing tests**

Read `src/js/main/state/rowLayers.test.ts` first to see its exact current structure (it already has tests for `buildRowLayers` from Phase 1-2 with a single-argument call — those will need updating too). Update every existing `buildRowLayers(layers)` call in that file to `buildRowLayers(layers, "itr")`, then add:

```ts
describe("buildRowLayers mode-awareness", () => {
  it("relabels video layers to media under VAR mode", () => {
    const layers: LayerInfo[] = [
      { name: "BG", index: 3, type: "video", videoState: { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 } },
    ];
    const rows = buildRowLayers(layers, "var");
    expect(rows[0].type).toBe("media");
  });

  it("keeps video layers as video under ITR mode", () => {
    const layers: LayerInfo[] = [
      { name: "BG", index: 3, type: "video", videoState: { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 } },
    ];
    const rows = buildRowLayers(layers, "itr");
    expect(rows[0].type).toBe("video");
  });

  it("does not relabel shape/text/stroke rows under VAR mode", () => {
    const layers: LayerInfo[] = [
      { name: "Rect", index: 1, type: "shape", fills: [{ path: "Contents/Fill 1", color: [1, 0, 0] }], strokes: [] },
    ];
    const rows = buildRowLayers(layers, "var");
    expect(rows[0].type).toBe("shape");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — `buildRowLayers` doesn't accept a second argument yet (TypeScript compile error surfaces as a test run failure), and the new tests fail.

- [ ] **Step 4: Implement**

In `src/js/main/state/rowLayers.ts`, read the current file first, then add the `Mode` type and thread it through:

```ts
export type Mode = "itr" | "var";

export function buildRowLayers(layers: LayerInfo[], mode: Mode): RowLayer[] {
  const rows: RowLayer[] = [];
  for (const layer of layers) {
    if (layer.type === "shape") {
      const fillPath = layer.fills && layer.fills.length ? layer.fills[0].path : "";
      rows.push({ layerIndex: layer.index, rowKey: String(layer.index), type: "shape", name: layer.name, fillPath });
      (layer.strokes || []).forEach((stroke, i) => {
        rows.push({
          layerIndex: layer.index,
          rowKey: `${layer.index}:stroke:${i}`,
          type: "stroke",
          name: `Stroke — ${layer.name}`,
          fillPath: stroke.path,
        });
      });
    } else {
      const effectiveType = layer.type === "video" && mode === "var" ? "media" : layer.type;
      rows.push({ layerIndex: layer.index, rowKey: String(layer.index), type: effectiveType, name: layer.name, fillPath: "" });
    }
  }
  return rows;
}
```

(Leave `toCfgLayers` untouched — it already copies `RowLayer.type` verbatim into `CfgLayer.layerType`, so once `buildRowLayers` bakes in the right type per mode, `toCfgLayers` needs no VAR-specific variant.)

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test
```

Expected: PASS. If `npm run build` was previously used to typecheck, also run it to confirm no other file still calls `buildRowLayers` with one argument:

```bash
npm run build
```

If the build fails on a stale one-argument call site, fix it now (search `grep -rn "buildRowLayers(" src/`).

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/src/shared/types.ts ae-iterations-next/src/js/main/state/rowLayers.ts ae-iterations-next/src/js/main/state/rowLayers.test.ts
git commit -m "feat: add media LayerType and mode-aware buildRowLayers"
```

---

### Task 3: `MediaFields` component + handler registration

**Files:**
- Create: `ae-iterations-next/src/js/main/components/MediaFields.tsx`
- Create: `ae-iterations-next/src/js/main/components/MediaFields.test.tsx`
- Modify: `ae-iterations-next/src/js/main/state/layerHandlers.ts`

**Interfaces:**
- Consumes: `RowLayer`, `useAppStore` (existing), `evalTS` (`../../lib/utils/bolt`), a new host command `browseForMedia(): { path: string | null }` (added in Task 10 — this task's component calls it by name via `evalTS`, which is fine even before Task 10 exists since nothing executes it until Task 10 lands; the component test mocks `evalTS` so it doesn't need the real host command yet).
- Produces: `LAYER_HANDLERS["media"]`.

This task is 100% panel-side, fully covered by automated tests — no AE dependency at all, same as `ColorFields`/`VideoFields` before it.

- [ ] **Step 1: Write the failing tests**

Read `src/js/main/components/VideoFields.tsx` and its test file first to match the established component/test conventions exactly (import paths, mocking style). Create `src/js/main/components/MediaFields.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MediaFields } from "./MediaFields";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn(() => Promise.resolve({ path: "/Users/test/movie.mov" })),
}));

const row: RowLayer = { layerIndex: 5, rowKey: "5", type: "media", name: "BG", fillPath: "" };

describe("MediaFields", () => {
  beforeEach(() => {
    useAppStore.setState({ values: {} });
  });

  it("shows 'No file' until a file is chosen", () => {
    render(<MediaFields row={row} iter={0} />);
    expect(screen.getByText("No file")).toBeInTheDocument();
  });

  it("updates the store and label after browsing", async () => {
    render(<MediaFields row={row} iter={0} />);
    fireEvent.click(screen.getByText("Browse…"));
    await new Promise((r) => setTimeout(r, 0));
    expect(useAppStore.getState().values["5"]?.[0]?.mediaPath).toBe("/Users/test/movie.mov");
    expect(screen.getByText("movie.mov")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — `Cannot find module './MediaFields'`.

- [ ] **Step 3: Implement `MediaFields.tsx`**

```tsx
import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { evalTS } from "../../lib/utils/bolt";

export function MediaFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  const fileName = value?.mediaPath ? value.mediaPath.split("/").pop() : "No file";

  const browse = () => {
    evalTS("browseForMedia")
      .then((res) => {
        if (res.path) setValue(row.rowKey, iter, { ...value, mediaPath: res.path });
      })
      .catch((err) => alert("Browse failed: " + String(err)));
  };

  return (
    <div className="media-fields">
      <button onClick={browse}>Browse…</button>
      <span className="media-file-label">{fileName}</span>
    </div>
  );
}
```

- [ ] **Step 4: Register the handler**

In `src/js/main/state/layerHandlers.ts`, read the current file first (it should have `shape`/`text`/`stroke`/`video` entries), then add:

```ts
import { MediaFields } from "../components/MediaFields";
```
```ts
  media: { RowFields: MediaFields },
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test
```

Expected: PASS, no regressions.

- [ ] **Step 6: Verify build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/MediaFields.tsx ae-iterations-next/src/js/main/components/MediaFields.test.tsx ae-iterations-next/src/js/main/state/layerHandlers.ts
git commit -m "feat: add media layer handler (browse + replace)"
```

---

### Task 4: Store mode/varNames + `effectiveValue` mode-awareness

**Files:**
- Modify: `ae-iterations-next/src/js/main/state/store.ts`
- Modify: `ae-iterations-next/src/js/main/state/store.test.ts`
- Modify: `ae-iterations-next/src/js/main/state/effectiveValue.ts`
- Modify: `ae-iterations-next/src/js/main/state/effectiveValue.test.ts`

**Interfaces:**
- Consumes: `buildRowLayers(layers, mode)` (Task 2), `Mode` type (Task 2).
- Produces: `AppState.mode: Mode`, `AppState.varNames: string[]`, `setMode(mode: Mode): void`, `setVarName(index: number, name: string): void`. `effectiveValue`'s new mode parameter. Consumed by Tasks 5, 6, 11.

The original extension hides its "same value for all layers" checkbox ENTIRELY in VAR mode (`extension/js/main.js`'s `switchMode`: `sameAllSection.classList.toggle("hidden", mode === "var" || ...)`), meaning VAR mode never borrows values across layers, regardless of any stored checkbox state. This task makes `effectiveValue` reflect that directly (mode is an unconditional bypass, same tier as the existing stroke/video exclusion), and Task 11 hides the checkbox UI in VAR mode to match.

- [ ] **Step 1: Write the failing store tests**

Read `src/js/main/state/store.ts` and `store.test.ts` first to match the exact current shape (fields, setter names) before writing new tests. Add:

```ts
describe("setMode", () => {
  it("recomputes rowLayers from stored layerInfo when mode changes", () => {
    const layers = [
      { name: "BG", index: 1, type: "video" as const, videoState: { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 } },
    ];
    useAppStore.getState().setLayerInfo("Comp A", layers);
    expect(useAppStore.getState().rowLayers[0].type).toBe("video");

    useAppStore.getState().setMode("var");
    expect(useAppStore.getState().mode).toBe("var");
    expect(useAppStore.getState().rowLayers[0].type).toBe("media");
  });
});

describe("setVarName", () => {
  it("sets a name at the given index without disturbing others", () => {
    useAppStore.getState().setVarName(0, "Red Variant");
    useAppStore.getState().setVarName(2, "Blue Variant");
    expect(useAppStore.getState().varNames[0]).toBe("Red Variant");
    expect(useAppStore.getState().varNames[2]).toBe("Blue Variant");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — `setMode`/`setVarName` don't exist yet.

- [ ] **Step 3: Implement the store changes**

In `src/js/main/state/store.ts`, add `mode` and `varNames` to the state shape, and update `setLayerInfo` to pass the current mode into `buildRowLayers` (read the current file first for the exact existing field list and adapt precisely — this sketch shows the new/changed pieces only):

```ts
import type { Mode } from "./rowLayers"; // adjust the import path to match where Mode actually lives after Task 2
```
```ts
interface AppState {
  // ...existing fields...
  mode: Mode;
  varNames: string[];
  setMode(mode: Mode): void;
  setVarName(index: number, name: string): void;
}
```
```ts
export const useAppStore = create<AppState>((set, get) => ({
  // ...existing fields...
  mode: "itr",
  varNames: [],
  setLayerInfo: (compName, layers) =>
    set((s) => ({ compName, layerInfo: layers, rowLayers: buildRowLayers(layers, s.mode), values: {} })),
  setMode: (mode) =>
    set((s) => ({ mode, rowLayers: buildRowLayers(s.layerInfo, mode) })),
  setVarName: (index, name) =>
    set((s) => {
      const varNames = [...s.varNames];
      varNames[index] = name;
      return { varNames };
    }),
  // ...existing setters/getters unchanged...
}));
```

- [ ] **Step 4: Run store tests to verify they pass**

```bash
npm run test
```

Expected: PASS for the new tests; check no existing test broke (existing `setLayerInfo` tests should still pass since `mode` defaults to `"itr"`, matching prior behavior).

- [ ] **Step 5: Write the failing `effectiveValue` test**

Read `src/js/main/state/effectiveValue.ts` and its test file first for the exact current signature (it takes `rowLayers, values, sameForAll, row, iter` per Phase 1-2 — this task adds a `mode` parameter). Add a test:

```ts
it("never borrows under VAR mode, even when sameForAll is true", () => {
  const rowLayers: RowLayer[] = [
    { layerIndex: 1, rowKey: "1", type: "text", name: "Title", fillPath: "" },
    { layerIndex: 2, rowKey: "2", type: "text", name: "Subtitle", fillPath: "" },
  ];
  const values = {
    "1": [{ color: [1, 0, 0] as [number, number, number], font: "Helvetica-Bold" }],
  };
  const nonFirstRow = rowLayers[1];
  const result = effectiveValue(rowLayers, values, /* sameForAll */ true, nonFirstRow, 0, "var");
  expect(result).toBeUndefined();
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npm run test
```

Expected: FAIL — either a TypeScript arity error (too many arguments) or the test assertion fails because the pre-existing function still borrows.

- [ ] **Step 7: Implement**

In `src/js/main/state/effectiveValue.ts`, read the current implementation first, then add the `mode` parameter as an unconditional bypass alongside the existing stroke/video exclusion:

```ts
export function effectiveValue(
  rowLayers: RowLayer[],
  values: Record<string, LayerValue[]>,
  sameForAll: boolean,
  row: RowLayer,
  iter: number,
  mode: Mode
): LayerValue | undefined {
  const own = values[row.rowKey]?.[iter];
  if (mode === "var" || !sameForAll || row.type === "stroke" || row.type === "video") return own;
  const first = rowLayers[0];
  if (!first || row.layerIndex === first.layerIndex) return own;
  const firstVal = values[first.rowKey]?.[iter];
  if (!firstVal) return own;
  return row.type === "text" ? { color: firstVal.color, font: firstVal.font } : { color: firstVal.color };
}
```

Update every existing call site of `effectiveValue` (search `grep -rn "effectiveValue(" src/js/main`) to pass the current mode as the new last argument — these call sites live in `LayerInfoPanel.tsx` and will be touched again in Task 11, but must compile now.

- [ ] **Step 8: Run tests to verify they pass**

```bash
npm run test
npm run build
```

Expected: both PASS/exit 0, no regressions.

- [ ] **Step 9: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/state/store.ts ae-iterations-next/src/js/main/state/store.test.ts ae-iterations-next/src/js/main/state/effectiveValue.ts ae-iterations-next/src/js/main/state/effectiveValue.test.ts
git commit -m "feat: add mode/varNames to store, mode-aware effectiveValue"
```

---

### Task 5: `ModeTabs` — VAR tab becomes clickable

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/ModeTabs.tsx`
- Create: `ae-iterations-next/src/js/main/components/ModeTabs.test.tsx`

**Interfaces:**
- Consumes: `useAppStore`, `s.mode`, `s.setMode` (Task 4).
- Produces: a working ITR/VAR tab switcher.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeTabs } from "./ModeTabs";
import { useAppStore } from "../state/store";

describe("ModeTabs", () => {
  beforeEach(() => {
    useAppStore.setState({ mode: "itr" });
  });

  it("starts with ITR active", () => {
    render(<ModeTabs />);
    expect(screen.getByText("ITR").className).toContain("active");
    expect(screen.getByText("VAR").className).not.toContain("active");
  });

  it("switches mode when VAR is clicked", () => {
    render(<ModeTabs />);
    fireEvent.click(screen.getByText("VAR"));
    expect(useAppStore.getState().mode).toBe("var");
    expect(screen.getByText("VAR").className).toContain("active");
    expect(screen.getByText("ITR").className).not.toContain("active");
  });

  it("switches back to ITR when clicked", () => {
    useAppStore.getState().setMode("var");
    render(<ModeTabs />);
    fireEvent.click(screen.getByText("ITR"));
    expect(useAppStore.getState().mode).toBe("itr");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — current `ModeTabs` renders a permanently-`disabled` VAR button with no click handler.

- [ ] **Step 3: Implement**

Replace `src/js/main/components/ModeTabs.tsx` entirely:

```tsx
import { useAppStore } from "../state/store";

export function ModeTabs() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  return (
    <div id="mode-tabs">
      <button className={"tab-btn" + (mode === "itr" ? " active" : "")} onClick={() => setMode("itr")}>
        ITR
      </button>
      <button className={"tab-btn" + (mode === "var" ? " active" : "")} onClick={() => setMode("var")}>
        VAR
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/ModeTabs.tsx ae-iterations-next/src/js/main/components/ModeTabs.test.tsx
git commit -m "feat: make VAR tab clickable, wire mode switching"
```

---

### Task 6: `VarNamesRow` component

**Files:**
- Create: `ae-iterations-next/src/js/main/components/VarNamesRow.tsx`
- Create: `ae-iterations-next/src/js/main/components/VarNamesRow.test.tsx`

**Interfaces:**
- Consumes: `useAppStore`, `s.count`, `s.varNames`, `s.setVarName` (Task 4).
- Produces: the per-iteration name-input row, rendered by `LayerInfoPanel` in Task 11.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VarNamesRow } from "./VarNamesRow";
import { useAppStore } from "../state/store";

describe("VarNamesRow", () => {
  beforeEach(() => {
    useAppStore.setState({ count: 3, varNames: [] });
  });

  it("renders one input per count", () => {
    render(<VarNamesRow />);
    expect(screen.getAllByPlaceholderText(/Name \d/)).toHaveLength(3);
  });

  it("updates the store when a name is typed", () => {
    render(<VarNamesRow />);
    const inputs = screen.getAllByPlaceholderText(/Name \d/);
    fireEvent.change(inputs[1], { target: { value: "Blue Variant" } });
    expect(useAppStore.getState().varNames[1]).toBe("Blue Variant");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — `Cannot find module './VarNamesRow'`.

- [ ] **Step 3: Implement**

```tsx
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";

export function VarNamesRow() {
  const { count, varNames, setVarName } = useAppStore(
    useShallow((s) => ({ count: s.count, varNames: s.varNames, setVarName: s.setVarName }))
  );

  return (
    <div id="var-names-row">
      {Array.from({ length: count }, (_, i) => (
        <input
          key={i}
          type="text"
          placeholder={`Name ${i + 1}`}
          value={varNames[i] ?? ""}
          onChange={(e) => setVarName(i, e.target.value)}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/VarNamesRow.tsx ae-iterations-next/src/js/main/components/VarNamesRow.test.tsx
git commit -m "feat: add per-iteration VAR name inputs"
```

---

### Task 7: Generalize `render.ts` for both aspect-suffix lists

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/lib/render.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts`

**Interfaces:**
- Consumes: `ITR_SUFFIXES` (existing, from `../lib/findComp`), `VAR_ASPECT_SUFFIXES` (Task 1, consumed later by Task 9 — this task only changes `render.ts`'s signature, it doesn't need to import `VAR_ASPECT_SUFFIXES` itself).
- Produces: `renderPNGs(comps, outFolder, suffixes: string[]): void`, `renderVideos(comps, outFolder, suffixes: string[]): void` — both gain a third parameter. Task 9's `runVarIterationBatch` calls these with `VAR_ASPECT_SUFFIXES`.

This is the one part of VAR mode that needs **zero new render code** — the original extension had a separate, partly-dead `renderVarPNGs`/`renderVarVideos` pair; this rewrite reuses the existing, already-verified `renderPNGs`/`renderVideos` by parameterizing the suffix list instead of hardcoding `ITR_SUFFIXES` inside them.

- [ ] **Step 1: Generalize `render.ts`**

Read the current file first. Remove the `import { ITR_SUFFIXES } from "./findComp";` line (no longer needed internally) and change both functions to take `suffixes` as a parameter:

```ts
export function renderPNGs(comps: Record<string, CompItem>, outFolder: Folder, suffixes: string[]): void {
  const errors: string[] = [];
  for (let s = 0; s < suffixes.length; s++) {
    const suffix = suffixes[s];
    const comp = comps[suffix];
    if (!comp) {
      errors.push("No comp found for suffix " + suffix);
      continue;
    }
    const prevRes = comp.resolutionFactor;
    if (prevRes[0] !== 1 || prevRes[1] !== 1) comp.resolutionFactor = [1, 1];
    try {
      comp.saveFrameToPng(0, new File(outFolder.fsName + "/" + comp.name + ".png"));
    } catch (e: any) {
      errors.push(comp.name + ": " + e.message);
    }
    comp.resolutionFactor = prevRes;
  }
  if (errors.length) throw new Error(errors.join(" | "));
}

export function renderVideos(comps: Record<string, CompItem>, outFolder: Folder, suffixes: string[]): void {
  const rq = app.project.renderQueue;
  const added: RenderQueueItem[] = [];
  for (let s = 0; s < suffixes.length; s++) {
    const comp = comps[suffixes[s]];
    if (!comp) continue;
    const rqItem = rq.items.add(comp);
    const om = rqItem.outputModules[1];
    try {
      const existingFile = om.file;
      const ext = existingFile ? (existingFile.name.match(/\.[^.]+$/) || [".mov"])[0] : ".mov";
      om.file = new File(outFolder.fsName + "/" + comp.name + ext);
    } catch (e: any) {
      rqItem.remove();
      throw new Error("Cannot set output file for " + comp.name + ": " + e.message);
    }
    added.push(rqItem);
  }
  if (!added.length) throw new Error("No comps in render queue");
  rq.render();
}
```

(The error message on the last line changed from `"No ITR comps in render queue"` to `"No comps in render queue"` — deliberate, since this function is no longer ITR-specific.)

- [ ] **Step 2: Update the ITR call site**

In `src/jsx/aeft/engine/runIterationBatch.ts`, read the current file first, then update both call sites to pass `ITR_SUFFIXES` explicitly (that import already exists in this file):

```ts
renderPNGs(itrComps, deliveryFolder, ITR_SUFFIXES);
```
```ts
renderVideos(itrComps, deliveryFolder, ITR_SUFFIXES);
```

- [ ] **Step 3: Verify build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: tests still pass (no automated tests cover `render.ts` directly — this is AE-object-model code, consistent with Phase 1-2 precedent), build exits 0. Inspect `dist/cep/jsx/index.js` to confirm `renderPNGs`/`renderVideos` now take a third parameter and the ITR call site passes `ITR_SUFFIXES`.

- [ ] **Step 4: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/render.ts ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts
git commit -m "refactor: parameterize render.ts suffix list for VAR reuse"
```

---

### Task 8: `applyMedia.ts`

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/applyMedia.ts`

**Interfaces:**
- Produces: `applyMediaLayer(layer: AVLayer, footage: FootageItem): boolean`. Consumed by `runVarIterationBatch.ts` (Task 9).

Ported from the committed `extension/jsx/host.jsx`'s `runVarIterationsJSON` inline `replaceSource` logic (lines 568-580) — NOT from the uncommitted `apply-media.jsx`, which remains out of scope.

- [ ] **Step 1: Implement**

```ts
// lib/applyMedia.ts — replace footage source and apply a scale-to-fill
// expression, for VAR-mode media-replacement layers. Matches the committed
// extension/jsx/host.jsx's runVarIterationsJSON inline logic (lines 568-580),
// not the uncommitted apply-media.jsx, which remains out of scope for this
// rewrite per the Phase 1-2 spec's Global Constraints.

export function applyMediaLayer(layer: AVLayer, footage: FootageItem): boolean {
  try {
    layer.replaceSource(footage, false);
  } catch (e) {
    return false;
  }
  try {
    layer.transform.scale.expression =
      "var rw = thisComp.width / source.width;\n" +
      "var rh = thisComp.height / source.height;\n" +
      "var r = Math.max(rw, rh) * 100;\n[r, r]";
  } catch (e) {
    // Matches the original: a failed expression assignment is silently
    // ignored — replaceSource succeeding is what matters for the boolean
    // result; the scale expression is a best-effort convenience.
  }
  return true;
}
```

If `AVLayer.replaceSource` or `FootageItem` don't type-check cleanly against the real `types-for-adobe` ambient declarations, check the actual declared signature (`node_modules/types-for-adobe/AfterEffects/22.0/index.d.ts`) before reaching for `any` — these are common, well-typed AE APIs and should not have the same gap `AVLayer.Effects` had, but verify rather than assume.

- [ ] **Step 2: Verify build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: tests unaffected (this file isn't imported anywhere yet — Task 9 wires it in), build exits 0. No automated test for this function (AE-object-model code, consistent with precedent) — Task 9's manual verification recipe covers it once it's wired in.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/applyMedia.ts
git commit -m "feat: add applyMediaLayer for VAR-mode media replacement"
```

---

### Task 9: `runVarIterationBatch` — the VAR orchestration function

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/engine/runVarIterationBatch.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/lib/findComp.ts`

**Interfaces:**
- Consumes: `applyLayerValue`, `applyLayerValueFailures` (`../lib/applyLayerValue`), `applyMediaLayer` (Task 8), `renderPNGs`/`renderVideos` (Task 7, called with `VAR_ASPECT_SUFFIXES`), `cleanProject` (`../lib/clean`), `performCollect` (`../lib/collect`), `stripAspectSuffix`/`VAR_ASPECT_SUFFIXES` (Task 1), `RunVarConfig`/`RunResult` (Task 2), `findCompByName`/`findCompsBySuffixes` (existing, in `lib/findComp.ts`).
- Produces: `runVarIterationBatch(cfg: RunVarConfig): RunResult`, and a new `findVarComp(name: string): CompItem | null` added to `lib/findComp.ts` (exported so Task 10's `testVarRenderComps` can reuse the same lookup instead of a fourth copy of the loop). Consumed by `aeft.ts`'s `runVarIterations` and `testVarRenderComps` commands (Task 10).

**This is the highest-risk task in this plan** — the exact class of bug Task 16 shipped once already (a scrambled operation order) is easy to reintroduce here, because VAR's real order is genuinely intricate. Read `extension/jsx/host.jsx`'s `runVarIterationsJSON` (lines 429-690) yourself, in full, before writing anything, and trace every step below against it.

**Watch out for, specifically** (each of these is a place a plausible-looking but wrong reordering would compile fine and only fail at runtime in real AE):
1. **Copy → OPEN → rename**, not copy → rename → open. Comp renaming operates on `app.project` — whatever document is currently active — so the copy must be open before its comps get renamed.
2. **Video renders BEFORE save** (while `replaceSource` media is still in-memory — the render queue handles that fine). **PNG renders AFTER save → close → reopen** (`saveFrameToPng` silently fails on in-memory `replaceSource` footage, but works once the project has been saved and reloaded from disk).
3. **Render-comp references must be re-resolved by name AFTER the close/reopen**, not reused from before it. `CompItem` references from before a `close()`+`open()` point at a stale object graph — the PNG-render step needs a **fresh** lookup-by-name, exactly where the original's `pngComp` lookup loop re-scans `app.project` instead of reusing the `renderComps` captured at rename time.
4. **Target-comp resolution branches on whether `cfg.compName` itself ends in an aspect suffix**: if it does, the actual target (after this iteration's rename) is `varBase + "_" + thatSuffix`; if it doesn't, the target is a nested precomp that was never renamed, so look it up by its original name unchanged.
5. Comp-name matching allows an optional trailing `.aep` (`item.name === X || item.name === X + ".aep"`) — a real AE quirk (comp names can end up carrying the file extension in certain copy/rename scenarios), preserved from the original. This lookup is needed 4 times across this plan (rename-time, target-comp resolution, and post-reload in this file, plus `testVarRenderComps`'s scan in Task 10) — factor it into one `findVarComp(name)` helper in `lib/findComp.ts` (Step 1 below), exported so Task 10 reuses it too, rather than repeating the loop 4 times across two files.

**Two deliberate deviations from the original**, both already agreed in the design spec — don't "fix" these back:
- Non-media layer application uses `applyLayerValue`/`applyLayerValueFailures` (warnings on failure), **not** the original's `applyLayerValueStrict` (hard-abort on first failure) — matching the fix already applied to ITR's engine after the Phase 1-2 final review found silently-swallowed failures there. Failures become entries in `RunResult.warnings`, the batch continues.
- Cleanup (removing the shared temp file, reopening the user's original project) happens in a `finally` block so it **always** runs, even if an iteration throws partway through — the original skips this cleanup entirely on its error path, which is a real (if minor) robustness gap this rewrite closes.

- [ ] **Step 1: Add `findVarComp` to `lib/findComp.ts`**

Read the current `src/jsx/aeft/lib/findComp.ts` first (it has `findCompByName`/`findCompsBySuffixes`/`ITR_SUFFIXES` from Phase 1-2). Add, alongside the existing functions:

```ts
// Like findCompByName, but also matches a name with a trailing ".aep" — a
// real AE quirk where comp names can end up carrying the file extension
// after certain copy/rename operations. VAR mode hits this repeatedly
// (rename-time lookup, target-comp resolution, post-reload lookup, and the
// testVarRenderComps diagnostic), so it's a shared helper rather than a
// loop repeated in every one of those spots.
export function findVarComp(name: string): CompItem | null {
  for (let i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);
    if (item instanceof CompItem && (item.name === name || item.name === name + ".aep")) {
      return item;
    }
  }
  return null;
}
```

- [ ] **Step 2: Implement `runVarIterationBatch.ts`**

```ts
// engine/runVarIterationBatch.ts — VAR mode's own orchestration function.
// NOT built on IterationStrategy: VAR's real phase order (render video before
// save, render PNG after reopen; branch fresh from one shared original copy
// each iteration rather than chaining forward) is different enough from
// ITR's that forcing it through the same loop would need more mode-hooks
// than the abstraction is worth. See docs/superpowers/specs/
// 2026-07-06-ae-iterations-var-mode-design.md, Decision 4.
//
// Ported from extension/jsx/host.jsx's runVarIterationsJSON (lines 429-690),
// with two deliberate deviations documented in this plan's Task 9 header.

import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { applyMediaLayer } from "../lib/applyMedia";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { stripAspectSuffix, VAR_ASPECT_SUFFIXES } from "../lib/naming";
import { findVarComp } from "../lib/findComp";
import type { RunVarConfig, RunResult } from "../../../shared/types";

export function runVarIterationBatch(cfg: RunVarConfig): RunResult {
  const projectFile = app.project.file;
  if (!projectFile) throw new Error("Project not saved. Save it first.");

  const warnings: string[] = [];

  app.project.save(projectFile);
  const tempFile = new File(projectFile.parent.fsName + "/__aeiter_tmp__.aep");
  if (tempFile.exists) {
    try {
      tempFile.remove();
    } catch (e) {}
  }
  if (!projectFile.copy(tempFile.fsName)) {
    throw new Error("Could not create temp copy of base project.");
  }

  const originalBase = stripAspectSuffix(projectFile.name.replace(/\.[^.]+$/, ""));

  app.beginSuppressDialogs();
  try {
    for (let iter = 0; iter < cfg.count; iter++) {
      const rawName = (cfg.varNames[iter] || "VAR" + (iter + 1)).replace(/\.aep$/i, "");
      const varName = rawName.replace(/[\/\\:*?"<>|]/g, "_");
      const varBase = stripAspectSuffix(varName);

      const varFile = new File(projectFile.parent.fsName + "/" + varName + ".aep");
      if (varFile.exists) {
        try {
          varFile.remove();
        } catch (e) {}
      }
      if (!tempFile.copy(varFile.fsName)) {
        warnings.push("VAR " + varName + ": could not copy base project, skipping.");
        continue;
      }

      // Open BETWEEN copy and rename: renaming below operates on app.project
      // (whichever document is currently active), so the copy must be open
      // first.
      app.open(varFile);

      const renderComps: Record<string, CompItem> = {};
      for (let rs = 0; rs < VAR_ASPECT_SUFFIXES.length; rs++) {
        const origRenderName = originalBase + "_" + VAR_ASPECT_SUFFIXES[rs];
        const ritem = findVarComp(origRenderName);
        if (ritem) {
          ritem.name = varBase + "_" + VAR_ASPECT_SUFFIXES[rs];
          renderComps[VAR_ASPECT_SUFFIXES[rs]] = ritem;
        }
      }

      // Lift suppression so importFile can show codec/alpha dialogs if
      // needed — importFile silently returns null while suppressed.
      app.endSuppressDialogs(false);

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

      // Resolve the target comp: if cfg.compName ends with an aspect suffix,
      // it was one of the render comps just renamed above -> look up
      // varBase + that suffix. Otherwise it's a nested precomp that was
      // never touched -> look it up by its original name unchanged.
      const cfgCompBase = cfg.compName.replace(/\.aep$/i, "");
      let origAspect = "";
      for (let as = 0; as < VAR_ASPECT_SUFFIXES.length; as++) {
        const asSuffix = "_" + VAR_ASPECT_SUFFIXES[as];
        if (cfgCompBase.slice(-asSuffix.length) === asSuffix) {
          origAspect = VAR_ASPECT_SUFFIXES[as];
          break;
        }
      }
      const searchCompName = origAspect ? varBase + "_" + origAspect : cfgCompBase;
      const comp = findVarComp(searchCompName);
      if (!comp) {
        throw new Error("VAR " + varName + ": comp not found: " + searchCompName);
      }

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
            const ok = applyMediaLayer(layer as AVLayer, fi2);
            if (!ok) warnings.push("VAR " + varName + ": replaceSource failed on layer " + lc.index);
          }
        } else {
          const log = applyLayerValue(layer, lc, val);
          for (const failure of applyLayerValueFailures(log)) {
            warnings.push("VAR " + varName + " layer " + lc.index + ": " + failure);
          }
        }
      }
      app.endUndoGroup();
      app.endSuppressDialogs(false);

      const gdFolder = new Folder(projectFile.parent.fsName + "/GD");
      if (!gdFolder.exists) gdFolder.create();
      const deliveryFolder = new Folder(gdFolder.fsName + "/" + varName);
      if (!deliveryFolder.exists) deliveryFolder.create();
      const collectFolder = new Folder(deliveryFolder.fsName + "/" + varName + " folder");
      if (!collectFolder.exists) collectFolder.create();

      // Render VIDEO now, while replaceSource media is still in-memory — the
      // render queue handles in-memory footage fine; saveFrameToPng (below,
      // after save+reopen) does not.
      try {
        renderVideos(renderComps, deliveryFolder, VAR_ASPECT_SUFFIXES);
      } catch (e: any) {
        warnings.push("VAR " + varName + " video: " + e.message);
      }

      // Save, then close+reopen so replaced footage loads from disk.
      app.project.save(varFile);
      app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      app.beginSuppressDialogs();
      app.open(varFile);
      app.endSuppressDialogs(false);

      const cleanProtected: string[] = [];
      for (let cps = 0; cps < VAR_ASPECT_SUFFIXES.length; cps++) {
        cleanProtected.push(varBase + "_" + VAR_ASPECT_SUFFIXES[cps]);
        cleanProtected.push(varBase + "_" + VAR_ASPECT_SUFFIXES[cps] + ".aep");
      }
      try {
        cleanProject(cleanProtected);
      } catch (e: any) {
        warnings.push("VAR " + varName + " clean: " + e.message);
      }

      // Re-resolve the render comps by name AFTER the reload — the pre-reload
      // CompItem references in `renderComps` point at a stale object graph
      // and must not be reused here.
      const reloadedRenderComps: Record<string, CompItem> = {};
      for (let ps = 0; ps < VAR_ASPECT_SUFFIXES.length; ps++) {
        const pngCompName = varBase + "_" + VAR_ASPECT_SUFFIXES[ps];
        const pIt = findVarComp(pngCompName);
        if (pIt) reloadedRenderComps[VAR_ASPECT_SUFFIXES[ps]] = pIt;
      }
      try {
        renderPNGs(reloadedRenderComps, deliveryFolder, VAR_ASPECT_SUFFIXES);
      } catch (e: any) {
        warnings.push("VAR " + varName + " PNG: " + e.message);
      }

      try {
        performCollect(varFile, collectFolder);
      } catch (e: any) {
        warnings.push("VAR " + varName + " collect: " + e.message);
      }

      app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    }
  } finally {
    // Runs even if an iteration threw — a deliberate improvement over the
    // original, which skips this cleanup entirely on its error path.
    try {
      tempFile.remove();
    } catch (e) {}
    app.beginSuppressDialogs();
    app.open(projectFile);
    app.endSuppressDialogs(false);
  }

  return { warnings };
}
```

If `app.project.importFile(...)`'s real declared return type doesn't cleanly support the `as FootageItem` cast, check `types-for-adobe/AfterEffects/22.0/index.d.ts` for its actual signature and adjust (this mirrors the exact same kind of check Task 14's `collect.ts` already had to do for footage-related APIs) — don't guess.

- [ ] **Step 3: Verify build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: tests unaffected (no automated test for this file — AE-object-model orchestration code, consistent with `runIterationBatch.ts`'s precedent), build exits 0. Inspect `dist/cep/jsx/index.js` and confirm, in the compiled `runVarIterationBatch` body, that the statement order matches: `copyProject`-equivalent → `app.open` → the rename loop (calling `findVarComp`) → `endSuppressDialogs` → media import loop → `beginSuppressDialogs` → target-comp resolution (calling `findVarComp`) → apply loop → `renderVideos` → `app.project.save` → `close` → `open` → `cleanProject` → a **second, independent** call to `findVarComp` per aspect suffix (not a reuse of the rename-time `renderComps` object) → `renderPNGs` → `performCollect` → `close`. This is the single most important thing to check in this whole task — trace it against the compiled output, not just the source, since compilation is where a subtle statement-order slip would first become invisible to a source-level read.

- [ ] **Step 4: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/lib/findComp.ts ae-iterations-next/src/jsx/aeft/engine/runVarIterationBatch.ts
git commit -m "feat: add runVarIterationBatch VAR mode orchestration"
```

---

### Task 10: `aeft.ts` commands — `runVarIterations`, `testVarRenderComps`, `browseForMedia`

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts`

**Interfaces:**
- Consumes: `runVarIterationBatch` (Task 9), `stripAspectSuffix`/`VAR_ASPECT_SUFFIXES` (Task 1), `findVarComp` (Task 9, added to `lib/findComp.ts`), `RunVarConfig`/`RunResult`/`TestVarCompsResult` (Task 2).
- Produces: `runVarIterations(cfg: RunVarConfig): RunResult`, `testVarRenderComps(): TestVarCompsResult`, `browseForMedia(): { path: string | null }` — all three throw `Error` on failure per the host-command convention.

`testVarRenderComps` is a direct, faithful port of the committed `extension/jsx/host.jsx`'s `testVarRenderCompsJSON` (lines 696-760), minus the `cfg.varNames` echo section (it only affects diagnostic text about what names *would* be used, not the comp-presence check that's this function's actual purpose — an intentional, minor scope trim, not an oversight).

- [ ] **Step 1: Implement**

Read the current `aeft.ts` first to match its existing import style, then add:

```ts
import { runVarIterationBatch } from "./engine/runVarIterationBatch";
import { stripAspectSuffix, VAR_ASPECT_SUFFIXES } from "./lib/naming";
import { findVarComp } from "./lib/findComp";
import type { RunVarConfig, TestVarCompsResult } from "../shared/types";
```

```ts
export const runVarIterations = (cfg: RunVarConfig): RunResult => {
  return runVarIterationBatch(cfg);
};

export const testVarRenderComps = (): TestVarCompsResult => {
  const projectFile = app.project.file;
  if (!projectFile) throw new Error("Project not saved. Save it first.");

  const log: string[] = [];
  const originalBase = stripAspectSuffix(projectFile.name.replace(/\.[^.]+$/, ""));
  log.push("Project: " + projectFile.name);
  log.push("Base name: " + originalBase);
  log.push("");
  log.push("Scanning for render comps in current project:");

  let foundCount = 0;
  for (let s = 0; s < VAR_ASPECT_SUFFIXES.length; s++) {
    const targetName = originalBase + "_" + VAR_ASPECT_SUFFIXES[s];
    const found = findVarComp(targetName);
    if (found) {
      foundCount++;
      log.push(
        "  OK  " + found.name +
          "  (" + found.width + "x" + found.height +
          "  " + Math.round(found.duration * 100) / 100 + "s" +
          "  " + found.numLayers + " layers" +
          "  " + Math.round(found.frameRate * 10) / 10 + " fps)"
      );
    } else {
      log.push("  MISSING  " + targetName);
    }
  }

  log.push("");
  log.push(foundCount + " / " + VAR_ASPECT_SUFFIXES.length + " render comps found.");
  log.push("");
  log.push("All compositions in project:");
  for (let ac = 1; ac <= app.project.numItems; ac++) {
    const acItem = app.project.item(ac);
    if (acItem instanceof CompItem) {
      log.push("  " + acItem.name + "  (" + acItem.width + "x" + acItem.height + ")");
    }
  }

  return { log };
};

export const browseForMedia = (): { path: string | null } => {
  const f = File.openDialog("Select media file");
  if (!f) return { path: null };
  return { path: f.fsName };
};
```

(`RunResult` should already be imported in this file from Phase 1-2's `runIterations` command — if not, add it to the same type-only import as `RunVarConfig`/`TestVarCompsResult`.)

- [ ] **Step 2: Verify build**

```bash
cd ae-iterations-next
npm run test
npm run build
```

Expected: tests unaffected, build exits 0. Inspect `dist/cep/jsx/index.js` to confirm all three new commands are present and correctly registered alongside the existing `getLayerInfo`/`previewApply`/`runIterations`.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/src/jsx/aeft/aeft.ts
git commit -m "feat: add runVarIterations, testVarRenderComps, browseForMedia commands"
```

---

### Task 11: Final panel wiring — mode-aware Run, VAR names, Test button, hide ITR-only UI in VAR mode

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/RunButton.tsx`
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1-10.
- Produces: the complete, usable VAR-mode panel flow.

- [ ] **Step 1: Make `RunButton` mode-aware**

Read the current `RunButton.tsx` in full first (it already has `useShallow`, status/statusKind state from the Phase 1-2 final review fix — match that exactly). Replace its `run` function and store selector:

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
  const { compName, rowLayers, count, mode, varNames } = useAppStore(
    useShallow((s) => ({ compName: s.compName, rowLayers: s.rowLayers, count: s.count, mode: s.mode, varNames: s.varNames }))
  );
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");

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
    if (!compName) {
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
      evalTS("runVarIterations", { compName, layers, values, count, varNames: names })
        .then((res) => handleResult(res, "variants"))
        .catch(handleError);
    } else {
      setStatus("Running…");
      setStatusKind("running");
      evalTS("runIterations", { compName, layers, values, count })
        .then((res) => handleResult(res, "iterations"))
        .catch(handleError);
    }
  };

  return (
    <div id="run-section">
      <button id="btn-run" onClick={run} disabled={!compName}>
        {mode === "var" ? "Run VAR" : "Run Iterations"}
      </button>
      {status && <div id="status" className={`status-${statusKind}`}>{status}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Wire `LayerInfoPanel`**

Read the current `LayerInfoPanel.tsx` in full first. It currently calls `effectiveValue(...)` with 5 arguments (per Phase 1-2) — Task 4 added a 6th `mode` parameter, so every call site here needs that argument added now (this file is where those call sites live, per Task 4's note). Add `mode` to this component's existing `useShallow` store selector, import `VarNamesRow`, and:

1. Pass `mode` as the 6th argument to every `effectiveValue(...)` call in this file (in `previewIteration` and wherever `RunButton`'s prop function is defined).
2. Hide the Preview-button row entirely when `mode === "var"` (no VAR preview this phase, per the Global Constraints — wrap the existing `{rowLayers.length > 0 && (<div id="preview-row">...)}` block's condition with `mode === "itr" &&`).
3. Hide the "same value for all layers" checkbox entirely when `mode === "var"` (matches the original's behavior exactly — VAR never borrows values across layers, per Task 4's `effectiveValue` change; the checkbox would be misleading if left visible and functionally inert). Add `mode === "itr" &&` to that block's existing visibility condition, alongside its current "only show when there's more than one distinct layerIndex" check.
4. When `mode === "var"`, render `<VarNamesRow />` and a "Test" button:

```tsx
const [testLog, setTestLog] = useState<string[] | null>(null);

const testVarComps = () => {
  evalTS("testVarRenderComps")
    .then((res) => setTestLog(res.log))
    .catch((err) => setTestLog(["Test failed: " + String(err)]));
};
```

```tsx
{mode === "var" && (
  <>
    <VarNamesRow />
    <button onClick={testVarComps}>Test</button>
    {testLog && <pre id="var-test-log">{testLog.join("\n")}</pre>}
  </>
)}
```

(Add the `useState` import if it isn't already imported in this file.)

- [ ] **Step 3: Run the full test suite**

```bash
cd ae-iterations-next && npm run test
```

Expected: PASS, no regressions across the whole suite (this touches two already-tested files — check carefully that nothing in `LayerInfoPanel`'s or `RunButton`'s existing tests, if any exist at the component level, broke from the added `mode`-branching).

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/RunButton.tsx ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx
git commit -m "feat: complete VAR-mode panel — mode-aware Run, names, Test button"
```

- [ ] **Step 6: Write the manual VAR verification recipe**

This is the real acceptance test for the whole plan — no subagent can perform it. Write the following recipe into a report (or hand it directly to the user if executing this plan without a dispatch-and-report workflow):

**Setup:**
1. Pick or create a real VAR test project matching the naming convention (a base project with a name like `TL_11352_..._VAR`, containing the 4 render precomps ending in `_9x16`, `_1x1`, `_16x9`, `_4x5`, plus at least one shape/text layer and one footage/video layer to exercise both `applyLayerValue` and `applyMediaLayer`).
2. Build and reload the extension (`npm run build`, reopen the "AE Iterations (Next)" panel in AE).

**Test the diagnostic first:**
3. Switch to the VAR tab, select the base project's layers, click Refresh, then click **Test** before running anything. Confirm the log reports all 4 render comps found (`OK ...`) with correct dimensions — if any show `MISSING`, fix the project's comp naming before proceeding (this is exactly the check that would have caught the ITR naming issue found earlier in this session, before running anything).
4. As a negative check, temporarily rename one render comp so it no longer matches the expected suffix, click **Test** again, confirm it reports `MISSING` for that one — then rename it back.

**Run a real VAR batch:**
5. Fill in 2-3 rows of values (colors/fonts for text or shape layers, a media file for the footage layer), fill in a distinct name per iteration in the VAR name inputs, set Count to 2-3, click **Run VAR**.
6. Confirm the run completes with a status showing either "Done — N variants complete." or a specific, readable warning list — not a silent hang or an unhandled exception in the panel.
7. For each named variant, confirm a `<projectDir>/GD/<variantName>/` folder exists containing 4 PNGs (one per aspect ratio) and 4 video renders, and a nested `<variantName> folder/` containing the collected, self-contained `.aep` + `(Footage)/`.
8. Open one collected variant's `.aep` standalone — confirm its footage is relinked correctly, the media-replaced layer shows the new footage (not the original), and the render comps carry the variant's name (not the original project's).
9. Confirm the **original** project (the one you had open before clicking Run VAR) is left open and unmodified afterward — VAR branches from a temp copy, it should never alter your working file.

If any of steps 6-9 fail, that's a real bug in `runVarIterationBatch` — trace the specific failing step against the ordering notes in Task 9 before assuming it's an environment issue.

---

## Self-Review Notes

- **Spec coverage:** every decision in the design spec (4x5 aspect ratios, Run-only scope, the Test diagnostic, the separate-orchestration-function architecture) has a corresponding task. VAR-mode Preview is explicitly out of scope per Decision 2 and is actively hidden in Task 11, not just omitted.
- **Type consistency checked:** `RunVarConfig`/`TestVarCompsResult` (Task 2) are used unmodified through Tasks 9, 10, and 11. `Mode` (Task 2) threads consistently through `buildRowLayers` (Task 2), `store.ts` (Task 4), `effectiveValue` (Task 4), and every `effectiveValue(...)` call site (Task 4, revisited in Task 11). `VAR_ASPECT_SUFFIXES`/`stripAspectSuffix` (Task 1) are the same names used in Tasks 9 and 10 — no drift.
- **No placeholders:** every task ships complete, real code, either a faithful port with explicitly-labeled deviations (Task 9's two documented changes) or fresh code whose contract is derived from real call sites in the committed original (Task 1's `stripAspectSuffix`).
