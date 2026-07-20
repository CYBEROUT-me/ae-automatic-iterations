# Design: Panel Visual Redesign v2 (Real Elevation + Interaction Fixes)

**Date:** 2026-07-20
**Status:** Approved
**Supersedes:** `2026-07-16-panel-visual-redesign-design.md` (shipped, then substantially rejected
by the user on real-world review — see Process Note)

---

## Goal

Fix what the first redesign got wrong. That phase shipped (indigo/violet tokens, icon toolbars,
hover-only interaction states) and passed every automated check and two rounds of static-mockup
approval — but once the user actually used the built, working panel, the verdict was blunt:
buttons had no visible affordance, the Presets layout was bad, there was no way to preview a
change, VAR name inputs were bad, and the emoji picker's UX was bad. This spec is a targeted redo
of the *interaction and layout* layer, anchored on concrete references the user actually likes
(Apple/iOS/macOS, Figma, Google, Jira, Airtable) instead of abstract style directions, and
validated against realistic, densely-populated mockups instead of sparse ones.

## Process Note

Three things were learned the hard way and directly shape this spec:

1. **Static mockups with clean, sparse sample data hide real problems.** A screenshot of 5 color
   swatches in a row looks fine; a real preset library with 7 items, or two stacked layer groups
   with 5 iteration rows each, reveals density and hierarchy problems a sparse mockup can't. Every
   mockup for this spec used realistic, populated content.
2. **Hover-only affordance is indistinguishable from "the feature doesn't exist."** The first
   redesign's per-row Preview action only appeared on hover — the user's top-level complaint was
   "no opportunity to view the preview," even though a preview action existed. Nothing in this spec
   is hover-only for discoverability; hover states add *feedback*, they don't gate *visibility*.
3. **A reference anchor beats abstract style options.** Asking "what does modern mean to you" produced
   three directions nobody was invested in. Asking "what apps' UI do you actually like" (answer: Apple/
   iOS/macOS, Figma, Google, Jira, Airtable) immediately identified the actual gap: real elevation
   (borders + shadows, not flat color blocks) and native-feeling controls (a real switch for a real
   on/off flag, a disclosure chevron for an expand/collapse row) instead of reinvented widgets.

## What's Kept From the First Redesign (Architecture Unaffected)

The first redesign's *architecture* was never the problem — only its skin, density, and a few
interaction choices. Kept as-is, no changes needed:

- The `lucide-react` icon system and dependency.
- `LayerInfoPanel` owning `presetsOpen`/`changelogOpen` local state and `emojiEnabled` from the
  store, with `EmojiSection`/`PresetPanel`/`ChangelogList` remaining content-only components the
  parent conditionally mounts. This spec changes *what renders* for the toggles (a switch, a
  disclosure row) — not *who owns the state*.
- `IterationRow`'s `onPreview?` prop and the underlying `previewIteration` behavior — only the
  `.row-action` button's *visibility rule* changes (always visible, not hover-revealed).
- The SCSS token *mechanism* (a `variables.scss` file consumed via `@use ... as *`) — only the
  token *values* change (see below).

## 1. Design Tokens (Replacing the v1 Palette)

The v1 palette tinted every neutral gray with violet (`#1b1a24`, `#252430`). References all lean
neutral-gray backgrounds with violet reserved purely for the accent — matching that:

```scss
// Surfaces — neutral, not violet-tinted
$bg: #18181b;              // page background
$surface: #232326;         // card/section background
$surface-hover: #2a2a2e;   // row hover state
$surface-raised: #2e2e33;  // icon-button resting background (lighter than card = "raised")
$inset: #14141a;           // input/well background (darkest)
$border: #34343a;          // default card/section border
$border-strong: #3f3f46;   // icon-button border (more visible, since buttons need to read as raised)

// Text
$text: #d4d4d8;
$text-dim: #a1a1aa;
$text-faint: #71717a;      // field labels, group labels, meta text
$text-strong: #fafafa;

// Accent — unchanged in hue, this was never the complaint
$accent: #6d3fe0;
$accent-hover: #7c5cf0;
$accent-glow: rgba(109, 63, 224, 0.5);

// Semantic
$switch-on: #34c759;       // iOS system green, for the one real on/off switch
$changed: #3caea3;         // unchanged — still enough contrast on the new neutral bg
$warning: #f6d55c;
$error: #ed553b;

// Elevation — new. v1 had no shadows at all; this is the core fix for "no visibility that it can be pressed"
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);   // icon buttons, inputs
$shadow-md: 0 1px 3px rgba(0, 0, 0, 0.35);   // cards/sections
$shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);   // the panel itself, dropdowns
$shadow-accent: 0 2px 8px rgba(109, 63, 224, 0.5); // Run button's glow

// Spacing / radii — radii grow slightly (references favor slightly rounder corners)
$space-1: 2px; $space-2: 4px; $space-3: 6px; $space-4: 8px; $space-5: 12px;
$radius-sm: 6px;  // was 4px in v1
$radius-md: 8px;  // was 6px in v1

// Type scale — unchanged from v1, was never a complaint
$text-xs: 10px; $text-sm: 11px; $text-md: 12.5px;
$transition-fast: 100ms ease; $transition-press: 80ms ease;
```

