# Design: Presets for the BoltCEP Rewrite

**Date:** 2026-07-14
**Status:** Approved

---

## Goal

Add color/video presets to `ae-iterations-next`'s ITR mode — a built-in library plus
user-saved presets, applying a sequence of per-iteration values to row 0 with one click.
Matches the original `extension/`'s feature. Auto-update remains out of scope for this phase.

## Scope

Presets are **ITR-mode only** — hidden entirely in VAR mode, matching the emoji overlay's
precedent (the original hides `preset-section` when `mode === "var"`). Presets **apply to row 0
only** (`rowLayers[0]`), regardless of how many rows are selected — a faithful port of the
original's `data-layer="0"`-hardcoded behavior, not extended to multi-row application (that
would be a genuine new feature with its own edge cases — mixed-type selections, VAR's media
rows — deliberately deferred, not attempted here).

A preset is one of two kinds, split by row 0's type:

```ts
export interface ColorPreset {
  name: string;
  colors: string[]; // hex, one per iteration
}

export interface VideoPreset {
  name: string;
  type: "video";
  iterations: { flip: boolean; bw: boolean; tint: string | null; hue: number }[];
}

export type Preset = ColorPreset | VideoPreset;
```

(Color presets have no `type` field at all — matching the original's `library.json`, where
color entries simply omit `type` and video entries set `"type": "video"`.) Applying clamps to
`Math.min(count, preset.length)` — if the preset has fewer entries than the current iteration
count, only that many iterations are set; the rest are left untouched (matches the original
exactly).

## Decisions

Settled during brainstorming:

1. **Row 0 only**, not multi-row. See Scope above.
2. **Built-in library ported as-is** — the original's 16 presets (12 color palettes, 4 video
   looks) are generic, reusable content with nothing tying them to the old codebase.
3. **Cross-platform user-preset storage, not a macOS-only port.** The original hardcodes
   `~/Library/Application Support/AE Iterations/user-presets.json` — a macOS-only path
   convention. Matching the font-picker phase's precedent (build correctly for both platforms,
   don't silently stay macOS-only), this rewrite uses the correct convention per platform.

## Architecture

**Built-in library — `ae-iterations-next/src/js/main/presets-library.json`:** bundled as a
direct JS import (`import library from "../presets-library.json"`), exactly like the changelog
panel's `changelog.json`. Static content, no runtime file read needed — the same simplification
already validated in that phase. Content: the original's 16 presets, ported verbatim.

**User presets — `ae-iterations-next/src/js/main/lib/userPresets.ts`:**

```ts
export function userPresetsPath(): string | null;
export function loadUserPresets(): Preset[];
export function saveUserPresets(presets: Preset[]): void;
```

Genuinely dynamic, user-writable data — unlike the built-in library, this needs real runtime
file I/O via Node's `fs`/`os`/`path` (already proven to work in this panel: the font picker's
`vite.config.ts` externalization already makes these builtins available with no new
build-config risk). `userPresetsPath()` resolves:
- macOS: `path.join(os.homedir(), "Library", "Application Support", "AE Iterations", "user-presets.json")`
- Windows: `path.join(process.env.APPDATA || os.homedir(), "AE Iterations", "user-presets.json")`

Both live outside the extension's own installed folder, so user presets survive extension
updates — matching the original's stated intent. The containing directory is created
(`fs.mkdirSync(..., { recursive: true })`) if missing, matching the original's behavior.
`loadUserPresets()` returns `[]` on any error (file missing, unreadable, malformed JSON) — the
original's exact graceful-degradation behavior. `saveUserPresets()` writes pretty-printed JSON
(`JSON.stringify(presets, null, 2)`), matching the original.

**Apply/save translation to this codebase's store**, replacing the original's direct-DOM-write
(the original has no separate state model — the DOM *is* the state; this rewrite's Zustand
store is the single source of truth, so "applying" means writing into it, not touching any DOM
node directly):

- **Apply a color preset**: for `i` in `0..min(count, colors.length)`, call
  `setValue(rowLayers[0].rowKey, i, { ...existingValue, color: hexToRgb(colors[i]) })`.
- **Apply a video preset**: for `i` in `0..min(count, iterations.length)`, call
  `setValue(rowLayers[0].rowKey, i, { flip, bw, tint: tint ? hexToRgb(tint) : null, tintAmount: 50, hue })`.
  `tintAmount` isn't part of a saved preset (matching the original, which never persists it —
  see below) — applying always defaults it to `50`, the original's exact fallback.
- **Save the current state as a preset** (row 0 only): for a color-capable row 0, read
  `values[rowKey][i]?.color` for each iteration (falling back to the same default hex
  `ColorFields.tsx` already uses when a value is unset, `#FF0000`) and convert to hex. For a
  video row 0, read `{flip, bw, tint, hue}` per iteration (converting `tint`'s RGB back to hex,
  or `null`) — deliberately NOT including `tintAmount`, matching the original's
  `getCurrentPreset()`, which never saves it either.

## UI

**`PresetPanel.tsx`** — same shape as `ChangelogButton`: a toggle button + collapsible list,
rendered only when `mode === "itr"`. When open:
- **"Saved"** group — user presets, each with a small swatch-row preview, an Apply button, and
  a delete "×" (removes from `loadUserPresets()`'s array, re-saves, re-renders).
- **"Library"** group — built-in presets, same preview + Apply, no delete.
- A name input + "Save Preset" button at the top: snapshots row 0's current values (per Apply
  translation above), prepends to the user list, persists, clears the input.

Only presets matching row 0's current kind (color vs. video) are shown, matching the original's
`isVideoMode()`-based filtering.

## Testing

- **`userPresets.ts` gets real unit tests** — pure Node filesystem logic with zero AE
  dependency, mocking `fs`/`os`/`process.env`, following the exact pattern `fonts.test.ts`
  already established in this codebase (platform-parameterized where relevant, error paths
  returning `[]` rather than throwing).
- **`PresetPanel.tsx` gets Vitest + React Testing Library tests**, mocking `userPresets.ts`
  (same pattern as mocking `evalTS`/`loadFonts` elsewhere): apply, save, delete, and the
  color-vs-video filtering.

## Out of Scope

- Multi-row preset application (Decision 1) — row 0 only, for now.
- Auto-update, release tooling — later/separate concerns.
- Any change to the current production `extension/` — this phase applies only to
  `ae-iterations-next`.

## Risks

- **No subagent can verify the real cross-platform file paths on an actual macOS or Windows
  machine** — automated tests mock `fs`/`os`, so, matching the font-picker phase's precedent,
  a human needs to confirm user presets actually persist to the right directory and survive a
  panel reload on both platforms.
