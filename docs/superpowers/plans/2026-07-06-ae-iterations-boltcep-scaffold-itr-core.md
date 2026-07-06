# AE Iterations — BoltCEP Rewrite: Scaffold + ITR Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a new BoltCEP (React + TypeScript + Vite) CEP extension at `ae-iterations-next/`, installed side-by-side with the current extension, that reproduces ITR-mode iteration (shape/text/stroke color, text font, video flip/B&W/tint/hue, PNG + video render, project clean, collect) end-to-end via a unified iteration engine and a single layer-type handler table — verified output-for-output against the current `extension/` on a real test project.

**Architecture:** One host-side `runIterationBatch()` engine driven by a small `ITR_STRATEGY` object (VAR mode gets its own strategy in a later plan) replaces today's two near-duplicate `runIterationsJSON`/`runVarIterationsJSON` functions. One panel-side `LAYER_HANDLERS` table (shape/text/stroke/video) replaces today's four parallel per-layer-type function families. BoltCEP's built-in `evalTS()` (typed ExtendScript calls, automatic JSON marshalling) replaces the current hand-rolled `cs.evalScript("fn(" + JSON.stringify(JSON.stringify(cfg)) + ")", cb)` pattern — no custom bridge needed, the framework already provides it.

**Tech Stack:** BoltCEP (React, TypeScript, Vite, `vite-cep-plugin`), Zustand for panel state, Vitest + @testing-library/react for automated tests, Types-for-Adobe ambient types for the ExtendScript/AE object model.

## Global Constraints

- Stack is BoltCEP (React + TypeScript + Vite) per `docs/superpowers/specs/2026-07-06-ae-iterations-boltcep-refactor-design.md`.
- New project lives at repo-root sibling `ae-iterations-next/`, tracked in the **same git repository** as this plan (not a nested repo). `extension/` is never modified by this plan.
- Baseline is the last commit (v1.0.11). Do not port the uncommitted working-tree changes (modified `apply-emoji.jsx` emoji-size param, modified `naming.jsx` VAR helpers, new `apply-media.jsx`, untracked `emodji/` folder) — those are explicitly out of scope and continue separately on the current extension.
- CEP extension ID: `com.aeiter.iteration.next`, so it installs alongside the current `com.aeiter.iteration` (side-by-side rollout, per spec decision 3).
- Host requirements match the current manifest: AEFT version `26.0`, CSXS runtime `11.0`.
- Panel geometry matches the current manifest: width `300` (min `260`), height `560` (min `480`).
- Scope of this plan is Phases 1–2 of the spec's migration phasing only: scaffold + ITR core (shape/text/stroke/video property iteration, PNG + video render, clean, collect). VAR mode, emoji overlay, presets, changelog panel, and auto-update are explicitly out of scope — each gets its own future plan once this one ships.
- Verification convention: ExtendScript code that touches the live AE object model (`CompItem`, `ShapeLayer`, `Effects`, etc.) cannot run under a test runner outside After Effects — those tasks are verified by manual steps against a real AE project, spelled out exactly in each task. Pure TypeScript logic (naming, color conversion, row-list construction, React components) gets real Vitest/RTL automated tests.
- Host command convention: every `src/jsx/aeft/aeft.ts` exported command function either returns its typed success payload directly, or `throw`s an `Error` on failure. No `JSON.stringify({error: ...})` sentinel objects — `evalTS()` on the panel side surfaces thrown errors as a rejected Promise, so panel code uses try/catch.

---

## File Structure

```
ae-iterations-next/
  cep.config.ts
  package.json
  vitest.config.ts
  src/
    js/
      main/
        index.html
        main.tsx
        App.tsx
        components/
          LayerInfoPanel.tsx
          IterationRow.tsx
          ColorFields.tsx
          VideoFields.tsx
          ModeTabs.tsx
          RunButton.tsx
        state/
          store.ts
          rowLayers.ts
          rowLayers.test.ts
          layerHandlers.ts
        lib/
          color.ts
          color.test.ts
    jsx/
      index.ts                    # BoltCEP-generated app switch, extended for AEFT
      aeft/
        aeft.ts                   # exported command functions (ping, getLayerInfo, previewApply, runIterations)
        lib/
          naming.ts
          naming.test.ts
          layerUtils.ts
          findComp.ts
          applyChange.ts
          applyVideo.ts
          render.ts
          clean.ts
          collect.ts
          project.ts
        engine/
          runIterationBatch.ts
          strategies/
            itrStrategy.ts
    shared/
      types.ts
```

---

### Task 1: Scaffold the BoltCEP project

**Files:**
- Create: `ae-iterations-next/` (entire scaffold, generated)

**Interfaces:**
- Produces: a working BoltCEP project skeleton that later tasks add files into.

- [ ] **Step 1: Scaffold**

From the repo root:

```bash
npx create-bolt-cep@latest
```