**Every interactive element gets a border + a shadow at rest** (`$border-strong` + `$shadow-sm`
for icon buttons; `$border` + `$shadow-md` for cards) — this is the single biggest fix for "flat,
no visibility that it can be pressed." Hover/press states still exist (brighten, lift, scale) but
are now *additive feedback* on top of an already-visible resting affordance, not the only signal.

## 2. Interaction Patterns

**Disclosure rows** replace both the old icon-toolbar toggle buttons and the rejected "Open"
pill button, for anything that expands/collapses a section (Presets; nothing else currently needs
this). The entire row is clickable — icon + label on the left, a chevron on the right that
rotates 90° when expanded (the standard disclosure-triangle idiom: Finder, Figma's layers panel).
No button, no label text on the trigger itself.

**A real switch for a real on/off flag.** "Emoji overlay" toggles actual run behavior (not a
panel's visibility) — it gets an iOS-style switch (`$switch-on` when on, `$border-strong` track
when off), deliberately visually distinct from the icon-button/disclosure language, because it
*is* a different kind of control (state, not action).

**Row actions are always visible, never hover-gated.** Every iteration row's Preview icon
(`.row-action`) and every preset card's Apply/menu icons are visible at all times. Hover still
adds a background-highlight to the row for scannability, but visibility of the action itself never
depends on hover — the entire reason the previous version's preview action went undiscovered.

**Presets render as a card gallery**, not a flat list — swatches lead (the visual anchor, like an
Airtable card view), name below, Apply + overflow-menu actions at the card's bottom, laid out
two-per-row given the panel's 300–320px width.

**VAR name inputs are individually labeled fields**, each with its own number badge and a
`"Variant name"` label above the input — replacing the previous anonymous grid of unlabeled boxes.

**Emoji fields regroup by kind, not by data type.** Position (X + Y) becomes one visual control —
two mini inputs sharing a single bordered group, matching how design tools pair coordinates — with
Size as its own adjacent field. "Layer" moves to its own row below a divider with the clearer
label "Attach to layer," since it identifies a target layer index, a conceptually different kind
of setting from position/size.

**Emoji assignment rows and picker grid get bigger, clearer targets.** Assignment-row thumbnails
grow to 34px with a violet ring on whichever one has an emoji set; rows highlight on hover to show
the whole row (not just the thumbnail) opens the picker below it. The picker grid, when open for a
given row, highlights the currently-assigned emoji with the same violet ring — this requires
threading the row's current path into `EmojiPickerGrid` as a new prop (`selectedPath?: string`),
compared against each grid item's path.

## 3. Where Things Live Now

| Element | v1 placement | v2 placement |
|---|---|---|
| Refresh + layer name + count stepper | Icon-toolbar row 1 | **Unchanged** |
| Emoji overlay toggle | Icon button in toolbar row 2 | Switch, inside a "settings" card |
| Presets toggle | Icon button (was: "Open" pill button) in toolbar row 2 | Disclosure row, same settings card |
| Changelog toggle | Icon button in toolbar row 2 | Small icon button, bottom-left below Run Iterations — matching the original pre-redesign placement, since nothing about it was flagged as a problem |

## 4. Component Mapping

| Component | Change |
|---|---|
| `LayerInfoPanel` | Toolbar row 1 unchanged. Toolbar row 2 (Emoji/Presets/Changelog icon buttons) is deleted; replaced by a settings card containing the Emoji switch row and Presets disclosure row. Changelog's toggle button becomes its own small icon button, still owned and rendered directly by `LayerInfoPanel` (not passed into `RunButton.tsx` — no new coupling between them), placed in the JSX immediately after `<RunButton />` so it appears just below it. State ownership (`presetsOpen`, `changelogOpen`, `emojiEnabled` from store) is unchanged — only which JSX renders for each. |
| `EmojiSection` | Position/Size regroup into one row (paired X/Y control + Size field); Layer moves to its own row below a divider, relabeled "Attach to layer." Assignment rows get 34px thumbnails with a selected-ring on the set one, and row-hover highlighting. |
| `EmojiPickerGrid` | Grid items grow; gains a `selectedPath?: string` prop, compared against each item's `path` to render the violet-ring selected state. Passed down from `EmojiSection`'s current row's assigned path. |
| `PresetPanel` | `renderItem`'s flat row becomes a card (swatches on top, name below, Apply + overflow-menu actions at the card's bottom), laid out in a two-column grid. The disclosure trigger (previously its own "Presets" button, deleted in the v1 rework) is now owned entirely by `LayerInfoPanel`'s settings-card disclosure row — `PresetPanel` itself gains no new props, it's still mounted/unmounted the same way. |
| `IterationRow` | `.row-action`'s CSS loses its hover-gated `opacity: 0 → 1` rule — the Preview icon is visible at all times. No prop/logic change. |
| `VarNamesRow` | Each input gets its own wrapping field with a number badge and a "Variant name" label above it, replacing the flex-wrapped grid of bare inputs. Same store fields (`varNames`, `setVarName`), just individually labeled markup. |
| `VideoFields`, `MediaFields`, `FontInput`, `RunButton`, `ModeTabs`, and every other existing icon/chip button | Token-only restyle: adopt the new `$surface-raised`/`$border-strong`/`$shadow-sm` resting state so every button in the panel has the same visible-at-rest affordance, per the user's "all buttons are flat" complaint being general, not limited to the components shown in mockups. No layout/behavior change to these. |

