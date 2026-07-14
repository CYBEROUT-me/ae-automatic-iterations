# Design: Changelog Panel for the BoltCEP Rewrite

**Date:** 2026-07-13
**Status:** Approved

---

## Goal

Add a "what's new" changelog panel to `ae-iterations-next`, matching the original `extension/`'s
info-button-toggle feature. This is the "changelog panel" gap identified when comparing the
rewrite against the original. Presets and auto-update remain out of scope for this phase.

## Decisions

Settled during brainstorming:

1. **Bundle `changelog.json` as a direct Vite/TypeScript JS import, not a runtime file read.**
   The original loads its changelog via panel-side Node (`fs.readFileSync` +
   `cs.getSystemPath(SystemPath.EXTENSION)`) — the same class of runtime-filesystem-lookup
   mechanism that both the emoji-overlay phase (asset bundling) and the font-picker phase
   (Node-builtin externalization) had real, non-obvious build/packaging problems with. Since
   changelog content is static at build time — a new version always ships with a rebuilt panel
   anyway — there is no reason to read it at runtime at all. `tsconfig.json` already has
   `resolveJsonModule: true`, so `import entries from "./changelog.json"` type-checks and
   bundles cleanly with zero Node dependency, zero platform-specific path resolution, and none
   of the packaging-surprise risk the last two phases hit.
2. **Content: retroactively document this rewrite's own history**, not the original
   `extension/`'s unrelated version history (1.0.0-1.0.11) and not an empty list. Four entries,
   one per phase already shipped in this rewrite: ITR core, VAR mode, emoji overlay, font
   picker. `package.json`'s version (currently the scaffold default `0.0.1`) bumps to match the
   latest entry — the first real versioning this rewrite has done.
3. **Visibility: unconditional, not mode-gated.** Matches the original — the changelog is a
   "what's new" info panel, unrelated to ITR/VAR mode.

## Architecture

**Data — `ae-iterations-next/src/js/main/changelog.json`:**

```json
[
  {
    "version": "0.4.0",
    "date": "2026-07-14",
    "changes": [
      "Cross-platform font picker: autocomplete dropdown of real installed PostScript font names for text layers, on both macOS and Windows"
    ]
  },
  {
    "version": "0.3.0",
    "date": "2026-07-13",
    "changes": [
      "Emoji overlay (ITR mode): per-iteration emoji picker, shared position/size/layer-index config, live preview, emoji-only runs with no layer selection required"
    ]
  },
  {
    "version": "0.2.0",
    "date": "2026-07-07",
    "changes": [
      "VAR mode: named-variant iterations with per-layer media replacement, 4 aspect ratios (9x16/1x1/16x9/4x5)",
      "ITR mode gains a 4th aspect ratio, ITR_4x5"
    ]
  },
  {
    "version": "0.1.0",
    "date": "2026-07-06",
    "changes": [
      "Initial BoltCEP rewrite: ITR core — shape/text/stroke/video color and effect iteration, PNG + video rendering, project collection"
    ]
  }
]
```

Dates verified against each phase's actual final-whole-branch-review commit in git history
(`b507d48` 2026-07-06, `dd41f9f` 2026-07-07, `b4d547e` 2026-07-13, `ecc487b` 2026-07-14) — not
guessed.

**Component — `ae-iterations-next/src/js/main/components/ChangelogButton.tsx`:**

```tsx
interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}
```

A single, self-contained component (no props) that:
- Imports `changelog.json` directly — `import entries from "../changelog.json"` (typed via the
  local `ChangelogEntry` interface above; not added to `shared/types.ts`, since this has no
  host-side/cross-boundary relevance at all, unlike the types that file exists for).
- Renders a small "ℹ" icon button, placed next to `RunButton` in `run-section` (matching the
  original's placement alongside its Run button).
- Owns an `open` boolean via local `useState`; clicking the button toggles it. When open,
  renders the entry list below the button — each entry showing its version, date, and a bullet
  list of changes. No `evalTS`, no Node `fs`, no host involvement.

**Wiring:** Rendered inside `LayerInfoPanel.tsx` (or directly where `RunButton` is rendered),
unconditionally — no `mode === "itr"`/`"var"` gating.

## Testing

Real Vitest + React Testing Library tests — this is pure panel-side rendering logic with a
static data import, no AE object model, no Node dependency, fully unit-testable: toggling
open/closed, and that each entry's version/date/changes render correctly from the real bundled
data.

## Out of Scope

- Presets, auto-update — later phases per the original spec.
- Any mechanism for automatically generating/appending changelog entries on future releases
  (the "release tooling" gap, e.g. `install.sh`/`package.sh` equivalents) — entries are
  hand-authored for now, same as the original.
- Any change to the current production `extension/` — this phase applies only to
  `ae-iterations-next`.

## Risks

- None significant — this is the simplest phase in this rewrite's history (no AE object model,
  no new dependency, no platform-specific code, fully unit-testable). No manual verification
  recipe beyond a basic visual check is needed, unlike every prior phase.
