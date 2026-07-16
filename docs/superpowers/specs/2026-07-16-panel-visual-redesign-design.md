# Design: Panel Visual Redesign (Design Tokens + Icon System + Density)

**Date:** 2026-07-16
**Status:** Approved

---

## Goal

Give `ae-iterations-next`'s panel a cohesive, modern, tactile visual design. The panel currently
uses BoltCEP's unstyled scaffold defaults (plain `<button>`, three ad-hoc grays, one accent, no
icons, no hover/press feedback) — confirmed by reading `variables.scss`, `main.scss`, and
`index.scss` directly. This phase replaces that with a consistent token system, a small SVG icon
set, and denser, genuinely interactive layouts — applied to every component in the panel, not
just the top-level chrome.

This phase was explicitly sequenced by the user to happen before the deferred auto-update phase.

## Process note

Two rounds of visual mockups (via the brainstorming skill's visual companion) were rejected and
revised before reaching this design:

1. **Three skin directions** (Minimal Flat / Elevated Cards / Bold Accent) were rejected outright:
   "everything is bad from the UX side... buttons take too much place... not hot" (flat, no
   hover/press feedback, doesn't feel clickable).
2. **A UX-first rebuild** — folding redundant controls together, replacing full-width buttons with
   an icon toolbar, folding per-iteration preview buttons into hover-revealed row actions, and
   demonstrating real CSS hover/active states live in the browser — was approved: "This feels much
   better, let's go with this direction."
3. **Three palettes applied to the approved layout** (Refined Neutral / Warm Graphite+Teal / Deep
   Indigo+Violet) were then compared with real SVG icons in place of the placeholder unicode
   glyphs. Deep Indigo + Violet was chosen.

The interaction model (section 2) and palette (section 1) below are therefore already
user-validated against live, interactive mockups — not first drafts.

## Scope

**Applies to every component**, per explicit user confirmation: `LayerInfoPanel`, `IterationRow`/
`ColorFields`, `EmojiSection`/`EmojiPickerGrid`, `PresetPanel`, `ChangelogButton`, `VideoFields`,
`MediaFields`, `FontInput`, `VarNamesRow`, `ModeTabs`, `RunButton`.

**Purely visual/interaction-layer.** No new store state, no new host (`.ts`/`.jsx`) code, no
change to what any control *does* — only how it looks and reacts. No panel geometry change
(`cep.config.ts` width/height/min sizes stay as-is). No light theme (dark-only, matching AE's own
UI). No change to `VideoFields`/`MediaFields`/`FontInput`/`PresetPanel`/`EmojiSection`'s internal
logic — only their markup and styling.

## 1. Design Tokens

Replace `ae-iterations-next/src/js/variables.scss` entirely:

```scss
// Surfaces
$bg: #1b1a24;             // page background (was $darkest)
$surface: #252430;         // button/panel background (was $darker)
$surface-hover: #302f3d;   // hover state for surfaces (new)
$inset: #14131b;           // input/well background, darker than surface (new)
$border: #2c2b38;          // hairline borders (was $dark)

// Text
$text: #c9c7d4;            // body text (was $font)
$text-dim: #83809a;        // secondary/meta text (was $highlight)
$text-strong: #f3f2f7;     // emphasized/active text (new)

// Accent
$accent: #7b5fd8;          // primary actions, active states (was $active)
$accent-hover: #8c72e0;    // (new)
$accent-glow: rgba(123, 95, 216, 0.4);  // box-shadow on hover for primary CTA (new)

// Status (unchanged — still sufficient contrast on the new background)
$changed: #3caea3;
$warning: #f6d55c;
$error: #ed553b;
```

`$primary`/`$secondary` (`#88715a`/`#4a3928`, the mismatched brown pair used only by
`.preview-btn`) are deleted — the preview-button UI they styled is removed entirely (section 2).

**Type scale** (replacing today's seven ad-hoc font-sizes: 0.65rem/0.7rem/0.72rem/0.75rem/
0.78rem/0.8rem/0.85rem):
- `$text-xs: 10px` — meta labels (group labels, changelog dates)
- `$text-sm: 11px` — base body/control text (the default for nearly everything)
- `$text-md: 12.5px` — section emphasis (Run button label)

**Spacing scale** (replacing today's nine ad-hoc values):
`$space-1: 2px, $space-2: 4px, $space-3: 6px, $space-4: 8px, $space-5: 12px`

**Radii:** `$radius-sm: 4px` (icon buttons, inputs, swatches), `$radius-md: 6px` (Run button).

**Motion:** `$transition-fast: 100ms ease` (hover), `$transition-press: 80ms ease` (press/scale).

## 2. Icon System

Add `lucide-react` (MIT-licensed, tree-shakeable — bundle only grows by the icons actually
imported) as a dependency, replacing the mockup's placeholder unicode glyphs with real inline SVG
components. Icons needed, by component:

| Icon | Used in |
|---|---|
| `RefreshCw` | Layer refresh (toolbar) |
| `ChevronUp` / `ChevronDown` | Count stepper |
| `Smile` | Emoji toggle (toolbar) |
| `Star` | Presets toggle (toolbar) |
| `Info` | Changelog button |
| `Play` | Per-row preview (iteration rows) |
| `Trash2` | Per-row delete (preset list) |
| `Save` | Preset save action |
| `Check` | Applied/selected confirmation (preset list) |
| `FlipHorizontal2` | Video/media flip toggle |
| `Contrast` | Video/media B&W toggle |
| `Droplet` | Video/media tint toggle |
| `SlidersHorizontal` | Video/media hue toggle |
| `Type` | Font input prefix |

## 3. Interaction Patterns

Three reusable patterns, applied consistently:

**Icon toolbar row** — a horizontal strip of `22×22px` icon buttons: `background: $surface`,
`border-radius: $radius-sm`. States: hover → `background: $surface-hover`; press →
`transform: scale(0.92)`; active/open (e.g. Presets panel currently expanded) →
`background: $accent, color: white`; disabled → `opacity: 0.4`, no hover reaction. Transitions use
`$transition-fast` (background/color) and `$transition-press` (transform). Used for: refresh,
Emoji toggle, Presets toggle, Changelog button, count stepper's chevrons.

**Compact hover-row** — single-line `~26px` rows: `border-radius: $radius-sm`, hover →
`background: $surface-hover`. A trailing icon action (`opacity: 0`) becomes visible
(`opacity: 1`) only when its row is hovered, via `.row:hover .action { opacity: 1 }`. Used for:
iteration rows (number badge + `input[type=color]` swatch + hex text input + hover-revealed
`Play`), preset list rows (name + hover-revealed `Trash2`), changelog entries.

**Real states everywhere** — every button/input gets explicit hover, `:active` (press), and
`:disabled` styling. Disabled controls must not react to hover at all (no background/color
change) — this is itself a tactile signal that the control is inert, per the approved mockup's
Run-button-disabled behavior. `input[type=color]` swatches keep native color-picker behavior but
get the same custom border treatment (`1px solid $border`, hover → `border-color: $text-dim`,
`transform: scale(1.12)`) as other interactive elements. `input[type=checkbox]` stays native
(`accent-color: $accent`) — full custom checkboxes aren't warranted here — but its containing row
gets hover-row treatment.

## 4. Component-by-Component Changes

| Component | Change |
|---|---|
| `LayerInfoPanel` | Refresh icon-button + layer name + count stepper merge into one toolbar row. Emoji/Presets/Changelog toggles merge into a second toolbar row. The entire `#preview-row` block (5 "Preview N" buttons, `.preview-btn`, `$primary`/`$secondary`) is deleted — replaced by the per-row `Play` icon (below). |
| `IterationRow` / `ColorFields` | Becomes a compact hover-row: number badge, `input[type=color]` swatch, hex text input, hover-revealed `Play` icon button that calls the existing per-iteration preview handler (same `previewIteration` callback already wired in `LayerInfoPanel.tsx:61-68` — only its trigger UI moves) |
| `EmojiSection` | Enable toggle becomes an icon-toolbar button (`Smile`, active state = accent fill when enabled). Expanded grid (`EmojiPickerGrid`) restyled to tokens; selected cell gets `$accent` border instead of the current `rgba($active, 0.6)` |
| `PresetPanel` | Toggle becomes an icon-toolbar button (`Star`). Save row's text button becomes a `Save` icon button beside the name input. Each preset list item becomes a compact hover-row with hover-revealed `Trash2`; an applied preset shows a `Check` |
| `ChangelogButton` | Already icon-sized (`#btn-changelog`) — restyle colors/radius to tokens only. List entries restyled to compact-row spacing |
| `VideoFields` / `MediaFields` | Flip/B&W/Tint/Hue toggles become icon+label chips (`FlipHorizontal2`, `Contrast`, `Droplet`, `SlidersHorizontal`) using the icon-toolbar button states, sized to fit their label |
| `FontInput` | Dropdown restyled to tokens (`$surface`/`$inset`/`$border`); options get hover-row treatment; `Type` icon prefix on the input, trailing `ChevronDown` |
| `VarNamesRow`, `ModeTabs`, `RunButton` | Token restyle only — current layout is already compact and correct |

`RunButton` keeps its full width and primary-CTA prominence (this is the one place a large button
is correct) but shrinks to the new spacing scale: `padding: $space-4 0`, hover →
`background: $accent-hover` with `box-shadow: 0 2px 10px $accent-glow`, press →
`transform: scale(0.98)`, disabled → `background: $surface, color: $text-dim`, no hover reaction.

The `#status` message below it keeps its current colored-box treatment (idle/running neutral,
done/warning/error tinted per state) — the color-coded signal is worth keeping for run
errors/warnings, unlike the button rows this isn't repeated N times so the space cost is low.
Only its tokens and padding change: `background: rgba($changed, 0.15)` etc. (same pattern as
today, new color names), padding tightened to `$space-2 $space-3`.

## 5. Testing & Verification

- **Existing component tests** (`*.test.tsx`) assert behavior via RTL (clicks, state transitions,
  callback args), not exact markup, and should keep passing unmodified. Any assertion coupled to
  an old class name or DOM structure gets updated in the same task as the component it tests —
  without changing what the test verifies.
- **Visual verification**: `npm run dev` serves the panel standalone in a browser — CSInterface
  calls no-op outside the CEP host, but rendering/CSS doesn't depend on it. Each restyled
  component gets checked against the approved mockups in a real browser before being called done;
  a final pass happens loaded inside After Effects itself.
- **No behavior changes** — every existing `evalTS` call, store action, and prop signature is
  unchanged. This phase only touches JSX markup, class names, and `.scss`.

## Out of Scope

- Panel geometry (`cep.config.ts` width/height/min sizes).
- A light theme — dark-only, matching After Effects' own UI.
- Any new feature or behavior change to `VideoFields`, `MediaFields`, `FontInput`, `PresetPanel`,
  or `EmojiSection` beyond markup/styling.
- Auto-update (explicitly deferred by the user until after this phase).

## Risks

- **Global token rename touches every file that references the old SCSS variable names**
  (`$darkest`, `$darker`, `$dark`, `$font`, `$highlight`, `$active`, `$primary`, `$secondary`).
  This includes `index.scss` (BoltCEP's scaffold-default `button`/scrollbar rules, which several
  unclassed buttons like "Refresh Layer" and VAR mode's "Test" button currently fall back to),
  not just `main.scss`. The implementation plan must grep all usages across every `.scss` file
  before deleting the old names, not just add the new ones alongside.
- **Hover-revealed actions** (per-row preview `Play`, per-row delete `Trash2`) are invisible until
  a row is hovered. This matches the approved mockup and keeps rows dense, but is mouse-dependent;
  acceptable here since CEP panels are exclusively mouse-driven and the rows are also the natural
  keyboard-tab targets for their sibling controls (hex input, swatch), so the actions remain
  reachable, just not discoverable by tabbing alone. Not a blocker for this phase.
- **New runtime dependency** (`lucide-react`) — mitigated by only importing the ~14 icons
  actually used; tree-shaking keeps the bundle cost proportional to that list, not the full
  library.
