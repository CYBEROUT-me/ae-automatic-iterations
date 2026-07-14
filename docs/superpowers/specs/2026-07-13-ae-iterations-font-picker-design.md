# Design: Cross-Platform Font Picker for the BoltCEP Rewrite

**Date:** 2026-07-13
**Status:** Approved

---

## Goal

Add font autocomplete to `ae-iterations-next`'s text-layer font input — replacing the plain
"type the exact PostScript name" text field with a live-filtered dropdown of real, installed
system fonts, on **both macOS and Windows**. This is the "font picker UX" gap identified when
comparing the rewrite against the original `extension/`'s font-search feature. Presets,
changelog, and auto-update remain out of scope for this phase.

## Scope

Applies wherever `ColorFields.tsx` renders a font input for a `"text"`-type row — shared by
**both ITR and VAR mode** already (no mode-gating needed, unlike the emoji-overlay or
media-replacement features, which are mode-specific). No change to shape/stroke/video/media
row handling.

The original extension's font search is **macOS-only** (`system_profiler SPFontsDataType
-json`, a Node `child_process` call run from the panel — an OS-level concern with no
ExtendScript/AE-object-model equivalent, not a port-target for `aeft.ts`). Since this project
explicitly supports Windows (see `install.ps1`), this phase builds a genuinely cross-platform
mechanism rather than porting the macOS-only shortcut and leaving Windows degraded.

## Decisions

Settled during brainstorming:

1. **Cross-platform font-file parsing, not OS-specific shortcuts.** Windows has no single
   command equivalent to `system_profiler`; the closest alternatives (registry lookup,
   PowerShell's `InstalledFontCollection`) only surface *display* names ("Arial Bold"), not the
   *PostScript* names AE's `TextDocument.font` actually needs (`Arial-BoldMT`). Instead: scan
   OS-standard font directories for `.ttf`/`.otf`/`.ttc` files and parse each one's `name` table
   directly (via a new npm dependency, `fontkit`) to read the real PostScript name (nameID 6) —
   the exact same name AE itself resolves at render time. One mechanism, both platforms,
   correct names either way.
2. **Per-row inline dropdown, not the original's shared floating search box.** The original
   has one global search input that every font text-field "borrows" via a focus-redirect. Every
   component in this rewrite (`ColorFields`, `MediaFields`, `EmojiPickerGrid`, etc.) is
   otherwise fully self-contained with no cross-row/global UI coordination — a shared-widget
   focus-redirect pattern doesn't fit. Each font input gets its own dropdown instead.
3. **Panel-side (Node), not host-side (`aeft.ts`/ExtendScript).** Every other OS-touching
   feature added to this rewrite so far (`browseForMedia`, `listEmojiFiles`) went through
   `aeft.ts` host commands — but those either wrap a real ExtendScript API (`File.openDialog`)
   or need to self-locate relative to the installed extension bundle. Font scanning is neither:
   it's a plain OS/filesystem concern with no ExtendScript equivalent, so — matching the
   original's own architecture — it belongs in the panel's Node context (which already has
   full Node integration, same as the original's `require("fs")`/`require("child_process")`
   usage), not behind `evalTS`.

## Architecture

**New module `src/js/main/lib/fonts.ts`:**

```ts
export async function loadFonts(): Promise<string[]>
```

- Scans standard font directories:
  - macOS: `/System/Library/Fonts`, `/Library/Fonts`, `~/Library/Fonts`
  - Windows: `%WINDIR%\Fonts`, `%LOCALAPPDATA%\Microsoft\Windows\Fonts`
- For each `.ttf`/`.otf`/`.ttc` file found, parses it with `fontkit` and extracts the
  PostScript name from the font's `name` table (nameID 6). `.ttc` (TrueType Collection) files
  bundle multiple fonts in one file — `fontkit` exposes a collection API (`.fonts[]`) for these;
  each sub-font is extracted the same way.
- Any single file that fails to parse is skipped, not fatal — matches this codebase's
  established per-item error-handling convention (e.g. `cleanProject`'s per-item try/catch).
  Only a total failure to scan any directory falls back to an empty list, in which case the
  font input behaves exactly as it does today (plain text, no dropdown) — the same graceful
  degradation the original has on non-macOS platforms.
- Results are deduplicated (the same font can be installed both system-wide and per-user),
  sorted, and cached at module scope after the first successful load — every `FontInput`
  instance shares one cached list, no re-scanning per component instance.
- Called once, eagerly, when the panel mounts (matching the original's one-time startup
  `loadFonts()` call).

**New component `src/js/main/components/FontInput.tsx`:**

```tsx
export function FontInput({ value, onChange }: { value: string; onChange: (v: string) => void })
```

- A controlled text input — the store owns the value (matching `ColorFields`'s existing
  pattern), this component only renders/edits it.
- On focus or on typing, filters the cached list (case-insensitive substring match, capped at
  30 results — matching the original) and renders a dropdown below the input. Shows "Loading
  fonts…" if `loadFonts()` hasn't resolved yet, "No fonts found" if the scan returned nothing
  (e.g. total scan failure, or platform totally unsupported).
- Dropdown items use `onMouseDown` + `preventDefault` (not `onClick`) so a selection fires
  *before* the input's `onBlur` closes the dropdown — the original's exact trick for avoiding a
  blur-then-click ordering race.
- Selecting an item calls `onChange(postscriptName)` and closes the dropdown. Blurring without
  a selection also closes it.

**`ColorFields.tsx` change:** its existing text-row branch has a raw
`<input placeholder="PostScript name" value={value?.font ?? ""} onChange={...} />` — this gets
replaced with `<FontInput value={value?.font ?? ""} onChange={(font) => setValue(row.rowKey, iter, { ...value, font })} />`.
No other field in `ColorFields` (color, content) changes.

## Testing

- **`fonts.ts` gets real unit tests** — unlike AE-object-model host code, this is pure Node
  filesystem + parsing logic with zero AE dependency, so it's genuinely unit-testable: mock
  `fs`/`fontkit`, verify directory scanning, dedup, sort, and that one file failing to parse
  doesn't abort the whole scan.
- **`FontInput.tsx` gets Vitest + React Testing Library tests** — mocking the `fonts.ts` module
  (same pattern as mocking `evalTS` elsewhere in this codebase's component tests): dropdown
  filtering, selection via mousedown, loading state, no-results state.

## Out of Scope

- Presets, changelog, auto-update — later phases per the original spec.
- Any change to the current production `extension/` — this phase applies only to
  `ae-iterations-next`, per this session's established scoping pattern.
- Per-platform UI differences beyond the font-scanning mechanism itself — the dropdown/input
  component is identical on both platforms; only `fonts.ts`'s directory list differs.

## Risks

- **`fontkit`'s TTC (TrueType Collection) handling is the least-proven piece of this design** —
  no exact prior-art call site in this codebase to verify against (unlike every other phase so
  far, which ported from a working reference implementation). If `fontkit`'s collection API
  proves unreliable for a given file during implementation, skip that file (consistent with the
  general skip-on-failure policy) and report it rather than guessing at a workaround.
- **No subagent in this pipeline can verify real font-directory contents on an actual macOS or
  Windows machine, nor confirm a real system font's PostScript name matches what AE expects** —
  automated tests can mock the filesystem/parsing calls, but the real end-to-end behavior (does
  the dropdown show real fonts, does selecting one actually work when applied via `applyChange`)
  needs a human tester on both platforms. This phase's implementation plan should include a
  manual verification recipe covering both macOS and Windows, matching every prior phase's
  precedent.
