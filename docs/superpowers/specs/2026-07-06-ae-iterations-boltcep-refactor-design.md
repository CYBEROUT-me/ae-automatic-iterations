# Design: AE Iterations Rewrite on BoltCEP

**Date:** 2026-07-06
**Status:** Approved

---

## Goal

The extension works but grew organically: `extension/js/main.js` is a single 1,576-line IIFE
handling DOM building, mode switching, font search, emoji picker, presets, changelog, and
auto-update all at once, with row values read back out of the DOM via string-built CSS
selectors. `extension/jsx/host.jsx` (772 lines, assembled by concatenating 10 `lib/*.jsx`
files) has two ~180-line near-duplicate functions (`runIterationsJSON` / `runVarIterationsJSON`)
and repeats a "find comp by name" loop inline 8+ times. `install.sh` and `package.sh` each
hardcode the same file-concatenation list, so adding a lib file means remembering to update
both or dev/prod silently diverge.

This is a ground-up rewrite of the extension, in a new sibling project, that fixes the
structural causes of that duplication rather than reorganizing the same logic into more files.
The current extension (`extension/`) is left untouched and keeps shipping until the rewrite
reaches parity.

## Decisions

These were settled during brainstorming and constrain everything below:

1. **Stack: BoltCEP** (React + TypeScript + Vite, via `vite-cep-plugin`). Trade-off accepted:
   a real build step (Node/npm, `npm run build`/dev watcher) replaces "edit a file, reload
   the panel."
2. **Baseline: last commit (v1.0.11)**, not the uncommitted working tree. The rewrite ports
   the committed feature set only. Uncommitted changes at rewrite start time — modified
   `apply-emoji.jsx` (emoji size param), modified `naming.jsx` (VAR helpers, some not yet
   called anywhere), new untracked `apply-media.jsx`, and an untracked root-level `emodji/`
   folder that duplicates `extension/emojis/` — are explicitly **out of scope**. That work
   continues separately on the current extension; nothing here should try to guess its
   unfinished intent.
3. **Rollout: side-by-side.** The new project ships under a different CEP extension ID
   (e.g. `com.aeiter.iteration.next`) so it appears in After Effects' Window > Extensions
   menu alongside the current one. The current extension keeps being used for real work
   until the new one reaches verified parity; cutover (switch ID / retire the old extension)
   happens as an explicit later step, not part of this spec.
4. **Scope: full feature parity.** Everything in the current extension is in scope: ITR mode
   (shape/text/stroke fill+stroke color, text font, video flip/B&W/tint/hue), emoji overlay,
   VAR mode (named variants, media replacement), preset library (save/apply/delete), changelog
   panel, GitHub-releases auto-update, macOS + Windows install.
5. **Redesign depth: unified engine + handler table** (not a 1:1 structural port, not a
   full pluggable/schema-driven architecture). Concretely:
   - One iteration engine parameterized by a small strategy object, replacing the two
     near-duplicate run functions.
   - One layer-type handler table (shape/text/stroke/video/media), replacing the four
     parallel per-layer-type function families in `main.js`.

## Architecture

### Project layout

New sibling folder at the repo root: **`ae-iterations-next/`**. Standalone BoltCEP project
(own `package.json`/`node_modules`), git-tracked, does not modify anything under `extension/`.

```
ae-iterations-next/
  cep.config.ts          # CEP extension ID, panel size, supported AE host versions
  package.json
  src/
    js/                   # React + TypeScript panel (CEP renderer side)
      main/
        App.tsx
        components/       # ModeTabs, LayerInfoPanel, IterationRow/*, EmojiPicker,
                           # PresetPanel, ChangelogPanel, UpdateBanner
        state/
          store.ts         # Zustand store — see State management
          layerHandlers.ts # per-layer-type handler table — see Core abstractions
        lib/
          hostBridge.ts    # typed evalScript wrapper — see Core abstractions
          presets.ts
          changelog.ts
          autoUpdate.ts
          color.ts         # hexToRgb / rgbToHex / normaliseHex
    jsx/                   # ExtendScript host, written in TS, bundled by BoltCEP's build
      commands/            # thin CEP-exposed entry points (what evalScript calls by name)
      engine/
        runIterationBatch.ts
        strategies/itrStrategy.ts
        strategies/varStrategy.ts
      lib/                 # naming, layer-utils, apply-change, apply-video, apply-media,
                           # apply-emoji, render, collect, project, clean — ported 1:1 in
                           # content, converted to TS modules
    shared/
      types.ts             # message contracts imported by BOTH panel and host (type-only
                           # imports, erased at compile time — safe across the two bundles)
  public/
    presets/library.json
    changelog.json
    emojis/*.gif
```

### Core abstraction 1 — typed host bridge

Replaces the repeated pattern (6 call sites in current `main.js`) of
`cs.evalScript("fn(" + JSON.stringify(JSON.stringify(cfg)) + ")", callback)` plus manual
`JSON.parse` of the result:

```ts
function callHost<TArgs, TResult>(fn: string, args: TArgs): Promise<TResult>
```

Every panel→host call becomes `await callHost<RunConfig, RunResult>('runIterations', cfg)`,
typed against `shared/types.ts` on both ends. A malformed payload is a compile error instead
of a runtime `JSON.parse` failure discovered mid-run.

### Core abstraction 2 — layer-type handler table

