# Design: Emoji Overlay for the BoltCEP Rewrite

**Date:** 2026-07-07
**Status:** Approved

---

## Goal

Add emoji overlay to `ae-iterations-next`, the BoltCEP rewrite built in the prior two phases
(Scaffold + ITR core, see
`docs/superpowers/specs/2026-07-06-ae-iterations-boltcep-refactor-design.md`; VAR mode, see
`docs/superpowers/specs/2026-07-06-ae-iterations-var-mode-design.md`). This is the next
phase of that spec's migration phasing. Presets, changelog, and auto-update remain out of
scope for this phase.

## Scope

Emoji overlay is **ITR-mode only**, matching the original `extension/`'s behavior exactly —
VAR mode has no emoji config in the original and gets none here either. VAR mode's
per-variant branching architecture (fresh copy each iteration, video-before-save/
PNG-after-reopen ordering) would need real new design work to host emoji cleanly; that is
explicitly deferred, not a quick add.

## Decisions

Settled during brainstorming:

1. **ITR-only**, not VAR. See Scope above.
2. **"Emoji-only run" capability is preserved.** The original lets a user run a full batch
   with zero layer-value changes — never selecting a layer or clicking Refresh — where only
   the emoji varies per iteration. The rewrite keeps this: `RunButton`'s current
   `if (!compName) { "Refresh a layer first."; return; }` gate becomes
   `if (!compName && !(mode === "itr" && emojiEnabled)) { ...; return; }`.
3. **Position, size, and layer-index are shared across all iterations** — only the emoji
   *file* varies per iteration (via a picker row per iteration). Matches the original exactly;
   no per-iteration position/size.
4. **Picker UX: a visual thumbnail grid**, matching the original, not a native
   "Browse..." file dialog. The bundled emoji set (~140 files) is curated and benefits from
   visual discovery; a blind OS file-browse dialog wouldn't show previews or default to the
   right folder.

## Data Flow

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

Added as an optional field on `RunConfig`: `emoji?: EmojiConfig`.