## Out of Scope — Tracked Separately

Two **functional** bugs surfaced during manual testing, unrelated to this visual spec and not
fixable by CSS/markup changes:

- **Font scanning returns empty inside the dev-server-loaded panel** (`fontDirectories()`/
  `loadFonts()`), despite the identical logic working correctly against the real filesystem in
  plain Node. Suspected cause: CEP's Node integration behaving differently for content loaded over
  HTTP (`localhost:3000`, the dev/symlink workflow) versus the real packaged extension's `file://`
  origin — unconfirmed without either deeper CEP-specific tooling or a real packaged-extension
  test.
- **Emoji thumbnails render as broken images inside the dev-server-loaded panel** (`<img
  src="file://...">` failing to resolve) — very likely the same root cause class as the font issue.

Both need investigation against a real packaged build, not the dev/symlink workflow — out of
scope for this visual redesign. Do not attempt to "fix" either by changing try/catch behavior or
adding fallback UI as part of this spec's implementation.

## Testing

- Every existing test that queries removed UI (`getByText("Presets")` as a button label — already
  gone in v1's own rework; the "Add emoji overlay" checkbox text — also already gone) stays
  removed/updated as it already is. New markup changes in this phase (settings card, disclosure
  row, preset cards, labeled VAR fields, regrouped emoji fields) will require corresponding test
  updates in the same task that changes each component's markup — call out exactly which
  assertions change when the implementation plan reaches each file.
- `EmojiPickerGrid`'s new `selectedPath` prop needs a new test: renders the selected ring only on
  the matching item, not on others, and not at all when no path is assigned.
- Manual verification: `npm run dev` + browser preview for layout/tokens (the same dev-server
  limitation applies as before — font/emoji-asset loading won't work there, per Out of Scope
  above, but layout, tokens, and every non-file-loading interaction can be fully verified this
  way). A real AE load remains the final check, same as before.

## Risks

- **The settings-card + disclosure-row rework touches the same `LayerInfoPanel` region the v1
  "highest risk" task already rewrote once.** This time the risk is lower — state ownership
  doesn't change, only which controls render — but the diff still needs the same care: verify the
  Emoji switch's `onChange` still writes to the same store field, and the Presets disclosure still
  toggles the same `presetsOpen` state, not new parallel state.
- **`EmojiPickerGrid`'s new `selectedPath` prop is a real behavior addition**, not a pure restyle —
  flagged explicitly here so it isn't waved through as "just CSS" during implementation review.
- **Card-gallery preset layout at 300–320px width fits two columns tightly** — verify at the
  panel's actual minimum width (`cep.config.ts`'s `minWidth: 260`) during manual verification, not
  just at the ~320px width used in mockups.
