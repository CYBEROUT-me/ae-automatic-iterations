# Design: VAR Mode for the BoltCEP Rewrite

**Date:** 2026-07-06
**Status:** Approved

---

## Goal

Add VAR mode (named variants with per-layer media replacement) to `ae-iterations-next`, the BoltCEP rewrite built in the prior phase (Scaffold + ITR core, see
`docs/superpowers/specs/2026-07-06-ae-iterations-boltcep-refactor-design.md` and
`docs/superpowers/plans/2026-07-06-ae-iterations-boltcep-scaffold-itr-core.md`). This is
Phase 3 of that spec's migration phasing. Emoji overlay, presets, changelog, and
auto-update remain out of scope for this phase.

## A note on the source material

While researching VAR mode's real behavior, `stripAspectSuffix` and the `ASPECT_SUFFIXES`
constant — which the **committed** `extension/jsx/host.jsx`'s `runVarIterationsJSON` calls
throughout — were found to have **never existed in this repo's git history**, on any branch,
at any commit. The committed VAR-mode code would throw a `ReferenceError` if run as-is; it
only works on the original developer's machine because of the same uncommitted `naming.jsx`
changes this whole rewrite has already agreed to treat as out-of-scope WIP (see the prior
spec's Global Constraints). This doesn't change what VAR mode needs to do — every call site
in the committed code fully specifies the contract (strip a trailing `_9x16`/`_1x1`/`_16x9`
suffix to get a base name) — it just means this phase writes fresh, small implementations of
those two pieces rather than porting an existing committed file, the same way prior tasks
wrote `findCompByName` fresh instead of porting duplicated inline loops.

## Decisions

Settled during brainstorming:

1. **Aspect ratios: four, matching ITR.** VAR renders `9x16`, `1x1`, `16x9`, and the newly
   added `4x5` (ITR mode gained `ITR_4x5` immediately before this phase started). VAR's own
   suffix list (`VAR_ASPECT_SUFFIXES`) has no `ITR_` prefix, matching the original convention.
2. **Scope: Run only, no Preview.** ITR's per-iteration live-preview is not part of this
   phase — VAR's target-comp resolution (renamed-render-comp vs. untouched-nested-precomp) is
   involved enough that Preview is better done as a fast follow-up once Run is proven working,
   not bundled in now.
3. **Include the "Test" diagnostic.** A read-only scan (mirroring the original's
   `testVarRenderCompsJSON`) that reports which of the 4 aspect-suffixed comps it can find for
   the current project, without opening, modifying, or rendering anything. Directly motivated
   by the ITR bug this session already hit — a silent naming mismatch that only surfaced after
   a full run. A "Test" button lets a user catch that before committing to a real batch.
4. **Architecture: a separate `runVarIterationBatch` orchestration function**, not a forced
   fit into the existing `IterationStrategy`/`runIterationBatch` used by ITR. VAR's real
   phase order differs from ITR's in ways that aren't just "a different next-file rule":
   - **ITR:** apply values → save/close/reopen → render PNG+video → clean → collect → copy
     &amp; rename for the next iteration (a *chain*: iteration N+1 derives from iteration N).
   - **VAR:** copy fresh from one shared temp copy of the *original* project → rename that
     copy's render comps → import media → apply values → render **video** (while media is
     still in-memory, before saving) → save/close/reopen → clean → render **PNG** (only works
     after reopen, since `saveFrameToPng` fails on in-memory `replaceSource` footage) →
     collect. Every iteration *branches* from the same origin, it doesn't chain.

   Forcing this into one shared loop via extra hooks (`beforeApply`, `renderTiming`, etc.)
   would turn `runIterationBatch` into a pile of mode-conditionals to serve two genuinely
   different processes — the exact kind of complexity the unified-engine design was meant to
   remove, and a plausible source of another Task-16-style ordering bug. A separate function
   sharing the same underlying lib building blocks (`applyLayerValue`, `renderPNGs`/
   `renderVideos`, `cleanProject`, `performCollect`) gets the real DRY win (no duplicated
   comp-lookup loops or folder-creation boilerplate) without distorting either function's
   control flow to accommodate the other.

## Architecture

### Types (`shared/types.ts`)

```ts
export type LayerType = "shape" | "text" | "stroke" | "video" | "media" | "unknown";

// LayerValue gains:
mediaPath?: string | null;

export interface RunVarConfig {
  compName: string;
  layers: CfgLayer[];
  values: LayerValue[][];
  varNames: string[];
  count: number;
}

export interface TestVarCompsResult {
  log: string[];
}
```

`"media"` is not a new thing detected from the AE object model — `getLayerType` still reports
a footage/video layer as `"video"`, exactly as today. The relabeling to `"media"` happens only
on the panel side, only under VAR mode: `buildRowLayers(layers, mode)` gains a `mode`
parameter, and a `"video"`-type layer becomes a `"media"`-type `RowLayer` when `mode === "var"`.
This is the same thing the original extension does (`if (li.type === "video" && currentMode
=== "var") layerType = "media"`), just made explicit as a parameter instead of a closure-read
global. `LAYER_HANDLERS["media"]` then picks up automatically — no change to the dispatch
mechanism itself.