**Run-loop sequencing per iteration** (matching the original's `runIterationsJSON` structure):

1. If a target comp and layers exist: `removeEmojiFromComp(targetComp)` (clear any leftover
   manual-preview emoji before trusting layer indices) → apply layer values via
   `resolveLayer` + `applyLayerValue`.
2. Independently, if `cfg.emoji?.enabled`: import the emoji file **once** for this iteration,
   then for each of the 4 `ITR_SUFFIXES` render comps: `removeEmojiFromComp(renderComp)`
   (clear the *previous* iteration's emoji, since render comps get copied forward) →
   `addEmojiToComp(renderComp, footage, x, y, layerIndex, size)`.
3. Save → close → reopen.
4. Render PNG + video (re-resolving the 4 render comps by name after reopen, per existing
   pattern).
5. Clean, protecting the 4 render-comp names **and** the emoji footage's name (captured
   *before* close, since close/reopen invalidates the `FootageItem` reference).
6. Collect. Advance to next iteration.

The emoji step is structurally independent of (parallel to, not nested inside) the
layer-value-application step — it must run even when there's no target comp/layers
(emoji-only mode), and it targets all 4 render comps, not the single layer-value target comp.
`IterationStrategy`'s existing `perIterationExtra?(comp, iter)` hook is the wrong shape for
this (single-comp, gated behind layer-application) and is not used here; the emoji step is
added as its own top-level block in `runIterationBatch`, mirroring the original's structure.

## Host-side Architecture (`src/jsx/aeft/`)

- **`lib/applyEmoji.ts`** (new) — ported from `extension/jsx/lib/apply-emoji.jsx`:
  ```ts
  export const EMOJI_LAYER_NAME = "AEITER_EMOJI";
  export function removeEmojiFromComp(comp: CompItem): void;
  export function addEmojiToComp(
    comp: CompItem, footage: FootageItem,
    x: number, y: number, targetIndex: number, size: number
  ): void;
  ```
  Deliberate deviation from the original: `addEmojiToComp` takes an already-imported
  `FootageItem`, not a raw file path — the run loop imports the file once per iteration and
  shares that single `FootageItem` across all 4 render comps (matching the original's
  import-once-per-iteration behavior), so import belongs in the orchestration function, not
  this lib function. Mirrors how `applyMediaLayer` (VAR mode) is already split from its
  caller's import step.
- **`lib/findComp.ts`** gains `resolveLayer(comp: CompItem, lc: CfgLayer): Layer | null` —
  reintroducing the original's `resolveLayer` name-fallback (flagged as a known gap in
  `runIterationBatch.ts`'s comments since the ITR-core phase). Both `runIterationBatch.ts`
  and `previewApply` (in `aeft.ts`) switch their plain `comp.layer(lc.index)` lookups to
  `resolveLayer(comp, lc)`. `CfgLayer` already carries `.name`; no type changes needed there.
- **`aeft.ts`** gains:
  - `previewEmoji(cfg: { emojiPath: string; x: number; y: number; size: number; layerIndex: number }): { compName: string }`
    — direct port of `previewEmojiJSON`: inserts a temporary, undo-groupable emoji layer into
    the active comp (falling back to any found ITR render comp if nothing's active) so the
    user can check placement. Throws `Error` on failure, per this codebase's host-command
    convention.
  - `listEmojiFiles(): { files: { path: string; name: string }[] }` — scans the extension's
    bundled `emojis/` folder (via `Folder`/`getFiles()`, ExtendScript-side — matching the
    established pattern that filesystem-touching operations go through host commands
    (`browseForMedia`), not panel-side Node `require`) and returns image files, sorted.
    **Asset bundling:** `extension/emojis/` is 558MB across 166 files — copying it into a new
    `ae-iterations-next/emojis/` folder would duplicate that into git history for no reason,
    and a committed symlink is unreliable on Windows (this project explicitly supports it —
    see `install.ps1`). Instead, `vite.config.ts`'s `publicDir` is pointed directly at the
    existing folder: `path.resolve(__dirname, "../extension/emojis")` (absolute, so it's
    independent of Vite's `root` being `src/js`, not the project root). Vite copies it
    verbatim into `dist/cep/emojis/` at build time from that single source of truth — no
    duplication, no symlink.
    `listEmojiFiles` locates this folder at runtime via `new File($.fileName).parent.parent`
    (walking up from the running jsx bundle's own install location, e.g.
    `.../com.aeiter.iteration.next/jsx/index.js` → extension root) `.fsName + "/emojis"` —
    there is no ExtendScript equivalent of the panel-side `cs.getSystemPath(SystemPath.EXTENSION)`,
    so this self-locating walk-up is the mechanism. This is the one piece of this plan with no
    exact prior-art call site to verify against; flag any doubt found during implementation
    rather than guessing.
- **`lib/clean.ts` needs no changes** — `cleanProject(protectedNames?: string[])` already
  accepts an arbitrary protected-names array; the emoji footage's name is simply added to the
  same array the render-comp names already go into.
- **`engine/runIterationBatch.ts`** gains the emoji block described in Data Flow above, plus
  the `resolveLayer` swap in its existing layer-apply loop.

## Panel-side Architecture (`src/js/main/`)

- **`state/store.ts`** gains flat fields (matching the `varNames` convention, not a nested
  object):
  ```ts
  emojiEnabled: boolean;
  emojiPaths: (string | null)[];   // count-length, index = iteration
  emojiX: number;
  emojiY: number;
  emojiSize: number;
  emojiLayerIndex: number;
  ```
  with setters `setEmojiEnabled`, `setEmojiPath(iter, path)`, `setEmojiX/Y/Size/LayerIndex`.
  Defaults matching the original: `x: 540, y: 1347, size: 100, layerIndex: 1`.
- **`components/EmojiSection.tsx`** (new) — the enabled checkbox + (when checked) shared
  x/y/size/layer-index number inputs, one picker row per iteration (thumbnail + filename or
  "No emoji" placeholder, click opens/closes the shared grid), and a "Preview Emoji" button.
  Rendered in `LayerInfoPanel.tsx` only when `mode === "itr"` — hidden entirely in VAR mode,
  matching the original's `emojiSection.classList.toggle("hidden", mode !== "itr")`.
- **`components/EmojiPickerGrid.tsx`** (new) — the shared thumbnail grid, populated via
  `evalTS("listEmojiFiles")`. Opens inline below whichever row was clicked (DOM-reflow, not a
  modal — matching the original's behavior of inserting the grid element after the clicked
  row), closes on selection or on clicking the same row again.
- **"Preview Emoji" button** calls `evalTS("previewEmoji", {...})` using the **first row with
  a path set** (scanning all iterations in order) plus the shared x/y/size/layerIndex —
  matching the original's `btn-emoji-preview` behavior exactly. Independent of ITR mode's
  existing per-iteration "Preview N" mechanism for layer values.
- **`RunButton.tsx`** gating change: `if (!compName && !(mode === "itr" && emojiEnabled))`
  instead of `if (!compName)`. When `compName` is empty, `RunConfig.layers`/`values` are sent
  as `[]`/`count` empty objects.

## Testing

- Host-side (`applyEmoji.ts`, `resolveLayer`, the `runIterationBatch.ts` emoji block,
  `previewEmoji`, `listEmojiFiles`) — no automated tests, consistent with this codebase's
  established precedent for AE-object-model code (`applyChange.ts`, `applyVideo.ts`,
  `applyMedia.ts` all shipped without tests).
- Panel-side (`EmojiSection`, `EmojiPickerGrid`, new store setters) — Vitest + RTL component
  tests mocking `evalTS`, matching `MediaFields.test.tsx`/`VarNamesRow.test.tsx`.

## Edge Cases

- The imported emoji `FootageItem` is shared across all 4 render comps within one
  iteration (imported once, not once per comp), and its `.name` is captured into a variable
  *before* save→close, since the reference itself is invalidated by close/reopen — the same
  pattern VAR mode already had to apply to render-comp references.
- If a given iteration's `perIteration[iter]` is empty/null, that iteration gets no emoji —
  skipped silently, not a warning (matches the original's `if (emojiPath)` check).
- `removeEmojiFromComp` runs on the layer-value target comp *before* `resolveLayer` trusts
  any index (clearing a leftover manual-preview emoji so indices are correct). This is the
  primary defense; `resolveLayer`'s name-fallback is the backstop for cases this misses.
- `removeEmojiFromComp` also runs on each of the 4 render comps immediately before
  `addEmojiToComp`, clearing the *previous iteration's* emoji layer (render comps are copied
  forward each iteration, so without this every copy would inherit the last emoji).

## Out of Scope

- VAR-mode emoji support (Decision 1) — real new design work, not attempted here.
- Per-iteration position/size/layer-index (Decision 3) — shared config only.
- Presets, changelog, auto-update — later phases per the original spec.
- Any change to the current production `extension/` — this phase applies only to
  `ae-iterations-next`, per this session's established scoping pattern.

## Risks

- **No subagent in this pipeline has GUI access to After Effects** (unchanged from prior
  phases) — this phase's live-AE verification (emoji actually appearing correctly across all
  4 render comps, indices not corrupted after a manual Preview Emoji click, emoji-only runs
  producing correct output) remains a manual step for a human tester. This phase's
  implementation plan should include an equivalent recipe, matching ITR core and VAR mode's
  precedent.
- **`resolveLayer` reintroduction touches two existing call sites** (`runIterationBatch.ts`
  and `previewApply` in `aeft.ts`) that have shipped and been reviewed clean already — care is
  needed to confirm the swap doesn't change behavior when no emoji preview is active (i.e.
  `resolveLayer` must degrade to the exact same plain index lookup when there's no name
  mismatch, so ITR runs without emoji are byte-for-byte unaffected).