When prompted, answer:
- Project name / directory: `ae-iterations-next`
- Framework: `React`
- Language: `TypeScript` (if asked — bolt-cep's React template is TS by default)
- Include Sass: your preference, doesn't matter for this plan (default is fine)

- [ ] **Step 2: Prevent a nested git repo**

`create-bolt-cep` may run `git init` inside the new folder. Since this project must live in the **same** repository as this plan, remove any nested repo it created:

```bash
rm -rf "ae-iterations-next/.git"
```

Verify: `git -C ae-iterations-next status` should now fail with "not a git repository" (confirming no nested repo), while `git status` from the parent repo root should list `ae-iterations-next/` as untracked.

- [ ] **Step 3: Install dependencies and verify the default build**

```bash
cd ae-iterations-next
npm install
npm run build
```

Expected: build completes with no errors. If bolt-cep scaffolded a second `settings` panel (check `src/js/settings/`), delete it now since this extension only needs one panel:

```bash
rm -rf src/js/settings
```

You'll remove its entry from `cep.config.ts` in Task 2.

- [ ] **Step 4: Commit**

```bash
cd ..
git add ae-iterations-next
git commit -m "chore: scaffold BoltCEP project for AE Iterations rewrite"
```

---

### Task 2: Configure CEP identity and panel geometry

**Files:**
- Modify: `ae-iterations-next/cep.config.ts`

**Interfaces:**
- Consumes: scaffold from Task 1.
- Produces: an extension that installs under its own ID, side-by-side with `com.aeiter.iteration`, at the current panel's size.

- [ ] **Step 1: Edit `cep.config.ts`**

Open `ae-iterations-next/cep.config.ts`. Set (keep whatever other scaffolded fields exist — `parameters`, `build`, `zxp`, etc. — untouched):

```ts
id: "com.aeiter.iteration.next",
displayName: "AE Iterations (Next)",
```

In the `hosts` array, keep only After Effects, matching the current manifest's version floor:

```ts
hosts: [{ name: "AEFT", version: "[26.0,99.9]" }],
```

If a second panel entry (e.g. `settings`) is still present in the `panels` array from Task 1, remove it so only `main` remains. Set the `main` panel's geometry to match the current extension's manifest (`extension/CSXS/manifest.xml`):

```ts
panels: [
  {
    mainPath: "./main/index.html",
    name: "main",
    panelDisplayName: "AE Iterations (Next)",
    autoVisible: true,
    width: 300,
    height: 560,
    minWidth: 260,
    minHeight: 480,
  },
],
```

(If the scaffolded config doesn't have `minWidth`/`minHeight` fields, check the `vite-cep-plugin` panel type — add them if supported; if not supported in this version, note it as a follow-up and proceed with just `width`/`height`.)

- [ ] **Step 2: Build and verify in After Effects**

```bash
cd ae-iterations-next
npm run build
```

This creates a symlink into the CEP extensions folder. Manually verify:
1. Restart After Effects (or if already running with `PlayerDebugMode` enabled, just reopen the Extensions menu).
2. Open `Window > Extensions` — confirm **both** "AE Iterations" (current) and "AE Iterations (Next)" appear as separate entries.
3. Open the new panel — confirm it renders (default bolt-cep starter content) at roughly 300×560.

- [ ] **Step 3: Commit**

```bash
cd ..
git add ae-iterations-next/cep.config.ts
git commit -m "chore: set CEP identity and panel geometry for AE Iterations (Next)"
```

---

### Task 3: Prove the evalTS round-trip and error convention

**Files:**
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts`
- Modify: `ae-iterations-next/src/js/main/App.tsx`

**Interfaces:**
- Produces: `ping(name: string): { message: string }` — the pattern every later host command follows (plain typed return, `throw` on error, called via `evalTS`).

This is the single biggest technical risk called out in the design spec: confirming BoltCEP's host-side TypeScript-to-ExtendScript (ES3) compilation actually works for this project before any real logic depends on it.

- [ ] **Step 1: Add a trivial host command**

In `ae-iterations-next/src/jsx/aeft/aeft.ts`, add:

```ts
export const ping = (name: string): { message: string } => {
  return { message: "pong: " + name };
};
```

- [ ] **Step 2: Call it from the panel on load**

In `ae-iterations-next/src/js/main/App.tsx`, add a state variable and call `evalTS` once on mount:

```tsx
import { useEffect, useState } from "react";
import { evalTS } from "../lib/utils/bolt"; // path per bolt-cep scaffold — adjust to match actual generated import path

function App() {
  const [pingResult, setPingResult] = useState<string>("checking host...");

  useEffect(() => {
    evalTS("ping", "AE Iterations Next")
      .then((res) => setPingResult(res.message))
      .catch((err) => setPingResult("ping failed: " + String(err)));
  }, []);

  return <div id="ping-status">{pingResult}</div>;
}

export default App;
```

(The exact import path for `evalTS` depends on what bolt-cep's scaffold generated — check `src/js/main/main.tsx` or an existing scaffolded component for the real import and match it exactly.)

- [ ] **Step 3: Verify in After Effects**

```bash
npm run build
```

Reopen the "AE Iterations (Next)" panel in AE. Confirm the panel displays `pong: AE Iterations Next` (not `checking host...` and not a `ping failed` error). If it fails, this is a stop-the-line issue — resolve the host TS compilation problem before proceeding to any later task, since every later task depends on this path working.

- [ ] **Step 4: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/aeft.ts ae-iterations-next/src/js/main/App.tsx
git commit -m "feat: prove evalTS round-trip between panel and ExtendScript host"
```

---

### Task 4: Vitest setup + ported naming logic

**Files:**
- Create: `ae-iterations-next/vitest.config.ts`
- Modify: `ae-iterations-next/package.json` (add `test` script + devDependencies)
- Create: `ae-iterations-next/src/jsx/aeft/lib/naming.ts`
- Create: `ae-iterations-next/src/jsx/aeft/lib/naming.test.ts`

**Interfaces:**
- Produces: `incrementProjectId(nameWithoutExt: string): string`, used by `project.ts` (Task 15) and `itrStrategy.ts` (Task 16).

This is the first fully automatable task in the plan — pure string logic, no AE object model involved. Ported verbatim from the **committed** `extension/jsx/lib/naming.jsx` (the `incrementProjectId` function only — the uncommitted VAR-naming helpers in that file are explicitly out of scope per Global Constraints).

- [ ] **Step 1: Install test tooling**

```bash
cd ae-iterations-next
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Add to `package.json` `scripts`:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `src/jsx/aeft/lib/naming.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { incrementProjectId } from "./naming";

describe("incrementProjectId", () => {
  it("increments the second underscore-delimited segment", () => {
    expect(incrementProjectId("LO_10794_4378_M11_S0_EN_usr_CAM_PRI_Video_ITR_9x16"))
      .toBe("LO_10795_4378_M11_S0_EN_usr_CAM_PRI_Video_ITR_9x16");
  });

  it("carries over a multi-digit rollover", () => {
    expect(incrementProjectId("LO_10799_4378")).toBe("LO_10800_4378");
  });

  it("only touches the second segment, not others", () => {
    expect(incrementProjectId("LO_1_2_3")).toBe("LO_2_2_3");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test
```

Expected: FAIL — `naming.ts` doesn't exist yet (`Cannot find module './naming'`).

- [ ] **Step 4: Write the implementation**

Create `src/jsx/aeft/lib/naming.ts`, ported from `extension/jsx/lib/naming.jsx`'s committed `incrementProjectId`:

```ts
export function incrementProjectId(nameWithoutExt: string): string {
  const parts = nameWithoutExt.split("_");
  parts[1] = String(parseInt(parts[1], 10) + 1);
  return parts.join("_");
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS — 3 tests green.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/vitest.config.ts ae-iterations-next/package.json \
        ae-iterations-next/src/jsx/aeft/lib/naming.ts ae-iterations-next/src/jsx/aeft/lib/naming.test.ts \
        ae-iterations-next/package-lock.json
git commit -m "test: add vitest + port incrementProjectId with unit tests"
```

---

### Task 5: Ported color conversion utilities

**Files:**
- Create: `ae-iterations-next/src/js/main/lib/color.ts`
- Create: `ae-iterations-next/src/js/main/lib/color.test.ts`

**Interfaces:**
- Produces: `hexToRgb(hex: string): [number, number, number]`, `rgbToHex(rgb: [number, number, number]): string`, `normaliseHex(raw: string): string | null` — used by `ColorFields.tsx` (Task 8) and `VideoFields.tsx` (Task 9).

Ported verbatim from `extension/js/main.js`'s `hexToRgb`/`rgbToHex`/`normaliseHex` (lines 33–50).

- [ ] **Step 1: Write the failing tests**

Create `src/js/main/lib/color.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex, normaliseHex } from "./color";

describe("hexToRgb", () => {
  it("converts pure red", () => {
    expect(hexToRgb("#FF0000")).toEqual([1, 0, 0]);
  });
  it("converts a mid-tone value", () => {
    const [r, g, b] = hexToRgb("#7F7F7F");
    expect(r).toBeCloseTo(0.498, 2);
    expect(g).toBeCloseTo(0.498, 2);
    expect(b).toBeCloseTo(0.498, 2);
  });
});

describe("rgbToHex", () => {
  it("converts pure blue back to hex", () => {
    expect(rgbToHex([0, 0, 1])).toBe("#0000ff");
  });
  it("round-trips with hexToRgb", () => {
    expect(rgbToHex(hexToRgb("#00FF00"))).toBe("#00ff00");
  });
});

describe("normaliseHex", () => {
  it("accepts a hex string without a leading #", () => {
    expect(normaliseHex("ff0000")).toBe("#FF0000");
  });
  it("accepts a hex string with a leading #", () => {
    expect(normaliseHex("#00ff00")).toBe("#00FF00");
  });
  it("rejects an invalid hex string", () => {
    expect(normaliseHex("not-a-color")).toBeNull();
  });
  it("trims whitespace before validating", () => {
    expect(normaliseHex("  #0000ff  ")).toBe("#0000FF");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — `Cannot find module './color'`.

- [ ] **Step 3: Write the implementation**

Create `src/js/main/lib/color.ts`, ported from `extension/js/main.js:33-50`:

```ts
export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export function rgbToHex(arr: [number, number, number]): string {
  const h = (v: number): string => {
    const s = Math.round(v * 255).toString(16);
    return s.length === 1 ? "0" + s : s;
  };
  return "#" + h(arr[0]) + h(arr[1]) + h(arr[2]);
}

export function normaliseHex(raw: string): string | null {
  let s = raw.trim();
  if (s[0] !== "#") s = "#" + s;
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS — all `color.test.ts` cases green (naming tests from Task 4 still pass too).

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/lib/color.ts ae-iterations-next/src/js/main/lib/color.test.ts
git commit -m "test: port hexToRgb/rgbToHex/normaliseHex with unit tests"
```

---

### Task 6: Shared types + layer detection + getLayerInfo (shape & text)

**Files:**
- Create: `ae-iterations-next/src/shared/types.ts`
- Create: `ae-iterations-next/src/jsx/aeft/lib/layerUtils.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts` (add `getLayerInfo`)
- Modify: `ae-iterations-next/src/js/main/App.tsx` (temporary raw display, replaced properly in Task 8)

**Interfaces:**
- Produces: `LayerType`, `FillInfo`, `StrokeInfo`, `VideoState`, `LayerInfo`, `LayerInfoResult` (types, in `shared/types.ts`); `getLayerType(layer)`, `collectFills(propGroup, pathSoFar)`, `collectStrokes(propGroup, pathSoFar)` (in `layerUtils.ts`); `getLayerInfo(): LayerInfoResult` host command.
- Consumes: nothing new (first task to touch the live AE object model).

Ported from `extension/jsx/lib/layer-utils.jsx` (`getLayerType`, `collectFills`, `collectStrokes`) and the shape/text branches of `extension/jsx/host.jsx`'s `getLayerInfoJSON` (lines 152–182). Video branch and `findCompByName` come in Task 7 — this task covers shape + text only so it has a clean, independently-verifiable scope.

- [ ] **Step 1: Define the shared types**

Create `src/shared/types.ts`:

```ts
export type LayerType = "shape" | "text" | "stroke" | "video" | "unknown";

export interface FillInfo {
  path: string;
  color: [number, number, number];
}

export interface StrokeInfo {
  path: string;
  color: [number, number, number];
}

export interface VideoState {
  flip: boolean;
  bw: boolean;
  tint: [number, number, number] | null;
  tintAmount: number;
  hue: number;
}

export interface LayerInfo {
  name: string;
  index: number;
  type: LayerType;
  fills?: FillInfo[];
  strokes?: StrokeInfo[];
  color?: [number, number, number] | null;
  font?: string;
  text?: string;
  videoState?: VideoState;
}

export interface LayerInfoResult {
  compName: string;
  layers: LayerInfo[];
}

export interface LayerValue {
  color?: [number, number, number] | null;
  font?: string | null;
  content?: string | null;
  flip?: boolean;
  bw?: boolean;
  tint?: [number, number, number] | null;
  tintAmount?: number;
  hue?: number;
}

export interface CfgLayer {
  index: number;
  name: string;
  fillPath: string;
  layerType: LayerType;
}

export interface RunConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][]; // [iter][layer row index], matching `layers` order
  count: number;
}

export interface RunResult {
  warnings: string[];
}
```

- [ ] **Step 2: Port layer detection + fill/stroke collection**

Create `src/jsx/aeft/lib/layerUtils.ts`, ported from `extension/jsx/lib/layer-utils.jsx:1-10,36-74`:

```ts
import type { FillInfo, StrokeInfo, LayerType } from "../../../shared/types";

export function getLayerType(layer: Layer): LayerType {
  if (layer instanceof ShapeLayer) return "shape";
  if (layer instanceof TextLayer) return "text";
  if (layer instanceof AVLayer) return "video";
  return "unknown";
}

// propGroup is a dynamic ExtendScript PropertyGroup — traversal is by string
// path, which Types-for-Adobe can't fully type, hence the `any`.
export function collectFills(propGroup: any, pathSoFar: string): FillInfo[] {
  const fills: FillInfo[] = [];
  let count: number;
  try {
    count = propGroup.numProperties;
  } catch (e) {
    return fills;
  }
  for (let i = 1; i <= count; i++) {
    let prop: any;
    try {
      prop = propGroup.property(i);
    } catch (e) {
      continue;
    }
    const propPath = pathSoFar + "/" + prop.name;
    if (
      prop.matchName === "ADBE Vector Shape - Fill" ||
      prop.matchName === "ADBE Vector Graphic - Fill"
    ) {
      try {
        fills.push({ path: propPath, color: prop.property("Color").value });
      } catch (e) {}
    } else if (prop.propertyType !== PropertyType.PROPERTY) {
      const sub = collectFills(prop, propPath);
      for (let s = 0; s < sub.length; s++) fills.push(sub[s]);
    }
  }
  return fills;
}

export function collectStrokes(propGroup: any, pathSoFar: string): StrokeInfo[] {
  const strokes: StrokeInfo[] = [];
  let count: number;
  try {
    count = propGroup.numProperties;
  } catch (e) {
    return strokes;
  }
  for (let i = 1; i <= count; i++) {
    let prop: any;
    try {
      prop = propGroup.property(i);
    } catch (e) {
      continue;
    }
    const propPath = pathSoFar + "/" + prop.name;
    if (
      prop.matchName === "ADBE Vector Shape - Stroke" ||
      prop.matchName === "ADBE Vector Graphic - Stroke"
    ) {
      try {
        strokes.push({ path: propPath, color: prop.property("Color").value });
      } catch (e) {}
    } else if (prop.propertyType !== PropertyType.PROPERTY) {
      const sub = collectStrokes(prop, propPath);
      for (let s = 0; s < sub.length; s++) strokes.push(sub[s]);
    }
  }
  return strokes;
}
```

- [ ] **Step 3: Add the `getLayerInfo` host command (shape + text)**

In `src/jsx/aeft/aeft.ts`, add:

```ts
import { getLayerType, collectFills, collectStrokes } from "./lib/layerUtils";
import type { LayerInfoResult, LayerInfo } from "../../shared/types";

export const getLayerInfo = (): LayerInfoResult => {
  const comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) throw new Error("No active composition");
  const sel = comp.selectedLayers;
  if (sel.length === 0) throw new Error("No layer selected");

  const layers: LayerInfo[] = [];
  for (let i = 0; i < sel.length; i++) {
    const layer = sel[i];
    const type = getLayerType(layer);
    const info: LayerInfo = { name: layer.name, index: layer.index, type };
    if (type === "shape") {
      info.fills = collectFills((layer as ShapeLayer).property("Contents"), "Contents");
      info.strokes = collectStrokes((layer as ShapeLayer).property("Contents"), "Contents");
    } else if (type === "text") {
      const td = (layer as TextLayer).property("Source Text").value as TextDocument;
      info.color = td.fillColor as [number, number, number];
      info.font = td.font;
      info.text = td.text;
    }
    layers.push(info);
  }

  return { compName: comp.name, layers };
};
```

(Video handling — `else if (type === "video")` — is added in Task 7.)

- [ ] **Step 4: Temporary panel wiring to verify manually**

In `App.tsx`, temporarily replace the ping display with a "Refresh" button that calls `getLayerInfo` and dumps the JSON so you can eyeball it (this is replaced with real UI in Task 8):

```tsx
const [layerInfoJson, setLayerInfoJson] = useState<string>("");

<button onClick={() => evalTS("getLayerInfo").then((r) => setLayerInfoJson(JSON.stringify(r, null, 2))).catch((e) => setLayerInfoJson("ERROR: " + String(e)))}>
  Refresh
</button>
<pre>{layerInfoJson}</pre>
```

- [ ] **Step 5: Verify manually in After Effects**

```bash
npm run build
```

In AE, on a test comp:
1. Select a shape layer that has 2 fills and 1 stroke. Click Refresh. Confirm the JSON shows `type: "shape"`, `fills` with 2 entries (correct `path`/`color`), `strokes` with 1 entry.
2. Select a text layer. Click Refresh. Confirm `type: "text"`, and `color`/`font`/`text` match the layer's actual fill color, PostScript font name, and text content.
3. Select nothing (deselect all layers). Click Refresh. Confirm the panel shows the thrown error message ("No layer selected"), not a crash.

- [ ] **Step 6: Commit**

```bash
git add ae-iterations-next/src/shared/types.ts ae-iterations-next/src/jsx/aeft/lib/layerUtils.ts \
        ae-iterations-next/src/jsx/aeft/aeft.ts ae-iterations-next/src/js/main/App.tsx
git commit -m "feat: port layer detection and getLayerInfo for shape/text layers"
```

---

### Task 7: findCompByName + video layer state + getLayerInfo video support

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/findComp.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/lib/layerUtils.ts` (add `readVideoLayerState`)
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts` (extend `getLayerInfo` for video)

**Interfaces:**
- Consumes: `LayerInfo`, `VideoState` (Task 6).
- Produces: `findCompByName(name: string): CompItem | null`, `findCompsBySuffixes(suffixes: string[]): Record<string, CompItem>` (used by `render.ts` in Task 12 and the engine in Task 16); `readVideoLayerState(layer: AVLayer): VideoState`.

`findCompByName`/`findCompsBySuffixes` are new — they replace the "loop `app.project.numItems`, compare `.name`" pattern duplicated 8+ times across the current `host.jsx`/`clean.jsx`/`naming.jsx` (per the design spec's Core Abstraction 3).

- [ ] **Step 1: Port the comp-lookup helper**

Create `src/jsx/aeft/lib/findComp.ts`:

```ts
export function findCompByName(name: string): CompItem | null {
  for (let i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);
    if (item instanceof CompItem && item.name === name) return item;
  }
  return null;
}

// Finds, for each suffix, the first comp whose name ends with "_" + suffix.
// Mirrors extension/jsx/lib/layer-utils.jsx's findItrComps, generalized.
export function findCompsBySuffixes(suffixes: string[]): Record<string, CompItem> {
  const found: Record<string, CompItem> = {};
  for (let i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);
    if (!(item instanceof CompItem)) continue;
    for (let s = 0; s < suffixes.length; s++) {
      const suffix = "_" + suffixes[s];
      if (item.name.slice(-suffix.length) === suffix) found[suffixes[s]] = item;
    }
  }
  return found;
}

export const ITR_SUFFIXES = ["ITR_9x16", "ITR_1x1", "ITR_16x9"];
```

- [ ] **Step 2: Port video layer state reading**

In `src/jsx/aeft/lib/layerUtils.ts`, add (ported from `extension/jsx/lib/layer-utils.jsx:12-34`):

```ts
import type { VideoState } from "../../../shared/types";

export function readVideoLayerState(layer: AVLayer): VideoState {
  const state: VideoState = { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 };
  try {
    const sv = layer.transform.scale.value as [number, number];
    state.flip = sv[0] < 0;
    for (let i = 1; i <= layer.Effects.numProperties; i++) {
      const eff = layer.Effects.property(i) as any;
      if (eff.matchName === "ADBE HUE SATURATION") {
        state.hue = Math.round(eff.property("Master Hue").value);
        state.bw = eff.property("Master Saturation").value <= -100;
      }
      if (eff.matchName === "ADBE Tint") {
        const amount = eff.property("Amount to Tint").value;
        if (amount > 0) {
          const c = eff.property("Map Black To").value as number[];
          state.tint = [c[0], c[1], c[2]];
          state.tintAmount = Math.round(amount);
        }
      }
    }
  } catch (e) {}
  return state;
}
```

- [ ] **Step 3: Extend `getLayerInfo` for video layers**

In `src/jsx/aeft/aeft.ts`, add the video branch to the `if/else if` chain built in Task 6:

```ts
import { getLayerType, collectFills, collectStrokes, readVideoLayerState } from "./lib/layerUtils";
```

```ts
    } else if (type === "video") {
      info.videoState = readVideoLayerState(layer as AVLayer);
    }
```//insert as another `else if` branch alongside the existing shape/text branches in `getLayerInfo`.

- [ ] **Step 4: Verify manually in After Effects**

```bash
npm run build
```

On a test comp with a footage/video layer that already has a Hue/Saturation effect (Master Hue = 30, Master Saturation = -100) and a Tint effect (Amount to Tint = 60, Map Black To = orange):
1. Select the layer, click Refresh.
2. Confirm `videoState` shows `hue: 30`, `bw: true`, `tint` matching the orange RGB, `tintAmount: 60`.
3. Select a footage layer with no effects and a negative X scale (flipped). Confirm `flip: true`, `tint: null`.

- [ ] **Step 5: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/lib/findComp.ts ae-iterations-next/src/jsx/aeft/lib/layerUtils.ts \
        ae-iterations-next/src/jsx/aeft/aeft.ts
git commit -m "feat: add findCompByName helper and video layer state reading"
```

---

### Task 8: Row-list construction, Zustand store, and the shape/text/stroke handler

**Files:**
- Create: `ae-iterations-next/src/js/main/state/rowLayers.ts`
- Create: `ae-iterations-next/src/js/main/state/rowLayers.test.ts`
- Create: `ae-iterations-next/src/js/main/state/store.ts`
- Create: `ae-iterations-next/src/js/main/state/layerHandlers.ts`
- Create: `ae-iterations-next/src/js/main/components/ColorFields.tsx`
- Create: `ae-iterations-next/src/js/main/components/IterationRow.tsx`
- Create: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/App.tsx`

**Interfaces:**
- Consumes: `LayerInfo`, `LayerValue`, `LayerType` (Task 6); `getLayerInfo()` host command (Task 6/7).
- Produces: `buildRowLayers(layers: LayerInfo[]): RowLayer[]`; `useAppStore` (Zustand store with `layerInfo`, `compName`, `count`, `rowLayers`, `values`, `sameForAll`); `LAYER_HANDLERS: Record<LayerType, LayerTypeHandler>` for `shape`/`text`/`stroke` (video added in Task 9).

This is the panel-side core-abstraction task: replaces `buildColorRow`/`readColorRowValue`/the dead `buildIterRows`, and the virtual-stroke-row injection currently done inline in `main.js`'s `renderLayerInfo` (lines 402–418).

- [ ] **Step 1: Write the failing test for row-list construction**

Create `src/js/main/state/rowLayers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRowLayers } from "./rowLayers";
import type { LayerInfo } from "../../../shared/types";

describe("buildRowLayers", () => {
  it("makes one row for a shape layer with a fill and no strokes", () => {
    const layers: LayerInfo[] = [
      { name: "Rect", index: 1, type: "shape", fills: [{ path: "Contents/Group 1/Contents/Fill 1", color: [1, 0, 0] }], strokes: [] },
    ];
    const rows = buildRowLayers(layers);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ layerIndex: 1, type: "shape", fillPath: "Contents/Group 1/Contents/Fill 1" });
  });

  it("adds one synthetic stroke row per stroke, sharing the parent layer index", () => {
    const layers: LayerInfo[] = [
      {
        name: "Rect", index: 1, type: "shape",
        fills: [{ path: "Contents/Group 1/Contents/Fill 1", color: [1, 0, 0] }],
        strokes: [{ path: "Contents/Group 1/Contents/Stroke 1", color: [0, 0, 0] }],
      },
    ];
    const rows = buildRowLayers(layers);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ layerIndex: 1, type: "stroke", fillPath: "Contents/Group 1/Contents/Stroke 1" });
    expect(rows[1].rowKey).not.toBe(rows[0].rowKey);
  });

  it("passes through text and video layers as single rows", () => {
    const layers: LayerInfo[] = [
      { name: "Title", index: 2, type: "text", color: [1, 1, 1], font: "Helvetica", text: "Hi" },
      { name: "BG", index: 3, type: "video", videoState: { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 } },
    ];
    const rows = buildRowLayers(layers);
    expect(rows.map((r) => r.type)).toEqual(["text", "video"]);
    expect(rows[0].fillPath).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — `Cannot find module './rowLayers'`.

- [ ] **Step 3: Implement `buildRowLayers`**

Create `src/js/main/state/rowLayers.ts`:

```ts
import type { LayerInfo, LayerType } from "../../../shared/types";

export interface RowLayer {
  layerIndex: number;
  rowKey: string;
  type: LayerType;
  name: string;
  fillPath: string;
}

// Flattens LayerInfo[] into a UI row list, splitting each shape layer's
// strokes into their own synthetic rows (same AE layer index, different
// property path) — mirrors main.js's renderLayerInfo virtual-entry injection.
export function buildRowLayers(layers: LayerInfo[]): RowLayer[] {
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
      rows.push({ layerIndex: layer.index, rowKey: String(layer.index), type: layer.type, name: layer.name, fillPath: "" });
    }
  }
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Zustand store**

```bash
npm install zustand
```

Create `src/js/main/state/store.ts`:

```ts
import { create } from "zustand";
import type { LayerInfo, LayerValue } from "../../../shared/types";
import { buildRowLayers, type RowLayer } from "./rowLayers";

interface AppState {
  compName: string | null;
  layerInfo: LayerInfo[];
  rowLayers: RowLayer[];
  count: number;
  sameForAll: boolean;
  values: Record<string, LayerValue[]>; // rowKey -> per-iteration value
  setLayerInfo(compName: string, layers: LayerInfo[]): void;
  setCount(count: number): void;
  setSameForAll(v: boolean): void;
  setValue(rowKey: string, iter: number, value: LayerValue): void;
  getValue(rowKey: string, iter: number): LayerValue | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  compName: null,
  layerInfo: [],
  rowLayers: [],
  count: 5,
  sameForAll: true,
  values: {},
  setLayerInfo: (compName, layers) => set({ compName, layerInfo: layers, rowLayers: buildRowLayers(layers) }),
  setCount: (count) => set({ count }),
  setSameForAll: (v) => set({ sameForAll: v }),
  setValue: (rowKey, iter, value) =>
    set((s) => {
      const arr = s.values[rowKey] ? [...s.values[rowKey]] : [];
      arr[iter] = value;
      return { values: { ...s.values, [rowKey]: arr } };
    }),
  getValue: (rowKey, iter) => get().values[rowKey]?.[iter],
}));
```

- [ ] **Step 6: Layer-type handler table (shape/text/stroke)**

Create `src/js/main/components/ColorFields.tsx` — shared row-fields component for shape, text, and stroke rows (text additionally shows font + content inputs):

```tsx
import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { hexToRgb, rgbToHex, normaliseHex } from "../lib/color";

export function ColorFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  const hex = value?.color ? rgbToHex(value.color).toUpperCase() : "#FF0000";

  const onHexChange = (raw: string) => {
    const normalised = normaliseHex(raw);
    if (!normalised) return;
    setValue(row.rowKey, iter, { ...value, color: hexToRgb(normalised) });
  };

  return (
    <div className="color-cell">
      <input type="color" value={hex.toLowerCase()} onChange={(e) => onHexChange(e.target.value)} />
      <input type="text" maxLength={7} value={hex} onChange={(e) => onHexChange(e.target.value)} />
      {row.type === "text" && (
        <>
          <input
            type="text"
            placeholder="PostScript name"
            value={value?.font ?? ""}
            onChange={(e) => setValue(row.rowKey, iter, { ...value, font: e.target.value })}
          />
          <input
            type="text"
            placeholder="Text content"
            value={value?.content ?? ""}
            onChange={(e) => setValue(row.rowKey, iter, { ...value, content: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
```

Create `src/js/main/state/layerHandlers.ts`:

```tsx
import type { LayerType } from "../../../shared/types";
import type { RowLayer } from "./rowLayers";
import { ColorFields } from "../components/ColorFields";

export interface LayerTypeHandler {
  RowFields: React.FC<{ row: RowLayer; iter: number }>;
}

export const LAYER_HANDLERS: Partial<Record<LayerType, LayerTypeHandler>> = {
  shape: { RowFields: ColorFields },
  text: { RowFields: ColorFields },
  stroke: { RowFields: ColorFields },
};
```

(`video` handler added in Task 9; `media` is out of scope for this plan — VAR mode.)

- [ ] **Step 7: `IterationRow` and `LayerInfoPanel` components**

Create `src/js/main/components/IterationRow.tsx`:

```tsx
import type { RowLayer } from "../state/rowLayers";
import { LAYER_HANDLERS } from "../state/layerHandlers";

export function IterationRow({ row, iter }: { row: RowLayer; iter: number }) {
  const handler = LAYER_HANDLERS[row.type];
  if (!handler) return <div className="iter-row">Unsupported layer type: {row.type}</div>;
  const Fields = handler.RowFields;
  return (
    <div className="iter-row">
      <span className="iter-num">{iter + 1}</span>
      <Fields row={row} iter={iter} />
    </div>
  );
}
```

Create `src/js/main/components/LayerInfoPanel.tsx`:

```tsx
import { useAppStore } from "../state/store";
import { evalTS } from "../lib/utils/bolt"; // match the real import path from Task 3
import { IterationRow } from "./IterationRow";

export function LayerInfoPanel() {
  const { compName, rowLayers, count, setLayerInfo } = useAppStore((s) => ({
    compName: s.compName,
    rowLayers: s.rowLayers,
    count: s.count,
    setLayerInfo: s.setLayerInfo,
  }));

  const refresh = () => {
    evalTS("getLayerInfo")
      .then((res) => setLayerInfo(res.compName, res.layers))
      .catch((err) => alert("Refresh failed: " + String(err)));
  };

  return (
    <div id="layer-section">
      <div id="layer-info">{compName ? `${compName} — ${rowLayers.length} row(s)` : "No layer selected"}</div>
      <button onClick={refresh}>Refresh Layer</button>
      {rowLayers.map((row) => (
        <div key={row.rowKey} className="extra-layer-group">
          <div className="layer-group-label">{row.name} [{row.type}]</div>
          {Array.from({ length: count }, (_, iter) => (
            <IterationRow key={iter} row={row} iter={iter} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 8: Wire into `App.tsx`**

Replace the temporary Task 6 refresh/dump UI in `App.tsx` with:

```tsx
import { LayerInfoPanel } from "./components/LayerInfoPanel";

function App() {
  return <LayerInfoPanel />;
}

export default App;
```

- [ ] **Step 9: Automated component test**

Create `src/js/main/components/IterationRow.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IterationRow } from "./IterationRow";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

describe("IterationRow", () => {
  it("shows font and content inputs for a text row, not for a shape row", () => {
    const textRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "text", name: "Title", fillPath: "" };
    render(<IterationRow row={textRow} iter={0} />);
    expect(screen.getByPlaceholderText("PostScript name")).toBeInTheDocument();

    const shapeRow: RowLayer = { layerIndex: 2, rowKey: "2", type: "shape", name: "Rect", fillPath: "Contents/Fill 1" };
    render(<IterationRow row={shapeRow} iter={0} />);
    expect(screen.queryAllByPlaceholderText("PostScript name")).toHaveLength(1); // still just the text row's
  });

  it("updates the store when a hex input changes", () => {
    const shapeRow: RowLayer = { layerIndex: 3, rowKey: "3", type: "shape", name: "Rect", fillPath: "Contents/Fill 1" };
    render(<IterationRow row={shapeRow} iter={0} />);
    const hexInput = screen.getAllByDisplayValue("#FF0000")[0];
    fireEvent.change(hexInput, { target: { value: "#00FF00" } });
    expect(useAppStore.getState().values["3"]?.[0]?.color).toEqual([0, 1, 0]);
  });
});
```

- [ ] **Step 10: Run all tests**

```bash
npm run test
```

Expected: PASS for `rowLayers.test.ts` and `IterationRow.test.tsx`.

- [ ] **Step 11: Verify manually in After Effects**

```bash
npm run build
```

Select a shape layer with 1 fill + 1 stroke, plus (with it) a text layer, in a comp. Click Refresh. Confirm:
- Two groups render: the shape's fill row group, a "Stroke — ..." row group, and the text row group (font + content inputs visible only for text).
- Typing a hex value updates the swatch and the text input in sync.

- [ ] **Step 12: Commit**

```bash
git add ae-iterations-next/src/js/main ae-iterations-next/package.json ae-iterations-next/package-lock.json
git commit -m "feat: row-list construction, Zustand store, and shape/text/stroke handler"
```

---

### Task 9: Video layer handler

**Files:**
- Create: `ae-iterations-next/src/js/main/components/VideoFields.tsx`
- Modify: `ae-iterations-next/src/js/main/state/layerHandlers.ts`

**Interfaces:**
- Consumes: `LAYER_HANDLERS`, `RowLayer`, `useAppStore` (Task 8).
- Produces: `LAYER_HANDLERS.video`.

Ported from `extension/js/main.js`'s `buildVideoRow` (lines 173–278) and `readVideoRowValue` (lines 656–672).

- [ ] **Step 1: Write the failing component test**

Create `src/js/main/components/VideoFields.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoFields } from "./VideoFields";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

const row: RowLayer = { layerIndex: 5, rowKey: "5", type: "video", name: "BG", fillPath: "" };

describe("VideoFields", () => {
  it("tint color and amount inputs are disabled until the tint checkbox is checked", () => {
    render(<VideoFields row={row} iter={0} />);
    const tintCheckbox = screen.getByRole("checkbox");
    const [tintColorInput] = screen.getAllByDisplayValue(/^#/);
    expect(tintColorInput).toBeDisabled();

    fireEvent.click(tintCheckbox);
    expect(tintColorInput).not.toBeDisabled();
    expect(useAppStore.getState().values["5"]?.[0]?.tint).not.toBeNull();
  });

  it("toggling flip updates the store", () => {
    render(<VideoFields row={row} iter={1} />);
    fireEvent.click(screen.getByTitle("Flip Horizontal"));
    expect(useAppStore.getState().values["5"]?.[1]?.flip).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ae-iterations-next && npm run test
```

Expected: FAIL — `Cannot find module './VideoFields'`.

- [ ] **Step 3: Implement `VideoFields`**

Create `src/js/main/components/VideoFields.tsx`:

```tsx
import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { hexToRgb, rgbToHex } from "../lib/color";
import type { LayerValue } from "../../../shared/types";

export function VideoFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  const v: LayerValue = value ?? { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 };

  const update = (patch: Partial<LayerValue>) => setValue(row.rowKey, iter, { ...v, ...patch });

  return (
    <div className="video-fields">
      <button
        className={"video-toggle" + (v.flip ? " active" : "")}
        title="Flip Horizontal"
        onClick={() => update({ flip: !v.flip })}
      >
        ↔
      </button>
      <button
        className={"video-toggle" + (v.bw ? " active" : "")}
        title="Black & White"
        onClick={() => update({ bw: !v.bw })}
      >
        B&W
      </button>
      <div className="tint-cell">
        <input
          type="checkbox"
          checked={!!v.tint}
          onChange={(e) => update({ tint: e.target.checked ? hexToRgb("#ff6b35") : null })}
        />
        <input
          type="color"
          disabled={!v.tint}
          value={v.tint ? rgbToHex(v.tint).toLowerCase() : "#ff6b35"}
          onChange={(e) => update({ tint: hexToRgb(e.target.value) })}
        />
        <input
          type="number"
          min={0}
          max={100}
          disabled={!v.tint}
          value={v.tintAmount ?? 50}
          onChange={(e) => update({ tintAmount: parseInt(e.target.value, 10) || 50 })}
        />
      </div>
      <input
        type="number"
        min={-180}
        max={180}
        title="Hue shift (degrees)"
        value={v.hue ?? 0}
        onChange={(e) => update({ hue: parseInt(e.target.value, 10) || 0 })}
      />
    </div>
  );
}
```

- [ ] **Step 4: Register the handler**

In `src/js/main/state/layerHandlers.ts`:

```ts
import { VideoFields } from "../components/VideoFields";
```
```ts
  video: { RowFields: VideoFields },
```

- [ ] **Step 5: Run tests**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 6: Verify manually in After Effects**

```bash
npm run build
```

Select a video/footage layer, refresh, confirm the video row group shows flip/B&W toggles, a tint checkbox+color+amount, and a hue number input, matching today's `buildVideoRow` layout and disabled-state behavior.

- [ ] **Step 7: Commit**

```bash
git add ae-iterations-next/src/js/main/components/VideoFields.tsx ae-iterations-next/src/js/main/components/VideoFields.test.tsx \
        ae-iterations-next/src/js/main/state/layerHandlers.ts
git commit -m "feat: add video layer handler (flip/B&W/tint/hue)"
```

---

### Task 10: Apply-change and apply-video host modules

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/applyChange.ts`
- Create: `ae-iterations-next/src/jsx/aeft/lib/applyVideo.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts` (temporary `debugApply` command for manual verification only — superseded by `previewApply` in Task 11)

**Interfaces:**
- Produces: `applyShapeColor`, `applyShapeStrokeColor`, `applyTextColor`, `applyTextContent`, `applyTextFont` (`applyChange.ts`); `applyVideoLayer(layer, val)` (`applyVideo.ts`). Consumed by `previewApply` (Task 11) and the engine (Task 16).

Ported verbatim from `extension/jsx/lib/apply-change.jsx` and `extension/jsx/lib/apply-video.jsx`.

- [ ] **Step 1: Port `applyChange.ts`**

```ts
export function applyShapeColor(layer: any, fillPath: string, colorRGB: [number, number, number]): boolean {
  const parts = fillPath.split("/");
  let current = layer;
  try {
    for (let i = 0; i < parts.length; i++) {
      current = current.property(parts[i]);
      if (!current) throw new Error("null at step " + i + " («" + parts[i] + "»)");
    }
    current.property("Color").setValue(colorRGB);
    return true;
  } catch (e) {
    return false;
  }
}

export function applyShapeStrokeColor(layer: any, strokePath: string, colorRGB: [number, number, number]): boolean {
  const parts = strokePath.split("/");
  let current = layer;
  try {
    for (let i = 0; i < parts.length; i++) {
      current = current.property(parts[i]);
      if (!current) throw new Error("null at «" + parts[i] + "»");
    }
    current.property("Color").setValue(colorRGB);
    return true;
  } catch (e) {
    return false;
  }
}

export function applyTextColor(layer: TextLayer, colorRGB: [number, number, number]): boolean {
  const textProp = layer.property("Source Text") as any;
  try {
    const textDoc = textProp.value;
    textDoc.createStyle().setFillColor(colorRGB).applyToAllKeyframes();
    return true;
  } catch (e) {}

  try {
    if (textProp.numKeys > 0) {
      for (let k = 1; k <= textProp.numKeys; k++) {
        const kDoc = textProp.keyValue(k);
        kDoc.applyFill = true;
        kDoc.fillColor = colorRGB;
        textProp.setValueAtTime(textProp.keyTime(k), kDoc);
      }
    } else {
      const textDoc2 = textProp.value;
      textDoc2.applyFill = true;
      textDoc2.fillColor = colorRGB;
      textProp.setValue(textDoc2);
    }
    return true;
  } catch (e2) {
    return false;
  }
}

export function applyTextContent(layer: TextLayer, text: string): boolean {
  text = text.replace(/\\n/g, "\r");
  const textProp = layer.property("Source Text") as any;
  try {
    if (textProp.numKeys > 0) {
      for (let k = 1; k <= textProp.numKeys; k++) {
        const kDoc = textProp.keyValue(k);
        kDoc.text = text;
        textProp.setValueAtTime(textProp.keyTime(k), kDoc);
      }
    } else {
      const textDoc = textProp.value;
      textDoc.text = text;
      textProp.setValue(textDoc);
    }
    return true;
  } catch (e) {
    return false;
  }
}

export function applyTextFont(layer: TextLayer, fontName: string): boolean {
  const textProp = layer.property("Source Text") as any;
  try {
    const textDoc = textProp.value;
    textDoc.createStyle().setFont(fontName).applyToAllKeyframes();
    return true;
  } catch (e) {}

  try {
    if (textProp.numKeys > 0) {
      for (let k = 1; k <= textProp.numKeys; k++) {
        const kDoc = textProp.keyValue(k);
        kDoc.font = fontName;
        textProp.setValueAtTime(textProp.keyTime(k), kDoc);
      }
    } else {
      const textDoc2 = textProp.value;
      textDoc2.font = fontName;
      textProp.setValue(textDoc2);
    }
    return true;
  } catch (e2) {
    return false;
  }
}
```

- [ ] **Step 2: Port `applyVideo.ts`**

```ts
function getOrAddEffect(layer: AVLayer, matchName: string): any {
  for (let i = 1; i <= layer.Effects.numProperties; i++) {
    if ((layer.Effects.property(i) as any).matchName === matchName) return layer.Effects.property(i);
  }
  return layer.Effects.addProperty(matchName);
}

function removeEffect(layer: AVLayer, matchName: string): void {
  for (let i = layer.Effects.numProperties; i >= 1; i--) {
    if ((layer.Effects.property(i) as any).matchName === matchName) {
      layer.Effects.property(i).remove();
      return;
    }
  }
}

export function applyVideoLayer(layer: AVLayer, val: { flip: boolean; bw: boolean; tint: [number, number, number] | null; tintAmount?: number; hue: number }): boolean {
  const sc = layer.transform.scale;
  const sv = sc.value as [number, number];
  sc.setValue([val.flip ? -Math.abs(sv[0]) : Math.abs(sv[0]), sv[1]]);

  const needHS = val.bw || val.hue !== 0;
  if (needHS) {
    const hs = getOrAddEffect(layer, "ADBE HUE SATURATION");
    hs.property("Master Hue").setValue(val.hue || 0);
    hs.property("Master Saturation").setValue(val.bw ? -100 : 0);
  } else {
    removeEffect(layer, "ADBE HUE SATURATION");
  }

  if (val.tint && val.tint.length >= 3) {
    const tint = getOrAddEffect(layer, "ADBE Tint");
    tint.property("Map Black To").setValue([val.tint[0], val.tint[1], val.tint[2], 1]);
    tint.property("Map White To").setValue([1, 1, 1, 1]);
    tint.property("Amount to Tint").setValue(val.tintAmount !== undefined ? val.tintAmount : 50);
  } else {
    removeEffect(layer, "ADBE Tint");
  }

  return true;
}
```

- [ ] **Step 3: Temporary manual-verification command**

In `aeft.ts`, add a throwaway command (deleted/replaced in Task 11) purely to exercise the two modules against a real layer before the full preview flow exists:

```ts
import { applyShapeColor } from "./lib/applyChange";

export const debugApplyRed = (): { applied: boolean } => {
  const comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) throw new Error("No active composition");
  const layer = comp.selectedLayers[0] as ShapeLayer;
  if (!layer) throw new Error("No layer selected");
  const ok = applyShapeColor(layer, "Contents/Group 1/Contents/Fill 1", [1, 0, 0]);
  return { applied: ok };
};
```

- [ ] **Step 4: Verify manually in After Effects**

```bash
npm run build
```

Wire a temporary button in `App.tsx` calling `evalTS("debugApplyRed")`. Select a shape layer whose first group's fill path matches `Contents/Group 1/Contents/Fill 1`, click the button, confirm the fill turns red in AE. Then remove the temporary button/command — Task 11 replaces it with the real preview flow.

- [ ] **Step 5: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/lib/applyChange.ts ae-iterations-next/src/jsx/aeft/lib/applyVideo.ts
git commit -m "feat: port applyChange and applyVideo host modules"
```

---

### Task 11: previewApply command + Preview button wired end-to-end

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/applyLayerValue.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts` (add `previewApply`, remove `debugApplyRed`)
- Create: `ae-iterations-next/src/js/main/components/RunButton.tsx` (adds the Preview action for now; Run is wired in Task 17)
- Modify: `ae-iterations-next/src/js/main/App.tsx`

**Interfaces:**
- Consumes: `applyShapeColor`, `applyShapeStrokeColor`, `applyTextColor`, `applyTextContent`, `applyTextFont` (Task 10), `applyVideoLayer` (Task 10), `findCompByName` (Task 7), `CfgLayer`/`LayerValue` (Task 6), `useAppStore` (Task 8).
- Produces: `applyLayerValue(layer, lc: CfgLayer, val: LayerValue): string[]` (log lines); `previewApply(cfg: { compName: string; layers: CfgLayer[]; values: LayerValue[] }): { log: string[] }` host command.

Ports `applyLayerValue` and `debugApplyChangeJSON` from `extension/jsx/host.jsx` (lines 65–101, 235–276), minus the emoji-removal call (no emoji feature in this plan) and using `throw` instead of `{error}` per the Global Constraints convention.

- [ ] **Step 1: Port the per-layer-type dispatch**

Create `src/jsx/aeft/lib/applyLayerValue.ts`:

```ts
import { applyShapeColor, applyShapeStrokeColor, applyTextColor, applyTextContent, applyTextFont } from "./applyChange";
import { applyVideoLayer } from "./applyVideo";
import type { CfgLayer, LayerValue } from "../../../shared/types";

export function applyLayerValue(layer: any, lc: CfgLayer, val: LayerValue): string[] {
  const log: string[] = [];
  if (lc.layerType === "shape") {
    const ok = applyShapeColor(layer, lc.fillPath, val.color as [number, number, number]);
    log.push("→ shapeColor: " + (ok ? "OK" : "FAILED"));
  } else if (lc.layerType === "stroke") {
    const ok = applyShapeStrokeColor(layer, lc.fillPath, val.color as [number, number, number]);
    log.push("→ strokeColor: " + (ok ? "OK" : "FAILED"));
  } else if (lc.layerType === "video") {
    const ok = applyVideoLayer(layer, {
      flip: !!val.flip, bw: !!val.bw, tint: val.tint ?? null, tintAmount: val.tintAmount, hue: val.hue ?? 0,
    });
    log.push("→ videoEffects: " + (ok ? "OK" : "FAILED"));
  } else if (lc.layerType === "text") {
    if (val.content) log.push("→ textContent: " + (applyTextContent(layer, val.content) ? "OK" : "FAILED"));
    if (val.color) log.push("→ textColor: " + (applyTextColor(layer, val.color as [number, number, number]) ? "OK" : "FAILED"));
    if (val.font) log.push("→ textFont: " + (applyTextFont(layer, val.font) ? "OK" : "FAILED"));
    if (!val.content && !val.color && !val.font) log.push("→ nothing to apply (no content, no color, no font)");
  } else {
    log.push("→ skipped (unsupported type: " + lc.layerType + ")");
  }
  return log;
}
```

- [ ] **Step 2: Add the `previewApply` command, remove the Task 10 throwaway**

In `aeft.ts`, remove `debugApplyRed` and add:

```ts
import { findCompByName } from "./lib/findComp";
import { applyLayerValue } from "./lib/applyLayerValue";
import type { CfgLayer, LayerValue } from "../shared/types";

export const previewApply = (cfg: { compName: string; layers: CfgLayer[]; values: LayerValue[] }): { log: string[] } => {
  const comp = findCompByName(cfg.compName);
  if (!comp) throw new Error("Comp not found: " + cfg.compName);

  const log: string[] = [];
  app.beginSuppressDialogs();
  app.beginUndoGroup("Preview Apply");
  for (let li = 0; li < cfg.layers.length; li++) {
    const lc = cfg.layers[li];
    const layer = comp.layer(lc.index);
    if (!layer) {
      log.push("Layer " + lc.index + ": NOT FOUND");
      continue;
    }
    log.push("Layer " + lc.index + ": " + layer.name + "  [" + lc.layerType + "]");
    log.push(...applyLayerValue(layer, lc, cfg.values[li]).map((l) => "  " + l));
  }
  app.endUndoGroup();
  app.endSuppressDialogs(false);

  return { log };
};
```

- [ ] **Step 3: Panel wiring — build `CfgLayer[]` from row list and preview one iteration**

In `LayerInfoPanel.tsx` (or a new small `lib/buildCfg.ts` if it's getting crowded — keep it inline here since it's ~10 lines), add a helper and a "Preview" affordance per iteration column. Add to `src/js/main/state/rowLayers.ts`:

```ts
import type { CfgLayer } from "../../../shared/types";

export function toCfgLayers(rows: RowLayer[]): CfgLayer[] {
  return rows.map((r) => ({ index: r.layerIndex, name: r.name, fillPath: r.fillPath, layerType: r.type }));
}
```

In `LayerInfoPanel.tsx`, add a preview handler and a button per iteration index (reusing the existing `count`/`rowLayers`/`values` from the store):

```tsx
import { toCfgLayers } from "../state/rowLayers";

// inside LayerInfoPanel component:
const values = useAppStore((s) => s.values);

const previewIteration = (iter: number) => {
  if (!compName) return;
  const layers = toCfgLayers(rowLayers);
  const iterValues = rowLayers.map((r) => values[r.rowKey]?.[iter] ?? {});
  evalTS("previewApply", { compName, layers, values: iterValues })
    .then((res) => console.log(res.log.join("\n")))
    .catch((err) => alert("Preview failed: " + String(err)));
};
```

Add a small preview button next to each `IterationRow`'s iteration number (pass `onPreview={() => previewIteration(iter)}` down, or simplest: add a "Preview N" button row above the groups that iterates `count`).

- [ ] **Step 4: Verify manually in After Effects**

```bash
npm run build
```

On a real ITR test comp: select a shape+text+video layer set, refresh, fill in 2 different rows of values (different hex colors, different video toggles), click "Preview 2". Confirm:
- The comp updates to iteration 2's values.
- `Ctrl+Z` undoes it in one step (confirms the undo-group wrapping works).
- The panel doesn't throw if you preview with an empty/unfilled row (values default to `{}`, dispatch falls into "nothing to apply" for text, or leaves shape/video untouched — verify no crash).

- [ ] **Step 5: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/lib/applyLayerValue.ts ae-iterations-next/src/jsx/aeft/aeft.ts \
        ae-iterations-next/src/js/main/state/rowLayers.ts ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx
git commit -m "feat: wire per-iteration preview end-to-end"
```

---

### Task 12: Render module (PNG + video)

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/render.ts`

**Interfaces:**
- Consumes: `findCompsBySuffixes`, `ITR_SUFFIXES` (Task 7).
- Produces: `renderPNGs(comps: Record<string, CompItem>, outFolder: Folder): void`, `renderVideos(comps: Record<string, CompItem>, outFolder: Folder): void`. Consumed by the engine (Task 16).

Ported verbatim from `extension/jsx/lib/render.jsx`'s `renderPNGs` (lines 6–22) and `renderVideos` (lines 24–52) — the ITR-only render functions. (`renderVarPNGs`/`renderVarVideos` are VAR-mode and out of scope for this plan.)

- [ ] **Step 1: Port `render.ts`**

```ts
import { ITR_SUFFIXES } from "./findComp";

export function renderPNGs(comps: Record<string, CompItem>, outFolder: Folder): void {
  const errors: string[] = [];
  for (let s = 0; s < ITR_SUFFIXES.length; s++) {
    const suffix = ITR_SUFFIXES[s];
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

export function renderVideos(comps: Record<string, CompItem>, outFolder: Folder): void {
  const rq = app.project.renderQueue;
  const added: any[] = [];
  for (let s = 0; s < ITR_SUFFIXES.length; s++) {
    const comp = comps[ITR_SUFFIXES[s]];
    if (!comp) continue;
    const rqItem = rq.items.add(comp);
    const om = rqItem.outputModules[1] as any;
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
  if (!added.length) throw new Error("No ITR comps in render queue");
  rq.render();
}
```

- [ ] **Step 2: Verify manually in After Effects**

Add a temporary command in `aeft.ts` (removed after verification, same pattern as Task 10):

```ts
import { findCompsBySuffixes, ITR_SUFFIXES } from "./lib/findComp";
import { renderPNGs, renderVideos } from "./lib/render";

export const debugRender = (outPath: string): { rendered: boolean } => {
  const comps = findCompsBySuffixes(ITR_SUFFIXES);
  const outFolder = new Folder(outPath);
  if (!outFolder.exists) outFolder.create();
  renderPNGs(comps, outFolder);
  renderVideos(comps, outFolder);
  return { rendered: true };
};
```

```bash
npm run build
```

On a real project with the 3 `ITR_9x16`/`ITR_1x1`/`ITR_16x9` comps, call `evalTS("debugRender", "/tmp/ae-iter-render-test")` from a temporary button. Confirm 3 PNGs (correct dimensions per comp) and 3 video files land in that folder, matching what the current extension produces for the same source project. Remove the temporary command afterward.

- [ ] **Step 3: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/lib/render.ts
git commit -m "feat: port PNG and video render functions"
```

---

### Task 13: Clean module (project panel organization)

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/clean.ts`

**Interfaces:**
- Produces: `cleanProject(protectedNames?: string[]): { removed: number }`. Consumed by the engine (Task 16).

Ported verbatim from `extension/jsx/lib/clean.jsx`, converting the `JSON.stringify` return convention to a plain typed return per the Global Constraints (internal function — no CEP boundary crossing here, `evalTS` isn't involved since this isn't itself an exported `aeft.ts` command).

- [ ] **Step 1: Port `clean.ts`**

```ts
const LANG_FOLDERS = ["AR", "CH", "DE", "EN", "ES", "FR", "HI", "IT", "JP", "KR", "PL", "PT", "RU", "TU"];

function ensureMainStuffFolder(): FolderItem {
  const root = app.project.rootFolder;
  for (let i = 1; i <= app.project.numItems; i++) {
    const it = app.project.item(i);
    if (it instanceof FolderItem && it.name === "Stuff") {
      if (it.parentFolder !== root) {
        try { it.parentFolder = root; } catch (e) {}
      }
      return it;
    }
  }
  const f = app.project.items.addFolder("Stuff");
  try { f.parentFolder = root; } catch (e) {}
  return f;
}

function ensureSub(name: string, parent: FolderItem): FolderItem {
  for (let i = 1; i <= app.project.numItems; i++) {
    const it = app.project.item(i);
    if (it instanceof FolderItem && it.name === name && it.parentFolder === parent) return it;
  }
  const f = app.project.items.addFolder(name);
  try { f.parentFolder = parent; } catch (e) {}
  return f;
}

function inMediaReplacement(item: any, mrf: FolderItem | null): boolean {
  if (!mrf) return false;
  let p = item.parentFolder;
  while (p) {
    if (p === mrf) return true;
    p = p.parentFolder;
  }
  return false;
}

function layerTypeOf(obj: any): string | null {
  if (!obj.blendingMode && !obj.isTrackMatte && !obj.source) return "Camera/Light";
  if (obj instanceof ShapeLayer) return "Shape";
  if (obj instanceof TextLayer) return "Text";
  if (!obj.source.file && obj.source.duration == 0) return "Solid";
  if (obj.source instanceof CompItem) return "Composition";
  if (obj.source.hasVideo === false && obj.source.hasAudio === true) return "Audio";
  if (obj.source.hasVideo === true && obj.source.hasAudio === true && obj.duration !== 0) return "Video";
  if (obj.source.hasVideo === true && obj.source.hasAudio === false && obj.source.duration === 0) return "Picture";
  if (obj.source.hasVideo === true && obj.duration !== 0 && obj.source.hasAudio === false) return "Video";
  return null;
}

function inLangFolder(parentName: string): boolean {
  return LANG_FOLDERS.indexOf(parentName) !== -1;
}

function singlePass(protectedNames?: string[]): { removed: number } {
  const main = ensureMainStuffFolder();
  const vd = ensureSub("01_Video", main);
  const img = ensureSub("02_Images", main);
  const pcm = ensureSub("03_Pre-Comp", main);
  const snd = ensureSub("04_Sound", main);
  const oth = ensureSub("05_Other", main);
  const sld = ensureSub("Solids", oth);
  const txt = ensureSub("Texts", main);
  ensureSub("MOGRT Stuff", main);
  const miss = ensureSub("Missing Files", main);

  let mrf: FolderItem | null = null;
  for (let i = 1; i <= app.project.numItems; i++) {
    const it = app.project.item(i);
    if (it instanceof FolderItem && it.name === "Media Replacement Comps") {
      mrf = it;
      try { it.parentFolder = main; } catch (e) {}
    }
  }

  for (let s = app.project.numItems; s >= 1; s--) {
    const si = app.project.item(s) as any;
    if (inMediaReplacement(si, mrf)) continue;
    const pn = (si.parentFolder && si.parentFolder.name) || "";
    const sub = !inLangFolder(pn);
    const msf = pn.slice(0, 6) !== "Texts_";
    try {
      if (si.typeName === "Footage" && !si.file) si.parentFolder = sld;

      if (!si.selected && si.typeName === "Composition" && sub && msf) {
        let prot = false;
        if (protectedNames) {
          for (let pp = 0; pp < protectedNames.length; pp++) {
            if (si.name === protectedNames[pp]) { prot = true; break; }
          }
        }
        if (!prot) {
          let hasText = false, hasOther = false;
          for (let l = si.numLayers; l >= 1; l--) {
            try {
              const t = layerTypeOf(si.layer(l));
              if (t === "Text") hasText = true; else hasOther = true;
            } catch (eL) { hasOther = true; }
          }
          si.parentFolder = hasText && !hasOther ? txt : pcm;
        }
      }

      if (si.typeName === "Folder" && si.name.slice(0, 6) === "Texts_") si.parentFolder = txt;
      if (si.file && si.hasVideo && si.hasAudio && si.duration !== 0) si.parentFolder = vd;
      if (si.file && si.duration === 0) si.parentFolder = img;
      if (si.file && si.duration !== 0 && !si.hasAudio) si.parentFolder = vd;
      if (si.file && !si.hasVideo && si.hasAudio) si.parentFolder = snd;
      if (si.footageMissing) si.parentFolder = miss;
    } catch (e) {}
  }

  let removed = 0;
  for (let s2 = app.project.numItems; s2 >= 1; s2--) {
    const ri = app.project.item(s2) as any;
    if (inMediaReplacement(ri, mrf)) continue;
    if (protectedNames) {
      let prot = false;
      for (let pi = 0; pi < protectedNames.length; pi++) {
        if (ri.name === protectedNames[pi]) { prot = true; break; }
      }
      if (prot) continue;
    }
    try {
      if (ri.usedIn.length === 0 && !ri.selected) { ri.remove(); removed++; }
    } catch (e) {}
  }

  try { app.project.removeUnusedFootage(); } catch (e) {}
  try { app.project.consolidateFootage(); } catch (e) {}
  return { removed };
}

export function cleanProject(protectedNames?: string[]): { removed: number } {
  app.beginUndoGroup("AE Iterations – Clean Project");
  let total = 0;
  try {
    for (let pass = 0; pass < 10; pass++) total += singlePass(protectedNames).removed;
  } finally {
    try { app.endUndoGroup(); } catch (e) {}
  }
  return { removed: total };
}
```

(Note: original `ri.usedIn == 0` compared an array to a number, which is always `false` in loose JS comparison — this looks like a latent bug in the current extension where that specific check never actually filters anything by usage. Since fidelity to *working* behavior, not literal bugs, is the goal, this port uses `ri.usedIn.length === 0` which is what the check almost certainly intended. Flag this during Task 13's manual verification — if it changes which items get removed compared to the current extension, that's expected and correct, not a regression.)

- [ ] **Step 2: Verify manually in After Effects**

Add a temporary `debugClean` command mirroring the Task 10/12 pattern, call it on a copy of a real messy test project (with unorganized footage, orphaned comps, an existing "Media Replacement Comps" folder if you have one to test with), and compare the resulting project-panel folder structure against running the *current* extension's clean step (or the standalone "Finish Him Clean Project" tool if that's how you normally invoke it) on an identical copy of the same starting project. Confirm folder placement and the removed-item count are equivalent (accounting for the `usedIn` fix noted above). Remove the temporary command afterward.

- [ ] **Step 3: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/lib/clean.ts
git commit -m "feat: port project panel clean/organize logic"
```

---

### Task 14: Collect module (footage copy + relink)

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/collect.ts`

**Interfaces:**
- Produces: `performCollect(projectFile: File, collectFolder: Folder): void`. Consumed by the engine (Task 16).

Ported verbatim from `extension/jsx/lib/collect.jsx`.

- [ ] **Step 1: Port `collect.ts`**

```ts
export function performCollect(projectFile: File, collectFolder: Folder): void {
  const footageFolder = new Folder(collectFolder.fsName + "/(Footage)");
  if (!footageFolder.exists) footageFolder.create();

  const srcToDest: Record<string, File> = {};
  const destPaths: Record<string, boolean> = {};

  function binPath(item: any): string {
    const parts: string[] = [];
    let parent = item.parentFolder;
    while (parent && parent !== app.project.rootFolder) {
      parts.unshift(parent.name.replace(/[\/\\:*?"<>|]+/g, "_"));
      parent = parent.parentFolder;
    }
    return parts.join("/");
  }

  function binFolder(item: any): Folder {
    const rel = binPath(item);
    const parts = rel ? rel.split("/") : [];
    let cur = footageFolder;
    for (let p = 0; p < parts.length; p++) {
      cur = new Folder(cur.fsName + "/" + parts[p]);
      if (!cur.exists) cur.create();
    }
    return cur;
  }

  function claimDest(srcFile: File, destDir: Folder): File {
    if (srcToDest[srcFile.fsName]) return srcToDest[srcFile.fsName];
    const base = srcFile.name.replace(/\.[^.]+$/, "");
    const ext = (srcFile.name.match(/\.[^.]+$/) || [""])[0];
    let path = destDir.fsName + "/" + srcFile.name;
    let n = 2;
    while (destPaths[path]) {
      path = destDir.fsName + "/" + base + "_" + n + ext;
      n++;
    }
    destPaths[path] = true;
    srcToDest[srcFile.fsName] = new File(path);
    return srcToDest[srcFile.fsName];
  }

  function copySingleFile(srcFile: File, destDir: Folder): File {
    const dest = claimDest(srcFile, destDir);
    if (!dest.exists) srcFile.copy(dest.fsName);
    return dest;
  }

  function copySequence(firstFile: File, destDir: Folder): File {
    const name = firstFile.name;
    const match = name.match(/^([\s\S]*?)(\d+)(\.[^.]+)$/);
    if (!match) return copySingleFile(firstFile, destDir);
    const prefix = match[1], numDigits = match[2].length, ext = match[3];
    const allFiles = firstFile.parent.getFiles(prefix + "*" + ext);
    let firstDest: File | null = null;
    for (let si = 0; si < allFiles.length; si++) {
      const ff = allFiles[si];
      if (!(ff instanceof File)) continue;
      const fm = ff.name.match(/^([\s\S]*?)(\d+)(\.[^.]+)$/);
      if (!fm || fm[1] !== prefix || fm[2].length !== numDigits || fm[3] !== ext) continue;
      const frameDest = new File(destDir.fsName + "/" + ff.name);
      if (!frameDest.exists) ff.copy(frameDest.fsName);
      if (!firstDest) firstDest = frameDest;
    }
    if (firstDest) srcToDest[firstFile.fsName] = firstDest;
    return firstDest || copySingleFile(firstFile, destDir);
  }

  const relinkMain: { item: any; origFile: File; newFile: File; isSeq: boolean }[] = [];
  const relinkProxy: { item: any; origFile: File; newFile: File; isSeq: boolean }[] = [];

  for (let ci = 1; ci <= app.project.numItems; ci++) {
    const item = app.project.item(ci);
    if (!(item instanceof FootageItem)) continue;
    const dest = binFolder(item);
    try {
      const ms = item.mainSource as any;
      if (ms && ms.file && ms.file.exists) {
        const newMF = ms.isSequence ? copySequence(ms.file, dest) : copySingleFile(ms.file, dest);
        relinkMain.push({ item, origFile: ms.file, newFile: newMF, isSeq: ms.isSequence });
      }
    } catch (e) {}
    try {
      if (item.hasProxy) {
        const ps = item.proxySource as any;
        if (ps && ps.file && ps.file.exists) {
          const newPF = ps.isSequence ? copySequence(ps.file, dest) : copySingleFile(ps.file, dest);
          relinkProxy.push({ item, origFile: ps.file, newFile: newPF, isSeq: ps.isSequence });
        }
      }
    } catch (e) {}
  }

  function applyRelinks(list: typeof relinkMain, toNew: boolean): void {
    for (const e of list) {
      const target = toNew ? e.newFile : e.origFile;
      try { e.isSeq ? e.item.replaceWithSequence(target, false) : e.item.replace(target); } catch (err) {}
    }
  }
  function applyProxyRelinks(list: typeof relinkProxy, toNew: boolean): void {
    for (const e of list) {
      const target = toNew ? e.newFile : e.origFile;
      try { e.isSeq ? e.item.setProxyWithSequence(target, false) : e.item.setProxy(target); } catch (err) {}
    }
  }

  app.project.save(projectFile);
  applyRelinks(relinkMain, true);
  applyProxyRelinks(relinkProxy, true);
  app.project.save(new File(collectFolder.fsName + "/" + projectFile.name));
  applyRelinks(relinkMain, false);
  applyProxyRelinks(relinkProxy, false);
  app.project.save(projectFile);
}
```

- [ ] **Step 2: Verify manually in After Effects**

Add a temporary `debugCollect` command (same disposable pattern as prior tasks). On a real test project with a mix of single files, an image sequence, and at least one proxy, run it into a fresh folder. Confirm:
- A `(Footage)/` folder appears with the same sub-folder structure (mirroring bin names) as the current extension produces on the same project.
- The collected copy's project file opens standalone with all footage relinked to the copied files.
- The *original* project file is unchanged (still points at the original footage) after the run — this is the "save, relink, save-to-collect-folder, re-relink-to-original, save" round-trip working correctly.

- [ ] **Step 3: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/lib/collect.ts
git commit -m "feat: port footage collect and relink logic"
```

---

### Task 15: Project copy/rename module

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/lib/project.ts`

**Interfaces:**
- Consumes: `incrementProjectId` (Task 4).
- Produces: `copyProject(srcFile: File): { file: File; oldId: string; newId: string }`, `renameComps(oldId: string, newId: string): void`. Consumed by the engine/`itrStrategy` (Task 16).

Ported verbatim from `extension/jsx/lib/project.jsx`.

- [ ] **Step 1: Port `project.ts`**

```ts
import { incrementProjectId } from "./naming";

export function copyProject(srcFile: File): { file: File; oldId: string; newId: string } {
  const baseName = srcFile.name.replace(/\.[^.]+$/, "");
  const ext = (srcFile.name.match(/\.[^.]+$/) || [".aep"])[0];
  const parts = baseName.split("_");
  const oldId = parts[1];
  const newName = incrementProjectId(baseName);
  const newFile = new File(srcFile.parent.fsName + "/" + newName + ext);
  if (newFile.exists) newFile.remove();
  const ok = srcFile.copy(newFile.fsName);
  if (!ok) throw new Error("File copy failed: " + newFile.name);
  return { file: newFile, oldId, newId: newName.split("_")[1] };
}

export function renameComps(oldId: string, newId: string): void {
  const toRename: { item: CompItem; name: string }[] = [];
  for (let i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);
    if (!(item instanceof CompItem)) continue;
    const p = item.name.split("_");
    if (p.length >= 2 && p[1] === oldId) {
      p[1] = newId;
      toRename.push({ item, name: p.join("_") });
    }
  }
  for (const r of toRename) r.item.name = r.name;
}
```

(This reuses `incrementProjectId` rather than re-deriving the new ID with separate logic, so `copyProject`'s naming and `incrementProjectId`'s unit-tested behavior can never drift apart — the original `project.jsx` duplicated the increment logic inline instead of calling `naming.jsx`'s function.)

- [ ] **Step 2: Verify manually in After Effects**

Add a temporary `debugCopyProject` command. On a saved copy of a real test `.aep` (e.g. `LO_10794_..._ITR_9x16.aep`), run it and confirm:
- A new file `LO_10795_..._ITR_9x16.aep` appears alongside it.
- Opening the new file and calling `renameComps("10794", "10795")` renames every comp whose name contains `10794` to the `10795` equivalent, matching the current extension's behavior.

- [ ] **Step 3: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/lib/project.ts
git commit -m "feat: port project copy and comp rename logic"
```

---

### Task 16: Unified iteration engine + ITR strategy + runIterations command

**Files:**
- Create: `ae-iterations-next/src/jsx/aeft/engine/runIterationBatch.ts`
- Create: `ae-iterations-next/src/jsx/aeft/engine/strategies/itrStrategy.ts`
- Modify: `ae-iterations-next/src/jsx/aeft/aeft.ts` (add `runIterations`, remove any remaining temporary debug commands from Tasks 10/12/13/14/15)

**Interfaces:**
- Consumes: `findCompByName`, `findCompsBySuffixes`, `ITR_SUFFIXES` (Task 7); `applyLayerValue` (Task 11); `renderPNGs`/`renderVideos` (Task 12); `cleanProject` (Task 13); `performCollect` (Task 14); `copyProject`/`renameComps` (Task 15); `RunConfig`/`RunResult` (Task 6).
- Produces: `IterationStrategy` interface; `ITR_STRATEGY`; `runIterationBatch(cfg: RunConfig, strategy: IterationStrategy): RunResult`; `runIterations(cfg: RunConfig): RunResult` host command.

This is the integration task: the unified engine that replaces `runIterationsJSON`'s body (`extension/jsx/host.jsx` lines 281–424), parameterized so `runVarIterationsJSON`'s eventual replacement (a future plan) reuses the same body via a different strategy.

- [ ] **Step 1: Define the strategy interface and engine**

Create `src/jsx/aeft/engine/runIterationBatch.ts`:

```ts
import { applyLayerValue } from "../lib/applyLayerValue";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { findCompByName, findCompsBySuffixes, ITR_SUFFIXES } from "../lib/findComp";
import type { RunConfig, RunResult } from "../../shared/types";

export interface TargetState {
  file: File;
  compName: string;
}

export interface IterationStrategy {
  // Given the current target, produce the file+comp name for the NEXT iteration.
  // Called after finishing iteration `iter`, only when iter < count - 1.
  nextTarget(current: TargetState, iter: number): TargetState;
  // Optional extra work to run against the target comp before render (no-op for ITR core in this plan).
  perIterationExtra?(comp: CompItem, iter: number): void;
  // Folder name (under GD/) for this iteration's delivery output.
  outputFolderName(target: TargetState, iter: number): string;
}

export function runIterationBatch(cfg: RunConfig, strategy: IterationStrategy): RunResult {
  const projectFile = app.project.file;
  if (!projectFile) throw new Error("Project not saved. Save it first.");

  let current: TargetState = { file: projectFile, compName: cfg.compName };
  const warnings: string[] = [];

  app.beginSuppressDialogs();
  try {
    for (let iter = 0; iter < cfg.count; iter++) {
      if (current.compName && cfg.layers.length > 0) {
        const comp = findCompByName(current.compName);
        if (!comp) throw new Error("Iter " + (iter + 1) + ": comp not found: " + current.compName);

        app.beginUndoGroup("Iteration " + (iter + 1));
        for (let li = 0; li < cfg.layers.length; li++) {
          const lc = cfg.layers[li];
          const layer = comp.layer(lc.index);
          if (!layer) {
            warnings.push("Iter " + (iter + 1) + ": layer " + lc.index + " not found");
            continue;
          }
          const val = cfg.values[iter][li];
          applyLayerValue(layer, lc, val);
        }
        app.endUndoGroup();

        if (strategy.perIterationExtra) strategy.perIterationExtra(comp, iter);
      }

      app.project.save(current.file);
      app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      app.open(current.file);

      const baseName = current.file.name.replace(/\.[^.]+$/, "");
      const gdFolder = new Folder(current.file.parent.fsName + "/GD");
      if (!gdFolder.exists) gdFolder.create();
      const deliveryFolder = new Folder(gdFolder.fsName + "/" + strategy.outputFolderName(current, iter));
      if (!deliveryFolder.exists) deliveryFolder.create();
      const collectFolder = new Folder(deliveryFolder.fsName + "/" + baseName + " folder");
      if (!collectFolder.exists) collectFolder.create();

      const itrComps = findCompsBySuffixes(ITR_SUFFIXES);
      try { renderPNGs(itrComps, deliveryFolder); } catch (e: any) { warnings.push("Iter " + (iter + 1) + " PNG: " + e.message); }
      try { renderVideos(itrComps, deliveryFolder); } catch (e: any) { warnings.push("Iter " + (iter + 1) + " video: " + e.message); }

      const protectedNames = ITR_SUFFIXES.map((s) => itrComps[s]?.name).filter((n): n is string => !!n);
      try { cleanProject(protectedNames); } catch (e: any) { warnings.push("Iter " + (iter + 1) + " clean: " + e.message); }
      try { performCollect(current.file, collectFolder); } catch (e: any) { warnings.push("Iter " + (iter + 1) + " collect: " + e.message); }

      if (iter < cfg.count - 1) {
        current = strategy.nextTarget(current, iter);
        app.open(current.file);
      }
    }
  } finally {
    app.endSuppressDialogs(false);
  }

  return { warnings };
}
```

- [ ] **Step 2: ITR strategy**

Create `src/jsx/aeft/engine/strategies/itrStrategy.ts`:

```ts
import { copyProject, renameComps } from "../../lib/project";
import { incrementProjectId } from "../../lib/naming";
import type { IterationStrategy, TargetState } from "../runIterationBatch";

export const ITR_STRATEGY: IterationStrategy = {
  nextTarget(current: TargetState): TargetState {
    const copied = copyProject(current.file);
    renameComps(copied.oldId, copied.newId);
    const baseName = current.compName.replace(/\.[^.]+$/, "");
    const newCompName = incrementProjectId(baseName);
    return { file: copied.file, compName: newCompName };
  },
  outputFolderName(current: TargetState): string {
    return current.file.name.replace(/\.[^.]+$/, "");
  },
};
```

- [ ] **Step 3: Add the `runIterations` command**

In `aeft.ts`, remove any temporary debug commands still left from Tasks 10/12/13/14/15, and add:

```ts
import { runIterationBatch } from "./engine/runIterationBatch";
import { ITR_STRATEGY } from "./engine/strategies/itrStrategy";
import type { RunConfig, RunResult } from "../shared/types";

export const runIterations = (cfg: RunConfig): RunResult => {
  return runIterationBatch(cfg, ITR_STRATEGY);
};
```

- [ ] **Step 4: Parity verification against the current extension**

This is the exit criterion for Phase 2 per the design spec — treat it as the most important verification step in this plan.

1. Duplicate a real ITR test project (the same source `.aep`) into two copies: `parity-old/` and `parity-new/`.
2. In `parity-old/`, open the project in AE with the **current** extension, select the same layers, fill in the **same** 3 rows of values (write them down or screenshot so they're reproducible), set count to 3, click **Run Iterations**. Let it finish.
3. In `parity-new/`, open the other copy, select the same layers, fill in the identical 3 rows of values, set count to 3, wire a temporary "Run" button (`evalTS("runIterations", cfg)` using the same `toCfgLayers`/store-values pattern from Task 11's preview wiring) and trigger it.
4. Compare `parity-old/GD/` against `parity-new/GD/`:
   - Same number of iteration folders, same naming pattern (incremented IDs).
   - Each folder's 3 PNGs: same dimensions, visually identical content (open side by side).
   - Each folder's video renders: same file extensions, comparable duration/dimensions.
   - Each `... folder/` collected output: same `(Footage)/` structure, and the collected `.aep` opens standalone with footage relinked.
5. Document any discrepancy and resolve it before moving on — this is the correctness bar the whole rewrite is judged against.

- [ ] **Step 5: Commit**

```bash
git add ae-iterations-next/src/jsx/aeft/engine ae-iterations-next/src/jsx/aeft/aeft.ts
git commit -m "feat: unify ITR iteration loop into runIterationBatch + ITR_STRATEGY"
```

---

### Task 17: Final panel wiring — count input, same-for-all, Run button, ModeTabs stub

**Files:**
- Create: `ae-iterations-next/src/js/main/components/ModeTabs.tsx`
- Modify: `ae-iterations-next/src/js/main/components/RunButton.tsx` (created in Task 11 as a placeholder — finished here)
- Modify: `ae-iterations-next/src/js/main/App.tsx`
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx` (same-for-all behavior for multi-layer selections)

**Interfaces:**
- Consumes: everything from Tasks 8–16.
- Produces: the complete ITR-mode user flow — refresh, edit rows (with same-for-all across multiple selected layers), preview, run, status display.

This finishes the ITR-mode panel to parity with the current extension's ITR tab, matching `extension/js/main.js`'s `sameForAllChk`/`rebuildExtraLayers` behavior (lines 538–594) and `runItr()` (lines 1039–1062), minus emoji/presets/changelog/auto-update (out of scope for this plan).

- [ ] **Step 1: `ModeTabs` (ITR active, VAR visibly disabled)**

Create `src/js/main/components/ModeTabs.tsx`:

```tsx
export function ModeTabs() {
  return (
    <div id="mode-tabs">
      <button className="tab-btn active">ITR</button>
      <button className="tab-btn" disabled title="VAR mode ships in a later phase">VAR</button>
    </div>
  );
}
```

- [ ] **Step 2: Same-for-all support in the store**

`sameForAll` already exists in the store (Task 8). Wire a checkbox and the "use row 0's value for other color/text layers" behavior. In `LayerInfoPanel.tsx`, add:

```tsx
const sameForAll = useAppStore((s) => s.sameForAll);
const setSameForAll = useAppStore((s) => s.setSameForAll);

// Effective value used for rendering/reading a non-first, non-stroke, non-video row
// when sameForAll is on — mirrors main.js's buildValues() sameForAll branch.
function effectiveValue(row: RowLayer, iter: number): LayerValue | undefined {
  const own = values[row.rowKey]?.[iter];
  if (!sameForAll || row.type === "stroke" || row.type === "video") return own;
  const first = rowLayers[0];
  if (!first || row.layerIndex === first.layerIndex) return own;
  const firstVal = values[first.rowKey]?.[iter];
  if (!firstVal) return own;
  return row.type === "text" ? { color: firstVal.color, font: firstVal.font } : { color: firstVal.color };
}
```

Use `effectiveValue` (not the raw `values` lookup) when building the `previewApply`/`runIterations` payload arrays in Steps 3–4 below. Add the checkbox, shown only when more than one distinct `layerIndex` is present in `rowLayers`:

```tsx
{new Set(rowLayers.map((r) => r.layerIndex)).size > 1 && (
  <label id="same-all-section">
    <input type="checkbox" checked={sameForAll} onChange={(e) => setSameForAll(e.target.checked)} />
    Same value for all layers
  </label>
)}
```

- [ ] **Step 3: Count input**

In `LayerInfoPanel.tsx` (or `App.tsx`, wherever the top-level layout lives):

```tsx
const count = useAppStore((s) => s.count);
const setCount = useAppStore((s) => s.setCount);

<label id="count-label">
  Count
  <input
    type="number"
    min={1}
    value={count}
    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 5))}
  />
</label>
```

- [ ] **Step 4: `RunButton` — build the full `RunConfig` and call `runIterations`**

Finish `src/js/main/components/RunButton.tsx`:

```tsx
import { useState } from "react";
import { useAppStore } from "../state/store";
import { toCfgLayers } from "../state/rowLayers";
import { evalTS } from "../lib/utils/bolt";

export function RunButton({ effectiveValue }: { effectiveValue: (row: any, iter: number) => any }) {
  const { compName, rowLayers, count } = useAppStore((s) => ({ compName: s.compName, rowLayers: s.rowLayers, count: s.count }));
  const [status, setStatus] = useState("");

  const run = () => {
    if (!compName) { setStatus("Refresh a layer first."); return; }
    const layers = toCfgLayers(rowLayers);
    const values = Array.from({ length: count }, (_, iter) => rowLayers.map((r) => effectiveValue(r, iter) ?? {}));
    setStatus("Running…");
    evalTS("runIterations", { compName, layers, values, count })
      .then((res) => setStatus(res.warnings.length ? `Done with warnings: ${res.warnings.join(" | ")}` : `Done — ${count} iterations complete.`))
      .catch((err) => setStatus("Error: " + String(err)));
  };

  return (
    <div id="run-section">
      <button id="btn-run" onClick={run} disabled={!compName}>Run Iterations</button>
      <div id="status">{status}</div>
    </div>
  );
}
```

- [ ] **Step 5: Assemble `App.tsx`**

```tsx
import { ModeTabs } from "./components/ModeTabs";
import { LayerInfoPanel } from "./components/LayerInfoPanel";

function App() {
  return (
    <div>
      <ModeTabs />
      <LayerInfoPanel />
    </div>
  );
}

export default App;
```

(`LayerInfoPanel` renders `RunButton`, passing its local `effectiveValue` function down, plus the count input and same-for-all checkbox from Steps 2–3.)

- [ ] **Step 6: Full manual walkthrough in After Effects**

```bash
npm run build
```

On a real ITR test project:
1. Select a shape layer, a text layer, and a video layer together. Click Refresh.
2. Confirm the "Same value for all layers" checkbox appears (3 distinct layer indices).
3. With it checked, edit only the first (shape) row's colors across 3 iterations — confirm the text layer's preview later uses the same colors, but the video layer's own row values are unaffected by shape edits (per `effectiveValue`'s stroke/video exclusion).
4. Uncheck it, set distinct values per layer per iteration.
5. Set Count to 3. Click **Run Iterations**. Confirm 3 `GD/` folders appear with correct renders, matching Task 16's parity check.
6. Confirm the status line shows "Done — 3 iterations complete." with no warnings.

- [ ] **Step 7: Commit**

```bash
git add ae-iterations-next/src/js/main
git commit -m "feat: complete ITR-mode panel — count, same-for-all, run wiring"
```

---

## Self-Review Notes

- **Spec coverage:** Every item in the design spec's "ITR core" phase (unified engine, ITR strategy, shape/text/stroke/video handlers, `findCompByName`, typed panel↔host calls via `evalTS`, Zustand state) has a task. VAR mode, emoji, presets, changelog, and auto-update are explicitly deferred per the spec's phasing and this plan's Global Constraints — not gaps, intentional scope boundaries.
- **Type consistency checked:** `RunConfig`/`RunResult`/`LayerValue`/`CfgLayer`/`LayerInfo` (Task 6) are the same names and shapes used unmodified through Tasks 8, 9, 11, 16, and 17. `RowLayer`/`buildRowLayers` (Task 8) are consumed as-is by `toCfgLayers` (Task 11) and the same-for-all logic (Task 17). `IterationStrategy`/`TargetState` (Task 16) match exactly between `runIterationBatch.ts` and `itrStrategy.ts`.
- **No placeholders:** every task ships complete, ported (not paraphrased) code, sourced directly from the current `extension/` files named in each task. The one intentional behavior change (the `usedIn` comparison fix in Task 13) is called out explicitly, not left ambiguous.