### Host-side (`src/jsx/aeft/`)

- **`lib/naming.ts`** — add `stripAspectSuffix(name: string): string` (strips a trailing
  `_9x16`/`_1x1`/`_16x9`/`_4x5` if present, otherwise returns the name unchanged) and
  `VAR_ASPECT_SUFFIXES = ["9x16", "1x1", "16x9", "4x5"]`. Pure, unit-testable exactly like
  `incrementProjectId`.
- **`lib/render.ts`** — generalize `renderPNGs`/`renderVideos` to take a `suffixes: string[]`
  parameter instead of hardcoding `ITR_SUFFIXES` internally. The ITR call site in
  `runIterationBatch.ts` passes `ITR_SUFFIXES` explicitly; VAR passes `VAR_ASPECT_SUFFIXES`.
  This means VAR needs **zero** new render code — a simplification versus the original, whose
  `renderVarPNGs` was largely dead code (confirmed during Task 12's review) and whose
  `renderVarVideos` was near-identical to `renderVideos` apart from the suffix list.
- **`lib/applyMedia.ts`** (new) — `applyMediaLayer(layer: AVLayer, footage: FootageItem):
  boolean`. `replaceSource(footage, false)` plus the scale-to-fill expression, matching the
  committed `runVarIterationsJSON`'s inline logic exactly (not the uncommitted
  `apply-media.jsx`, which this plan continues to treat as out of scope per the prior spec).
- **`engine/runVarIterationBatch.ts`** (new) — `runVarIterationBatch(cfg: RunVarConfig):
  RunResult`. Per-iteration order as described in Decision 4 above. Reuses `applyLayerValue`
  for every non-media layer type, `applyMediaLayer` for media, `renderPNGs`/`renderVideos`
  (with `VAR_ASPECT_SUFFIXES`), `cleanProject` (protecting the renamed comps), and
  `performCollect` — the same primitives ITR's engine uses.
- **`aeft.ts`** — add `runVarIterations(cfg: RunVarConfig): RunResult` (thin wrapper calling
  `runVarIterationBatch`), `testVarRenderComps(): TestVarCompsResult` (read-only diagnostic),
  and `browseForMedia(): { path: string | null }` (wraps `File.openDialog`, needed by the
  panel's media-browse button).

### Panel-side (`src/js/main/`)

- **`components/MediaFields.tsx`** (new) — registered as `LAYER_HANDLERS["media"]`. A
  "Browse…" button calling the new `browseForMedia` host command, plus a filename label,
  writing `{ mediaPath }` into the row's stored value. Same read/write pattern as
  `ColorFields`/`VideoFields`.
- **`components/ModeTabs.tsx`** — the VAR tab becomes a real, clickable tab wired to the
  store's new `setMode`, replacing its current permanently-disabled state.
- **`components/VarNamesRow.tsx`** (new) — one text input per iteration (`count`-driven,
  same shape as the existing Preview-button row), writing into the store's new
  `varNames: string[]`. Shown only when `mode === "var"`.
- **`components/RunButton.tsx`** — becomes mode-aware rather than duplicated: branches on
  `store.mode` to build either `RunConfig`/call `runIterations` (existing, unchanged) or
  `RunVarConfig`/call `runVarIterations` (new), using a small `toVarCfgLayers` helper that
  relabels `"video"` rows to `"media"` in the config sent to the host. One shared
  status/warnings display serves both modes.
- **New "Test" button**, shown only in VAR mode, calling `testVarRenderComps` and rendering
  its log via the same `<pre>`-dump pattern already used for preview/debug output.
- **`state/store.ts`** — add `mode: "itr" | "var"` and `varNames: string[]` plus their
  setters. `setMode` and `setLayerInfo` both recompute `rowLayers` via
  `buildRowLayers(layerInfo, mode)`, so switching modes after a Refresh re-labels existing
  rows without requiring another Refresh.

## Out of scope

- VAR-mode per-iteration Preview (Decision 2) — a follow-up once Run is proven.
- Emoji overlay, presets, changelog, auto-update — later phases per the original spec.
- Porting the uncommitted `apply-media.jsx`/`apply-emoji.jsx`/`naming.jsx` WIP — still
  out of scope per the original spec's Global Constraints.
- Any change to the current production `extension/` — VAR's 4x5 addition and this whole
  phase apply only to `ae-iterations-next`, per this session's explicit scoping decision.

## Risks

- **`stripAspectSuffix`/comp-renaming correctness has no committed reference implementation
  to diff against** (per the note above) — this phase's version must be verified by careful
  reading of every call site in the committed `host.jsx`, not by comparing against a
  "known-good" source file the way every prior port in this project could. Flag any ambiguity
  found during implementation rather than guessing.
- **No subagent in this pipeline has GUI access to After Effects** (unchanged from the prior
  phase) — VAR's live-AE verification (media replacement actually working, comps renaming
  correctly, the full batch producing correct output) remains a manual step for a human tester,
  exactly like ITR mode's parity recipe. This phase's implementation plan should include an
  equivalent recipe.