Replaces `buildColorRow` / `buildVideoRow` / `buildMediaRow` (+ the dead `buildIterRows`),
`readColorRowValue` / `readVideoRowValue` / `readMediaRowValue`, and the equivalent
sample/preset-apply branches — the same `if (type === 'video') ... else if ('media') ... else`
dispatch repeated across five different functions today.

```ts
type LayerTypeHandler = {
  RowFields: React.FC<RowProps>;              // renders that type's inputs
  readValue(iter: number, layerIdx: number): LayerValue;
  applyPresetToRow(iter: number, preset: Preset): void;
};

const LAYER_HANDLERS: Record<LayerType, LayerTypeHandler> = {
  shape, text, stroke, video, media,
};
```

Row components become data-driven off this table. Adding a future iterable property (e.g.
layer opacity) is one new handler registration, not five edited call sites.

### Core abstraction 3 — unified iteration engine

Replaces `runIterationsJSON` and `runVarIterationsJSON` (~180 lines each, ~70% identical:
apply values → save → render PNG/video → clean → collect → advance to next copy) with one
engine function plus a per-mode strategy:

```ts
interface IterationStrategy {
  nextTarget(current: TargetState, iter: number): { file: File; compName: string };
  perIterationExtra?(comp: CompItem, iter: number): void;   // ITR: emoji overlay
  outputFolderName(iter: number): string;
}

function runIterationBatch(cfg: BatchConfig, strategy: IterationStrategy): BatchResult
```

`ITR_STRATEGY` (increment project ID) and `VAR_STRATEGY` (copy + rename to VAR name + media
replace) become ~30-line objects; the save/render/clean/collect body lives once in the engine.

A shared `findCompByName(name: string): CompItem | null` helper replaces the inline
"loop `app.project.numItems`, compare `.name`" pattern duplicated 8+ times across
`host.jsx`/`clean.jsx`/`naming.jsx` today.

## State management

Current `main.js` state is closure variables (`layerInfo`, `currentMode`, `_activePreviewNum`,
`_emojiGridLoaded`, `_activeEmojiIter`, `_libraryPresets`, `_userPresetsPath`) mutated from
event handlers, with actual row *values* living in the DOM and re-read via string-built
selectors (`.hex-input[data-layer="0"][data-row="2"]`) whenever needed.

Replaced with a Zustand store:

```ts
interface AppState {
  layerInfo: LayerInfo | null;
  mode: 'itr' | 'var';
  count: number;
  rows: LayerValue[][];   // [layerIdx][iter]
  sameForAll: boolean;
  emoji: EmojiConfig;
}
```

React components read/write the store directly; row values are state, not DOM contents. This
removes the `buildValues()`/`readRowValue()` family entirely (read the store instead) and
makes "preserve emoji assignments across a count change" — currently ~15 lines of manual
save/restore around `_buildEmojiIterRows()` — a non-issue, since it's just state that survives
a re-render.

Presets, changelog, and auto-update port as plain TS modules called from React
effects/handlers, same logic as today (GitHub releases API, zip download, copy into the CEP
extensions folder) — just no longer interleaved with row-building code in one file.

## Build & release

`npm run build` (BoltCEP / `vite-cep-plugin`) replaces the manual `cat`-based host.jsx
assembly duplicated in `install.sh` and `package.sh` — the TS import graph is the one source
of truth for what's bundled into the host script.

A `package.sh`-equivalent script for this project: bump version → `npm run build` → zip →
git commit/tag → push → create GitHub release. The existing auto-update mechanism (check
GitHub releases API, download the zip, copy into the CEP extensions folder) is ported
unchanged — it only depends on the release zip's shape, not on how it was built.

## Migration phasing

Executed as ordered phases within this one project (not separate specs):

1. **Scaffold** — BoltCEP project init, typed bridge, shared types, `findCompByName` +
   naming/project utilities ported.
2. **ITR core** — unified engine + `ITR_STRATEGY`, shape/text/stroke/video handlers. ITR
   mode (color, font, video effects) works end-to-end, verified output-for-output against
   the current extension on a real project.
3. **VAR mode** — `VAR_STRATEGY` + media-replacement handler, reusing the same engine.
4. **Remaining features** — emoji overlay, preset library, changelog panel, auto-updater.
5. **Parity pass + cutover** — side-by-side comparison on real projects; then retire the
   old extension (folder removal / CEP ID switch is a decision made at that time, not now).

## Out of scope

- Finishing the uncommitted emoji-size / VAR-naming-helper / media-apply work — continues
  separately on the current extension.
- Resolving the duplicate `emodji/` vs `extension/emojis/` asset folders — a cleanup on the
  current extension, unrelated to this rewrite.
- Deciding the final cutover mechanics (CEP ID swap, old-folder retirement/archival) — revisit
  once Phase 5 is reached.
- Any behavior changes beyond what's needed to unify ITR/VAR internally — this is a structural
  rewrite, not a feature redesign.

## Risks

- **ExtendScript can't run TypeScript directly** — BoltCEP's host bundler compiles/transpiles
  host-side TS down to the ES3-compatible JS ExtendScript's engine expects. This is a solved
  problem in BoltCEP itself, but the first scaffold phase should verify it against this
  project's actual ExtendScript API usage (e.g. `TextDocument`, `Effects` property access)
  before Phase 2 depends on it.
- **Output parity is the correctness bar.** Because this is a structural rewrite of logic
  that already works, each phase's exit criteria should be "produces the same renders/collected
  output as the current extension on the same test project," not just "runs without error."
