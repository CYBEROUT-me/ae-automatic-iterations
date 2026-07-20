# Panel Visual Redesign v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the interaction/layout problems found in the shipped v1 redesign — flat buttons with
no resting affordance, a bad Presets layout, hover-only preview (indistinguishable from "no
preview"), bad VAR name inputs, and bad emoji UX — using a neutral-gray + real-elevation visual
language anchored on Apple/Figma/Google/Jira/Airtable references.

**Architecture:** Every existing component's *state ownership* is unchanged (this was never the
problem) — only markup/CSS changes, plus one small, deliberate behavior addition
(`EmojiPickerGrid`'s selected-state highlighting). Token values change; token *names* mostly don't
(v1's naming scheme was sound), so most files only need new selectors/rules, not renames.

**Tech Stack:** React 19 + TypeScript, SCSS, Zustand, Vitest + Testing Library, `lucide-react`
(already a dependency).

## Global Constraints

- Exact new token values are given verbatim in Task 1 — use them, don't invent alternates.
- No state-ownership changes anywhere: `LayerInfoPanel` keeps owning `presetsOpen`/`changelogOpen`
  local state and reading `emojiEnabled` from the store; every other component keeps its current
  props/store usage. Only markup and CSS change, except `EmojiPickerGrid`'s new `selectedPath`
  prop (explicitly called out in Task 6 — a real, deliberate behavior addition, not an accidental
  one).
- No hover-gated visibility anywhere for an action that represents "this feature exists" (Preview,
  Apply, Delete). Hover may still add a background-highlight for scannability.
- Every existing test must keep passing; where a task's markup change makes an existing assertion
  invalid, that same task updates the test — never leave a test red.
- Out of scope, do not touch: the two functional bugs (font scan returns empty, emoji thumbnails
  render as broken images) documented in the design spec's "Out of Scope" section. Do not add
  fallback UI or change try/catch behavior for either as part of this plan.
- Dark-only, no panel geometry changes.

---

## Task 1: Design tokens v2 + global elevation on shared controls

**Files:**
- Modify: `ae-iterations-next/src/js/variables.scss` (full rewrite)
- Modify: `ae-iterations-next/src/js/index.scss` (generic `button` rule, scrollbar tokens)
- Modify: `ae-iterations-next/src/js/main/main.scss` (`.icon-btn`, `input[type="text"/"number"]`,
  `input[type="color"]`)

**Interfaces:**
- Produces: every token name used by later tasks — `$bg, $surface, $surface-hover,
  $surface-raised, $inset, $border, $border-strong, $text, $text-dim, $text-faint, $text-strong,
  $accent, $accent-hover, $accent-glow, $switch-on, $changed, $warning, $error, $shadow-sm,
  $shadow-md, $shadow-lg, $space-1..5, $radius-sm, $radius-md, $text-xs, $text-sm, $text-md,
  $transition-fast, $transition-press`.

Almost every token *name* from v1 survives unchanged — only values change, plus new tokens for
elevation (`$shadow-*`), the raised-surface distinction (`$surface-raised`, `$border-strong`), and
the one real switch (`$switch-on`). This means most later tasks only add new selectors; they don't
need to rename anything in files this task doesn't touch.

- [ ] **Step 1: Rewrite `variables.scss`**

```scss
// Surfaces — neutral gray, not violet-tinted (v1's mistake)
$bg: #18181b;
$surface: #232326;
$surface-hover: #2a2a2e;
$surface-raised: #2e2e33;   // icon-button resting background — lighter than $surface, reads as "raised"
$inset: #14141a;            // input/well background — darker than $surface, reads as "recessed"
$border: #34343a;
$border-strong: #3f3f46;    // icon-button border — more visible, buttons need to read as raised

// Text
$text: #d4d4d8;
$text-dim: #a1a1aa;
$text-faint: #71717a;       // field labels, group labels, meta text
$text-strong: #fafafa;

// Accent — same hue as v1, color was never the complaint
$accent: #6d3fe0;
$accent-hover: #7c5cf0;
$accent-glow: rgba(109, 63, 224, 0.5);

// Semantic
$switch-on: #34c759;        // iOS system green — the one real on/off switch
$changed: #3caea3;
$warning: #f6d55c;
$error: #ed553b;

// Elevation — new. v1 had zero shadows; this is the core fix for "no visibility that it can be pressed"
$shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);   // icon buttons, inputs
$shadow-md: 0 1px 3px rgba(0, 0, 0, 0.35);   // cards/sections
$shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);   // dropdowns, floating elements

// Type scale — unchanged
$text-xs: 10px;
$text-sm: 11px;
$text-md: 12.5px;

// Spacing — unchanged
$space-1: 2px;
$space-2: 4px;
$space-3: 6px;
$space-4: 8px;
$space-5: 12px;

// Radii — grow slightly (references favor rounder corners)
$radius-sm: 6px;
$radius-md: 8px;

// Motion — unchanged
$transition-fast: 100ms ease;
$transition-press: 80ms ease;
```

- [ ] **Step 2: Give `.icon-btn` a visible resting border + shadow**

In `ae-iterations-next/src/js/main/main.scss`, replace the `.icon-btn` rule:

```scss
.icon-btn {
  width: 22px;
  height: 22px;
  border-radius: $radius-sm;
  background-color: $surface-raised;
  color: $text-dim;
  border: 1px solid $border-strong;
  box-shadow: $shadow-sm;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  position: relative;
  transition: background-color $transition-fast, color $transition-fast, transform $transition-press, box-shadow $transition-fast;

  svg {
    width: 13px;
    height: 13px;
  }

  &:hover:not(:disabled) {
    background-color: $surface-hover;
    color: $text-strong;
    box-shadow: $shadow-md;
  }

  &:active:not(:disabled) {
    transform: scale(0.92);
    box-shadow: none;
  }

  &.active-state {
    background-color: $accent;
    border-color: $accent-hover;
    color: white;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
```

- [ ] **Step 3: Move text/number inputs to the recessed (`$inset`) background, tokenize their radius**

Replace the `input[type="text"], input[type="number"]` rule in `main.scss`:

```scss
input[type="text"],
input[type="number"] {
  background-color: $inset;
  border: 1px solid $border;
  border-radius: $radius-sm;
  color: $text;
  padding: 0.15rem 0.35rem;

  &:focus {
    outline: none;
    border-color: $accent;
  }

  &::placeholder {
    color: $text-dim;
  }

  &:disabled {
    opacity: 0.4;
  }
}
```

And `input[type="color"]`'s radius (was hardcoded `3px`):

```scss
input[type="color"] {
  background: none;
  border: 1px solid $border;
  border-radius: $radius-sm;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
```

- [ ] **Step 4: Give the generic `button` rule the same resting elevation, in `index.scss`**

Replace:

```scss
button {
  font-size: 0.8rem;
  background-color: $surface-raised;
  padding: 0.3rem 0.6rem;
  text-align: center;
  vertical-align: middle;
  border-radius: $radius-sm;
  color: $text;
  border: 1px solid $border-strong;
  box-shadow: $shadow-sm;
  outline: none;
  user-select: none;
  cursor: pointer;
}

button:hover {
  background-color: $accent;
}

button:active {
  background-color: $accent;
}
```

(Hover/active going to `$accent` is unchanged from before this redesign entirely — not something
flagged as wrong, so left as-is. Only the resting state gained a border/shadow/radius and moved to
`$surface-raised`.)

- [ ] **Step 5: Give `.video-toggle` (Video/MediaFields chips) the same resting elevation**

Replace the `.video-toggle` rule in `main.scss`:

```scss
.video-toggle {
  background-color: $surface-raised !important;
  color: $text !important;
  border: 1px solid $border-strong !important;
  box-shadow: $shadow-sm;
  display: inline-flex !important;
  align-items: center;
  gap: $space-1;
  transition: background-color $transition-fast, box-shadow $transition-fast;

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover:not(:disabled) {
    background-color: $surface-hover !important;
    box-shadow: $shadow-md;
  }

  &.active {
    background-color: $accent !important;
    border-color: $accent-hover !important;
    color: white !important;
  }
}
```

This is the only rule `VideoFields.tsx`'s Flip/B&W chips and `MediaFields.tsx`'s Browse chip both
use — fixing it here covers both files without touching either component's `.tsx`.

- [ ] **Step 6: Give the font dropdown a floating shadow — it currently has none at all**

Add `box-shadow: $shadow-lg;` to the existing `.font-dropdown` rule in `main.scss`:

```scss
.font-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  max-height: 8rem;
  overflow-y: auto;
  background-color: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-lg;
  margin-top: 2px;
}
```

- [ ] **Step 7: Restyle `ModeTabs` from an underline indicator to a segmented-pill control**

The approved mockups used a filled-pill active tab (Apple-style segmented control), not the
current underline. Replace `#mode-tabs`/`.tab-btn` in `main.scss`:

```scss
#mode-tabs {
  display: flex;
  gap: 3px;
  padding: $space-3 $space-4;
}

.tab-btn {
  flex: 1;
  border-radius: $radius-sm !important;
  background-color: transparent !important;
  color: $text-dim !important;
  padding: 0.4rem 0.5rem !important;
  font-weight: 500;

  &:hover:not(:disabled) {
    background-color: $surface-hover !important;
  }

  &.active {
    background-color: $surface-raised !important;
    color: white !important;
    box-shadow: $shadow-sm;
  }

  &:disabled {
    color: $text-dim !important;
    cursor: not-allowed;
  }
}
```

(The old `border-bottom: 2px solid transparent`/`border-bottom-color: $accent` properties are
removed entirely — the active state is now shown by the filled pill background + shadow, not an
underline.)

- [ ] **Step 8: Run the full test suite and build**

Run: `cd ae-iterations-next && npm test`
Expected: all existing tests pass unchanged (`ModeTabs.test.tsx` asserts on the `.active`
*className*, e.g. `expect(screen.getByText("ITR").className).toContain("active")` — this still
passes since the class name itself is unchanged, only what CSS targets it).

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/js/variables.scss src/js/index.scss src/js/main/main.scss
git commit -m "Rewrite design tokens v2: neutral palette + real elevation on shared controls"
```

---

## Task 2: LayerInfoPanel — settings card (switch + disclosure row), Changelog relocation

This is the highest-risk task — the same `LayerInfoPanel.tsx` region rewritten twice already. This
time the risk is lower: **no state ownership changes**, only which controls render for the same
state (`presetsOpen`, `changelogOpen`, `emojiEnabled`/`setEmojiEnabled`).

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss` (delete old toolbar-row-2 rules that no
  longer have a consumer; add `.settings-card`, `.settings-row`, `.settings-switch`,
  `.settings-disclosure`)

**Interfaces:**
- Consumes: `presetsOpen`/`setPresetsOpen`, `changelogOpen`/`setChangelogOpen` (existing local
  state), `emojiEnabled`/`setEmojiEnabled` (existing store fields) — all unchanged.
- Produces: no new props/state for any other component. `EmojiSection`/`PresetPanel`/
  `ChangelogList` continue to be mounted exactly as before (`{mode === "itr" && emojiEnabled &&
  <EmojiSection />}`, `{mode === "itr" && presetsOpen && <PresetPanel />}`, `{changelogOpen &&
  <ChangelogList />}` — these three lines are unchanged).

- [ ] **Step 1: Replace the second `icon-toolbar` block in `LayerInfoPanel.tsx` with a settings card**

The current file has two `.icon-toolbar` blocks. The **first** (Refresh + layer name + count
stepper) is unchanged. Replace the **second** one — currently:

```tsx
      <div className="icon-toolbar">
        {mode === "itr" && (
          <>
            <button
              className={"icon-btn" + (emojiEnabled ? " active-state" : "")}
              title="Emoji overlay"
              onClick={() => setEmojiEnabled(!emojiEnabled)}
            >
              <Smile />
            </button>
            <button
              className={"icon-btn" + (presetsOpen ? " active-state" : "")}
              title="Presets"
              onClick={() => setPresetsOpen(!presetsOpen)}
            >
              <Star />
            </button>
          </>
        )}
        <div className="toolbar-spacer" />
        <button
          className={"icon-btn" + (changelogOpen ? " active-state" : "")}
          title="What's new"
          onClick={() => setChangelogOpen(!changelogOpen)}
        >
          <Info />
        </button>
      </div>
```

with:

```tsx
      {mode === "itr" && (
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-label">
              <Smile />
              Emoji overlay
            </div>
            <button
              className={"settings-switch" + (emojiEnabled ? " on" : "")}
              role="switch"
              aria-checked={emojiEnabled}
              title="Emoji overlay"
              onClick={() => setEmojiEnabled(!emojiEnabled)}
            />
          </div>
          <div className="settings-divider" />
          <div
            className={"settings-row settings-disclosure" + (presetsOpen ? " open" : "")}
            role="button"
            tabIndex={0}
            title="Presets"
            onClick={() => setPresetsOpen(!presetsOpen)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setPresetsOpen(!presetsOpen);
            }}
          >
            <div className="settings-row-label">
              <Star />
              Presets
            </div>
            <ChevronRight className="settings-chevron" />
          </div>
        </div>
      )}
```

Changelog's icon button is deleted from this location entirely — Step 2 adds it back near
`RunButton`.

Update the icon import line (remove `Info` since it's used at the new location added in Step 2,
add `ChevronRight`):

```tsx
import { RefreshCw, ChevronUp, ChevronDown, Smile, Star, ChevronRight, Info } from "lucide-react";
```

- [ ] **Step 2: Move the Changelog toggle to its own icon button, rendered directly by `LayerInfoPanel` after `<RunButton />`**

Find the end of the component's return statement:

```tsx
      <RunButton effectiveValue={effectiveValue} />
    </div>
  );
}
```

Replace with:

```tsx
      <RunButton effectiveValue={effectiveValue} />
      <button
        className={"icon-btn" + (changelogOpen ? " active-state" : "")}
        title="What's new"
        onClick={() => setChangelogOpen(!changelogOpen)}
      >
        <Info />
      </button>
    </div>
  );
}
```

This is a plain sibling in `LayerInfoPanel`'s own JSX — `RunButton.tsx` itself is not modified and
gains no new props; the two components remain uncoupled.

The `{changelogOpen && <ChangelogList />}` mount line elsewhere in the file is unchanged — it
already renders regardless of `mode`, which is correct and unaffected by this move.

- [ ] **Step 3: Add the settings-card/switch/disclosure CSS to `main.scss`**

Delete the now-unused rule (its only consumer, the old toolbar-row-2 markup, is gone):

```scss
// DELETE this rule — no longer rendered anywhere:
.toolbar-spacer {
  flex: 1;
}
```

Add:

```scss
// ── Settings card (Emoji switch, Presets disclosure) ──────────────────────

.settings-card {
  background-color: $surface;
  border: 1px solid $border;
  border-radius: $radius-md;
  box-shadow: $shadow-md;
  padding: $space-4;
  margin: 0 $space-4 $space-4;
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $space-2 0;
}

.settings-row-label {
  display: flex;
  align-items: center;
  gap: $space-3;
  color: $text;
  font-size: $text-sm;
  font-weight: 500;

  svg {
    width: 14px;
    height: 14px;
    color: $text-dim;
  }
}

.settings-divider {
  border-top: 1px solid $border;
  margin: $space-2 0;
}

.settings-switch {
  width: 36px;
  height: 21px;
  border-radius: 11px;
  background-color: $border-strong;
  border: none;
  position: relative;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
  transition: background-color $transition-fast;

  &::after {
    content: "";
    position: absolute;
    top: 2px;
    left: 2px;
    width: 17px;
    height: 17px;
    border-radius: 50%;
    background-color: white;
    box-shadow: $shadow-sm;
    transition: left $transition-fast;
  }

  &.on {
    background-color: $switch-on;

    &::after {
      left: 17px;
    }
  }
}

.settings-disclosure {
  cursor: pointer;
  border-radius: $radius-sm;
  margin: 0 (-$space-2);
  padding: $space-2;

  &:hover {
    background-color: $surface-hover;
  }
}

.settings-chevron {
  width: 14px;
  height: 14px;
  color: $text-dim;
  transition: transform $transition-fast;
  flex-shrink: 0;
}

.settings-disclosure.open .settings-chevron {
  transform: rotate(90deg);
}
```

- [ ] **Step 4: Run the full test suite and build**

There is no `LayerInfoPanel.test.tsx` in this codebase (a pre-existing gap, not introduced by this
task — panel-wiring changes in this project are verified by the full suite + manual pass, per
established convention).

Run: `npm test`
Expected: all existing tests pass (no test in this codebase queries the old toolbar-row-2 markup
directly — `EmojiSection.test.tsx`/`PresetPanel.test.tsx` render those components in isolation,
not through `LayerInfoPanel`).

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/js/main/components/LayerInfoPanel.tsx src/js/main/main.scss
git commit -m "Replace icon-toolbar Emoji/Presets toggles with a settings card (switch + disclosure row)"
```

---

## Task 3: Iteration rows — always-visible preview, resting card look

**Files:**
- Modify: `ae-iterations-next/src/js/main/main.scss` (`.row-action`, `.iter-row`)

**Interfaces:**
- No component/prop changes. CSS-only.

- [ ] **Step 1: Make `.row-action` always visible — delete the hover-gate**

Replace the `.row-action` rule:

```scss
.row-action {
  width: 18px;
  height: 18px;
  border-radius: $radius-sm;
  background: transparent;
  border: none;
  color: $text-dim;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: color $transition-fast, background-color $transition-fast;

  svg {
    width: 10px;
    height: 10px;
  }

  &:hover {
    background-color: $surface-hover;
    color: $text-strong;
  }
}
```

(Removed: `opacity: 0`, the `opacity: $transition-fast` transition entry, and `.hover-row:hover
.row-action { opacity: 1; }`'s effect — the action is opaque/visible at all times now. This
affects both iteration rows and, later, preset cards, which both use `.row-action`.)

Also remove the now-dead rule in `.hover-row`:

```scss
// In the .hover-row rule, delete this nested selector — it no longer does anything
// meaningful now that .row-action has no opacity:0 state to reveal:
&:hover .row-action {
  opacity: 1;
}
```

`.hover-row` keeps its `&:hover { background-color: $surface-hover; }` rule — rows still
highlight on hover for scannability, only the action's *visibility* is no longer hover-gated.

- [ ] **Step 2: Give `.iter-row` a resting card look (border + background), not just a hover-only highlight**

Replace the `.iter-row` rule:

```scss
.iter-row {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-2 $space-3;
  background-color: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  margin-bottom: $space-2;

  &:last-child {
    margin-bottom: 0;
  }
}
```

- [ ] **Step 3: Run the targeted tests and build**

Run: `npm test -- IterationRow ColorFields`
Expected: all passing (no test asserts on `opacity` or the row's background/border, only on
rendered text/values/callbacks).

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/js/main/main.scss
git commit -m "Make row actions always-visible, give iteration rows a resting card look"
```

---

## Task 4: Presets as a card gallery

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/PresetPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss` (`.preset-item` → new card classes)

**Interfaces:**
- No prop/behavior changes to `PresetPanel` itself — still mounted the same way by
  `LayerInfoPanel` (`{mode === "itr" && presetsOpen && <PresetPanel />}`, unchanged by this task).
- Consumes: `.row-action` from Task 3 (now always-visible).

- [ ] **Step 1: Restructure `renderItem` into a card, and the list into a two-column grid**

In `PresetPanel.tsx`, replace the `renderItem` function:

```tsx
  const renderItem = (preset: Preset, isUser: boolean, index: number) => (
    <div key={(isUser ? "user-" : "lib-") + preset.name + index} className="preset-card">
      <div className="preset-card-swatches">
        {Array.from({ length: swatchCount(preset) }, (_, i) => (
          <div key={i} className="preset-swatch" style={{ background: swatchColor(preset, i) }} />
        ))}
      </div>
      <div className="preset-card-name">{preset.name}</div>
      <div className="preset-card-actions">
        <button className="row-action" title="Apply preset" onClick={() => applyPreset(preset)}>
          <Play />
        </button>
        {isUser && (
          <button className="row-action" title="Delete preset" onClick={() => deletePreset(index)}>
            <Trash2 />
          </button>
        )}
      </div>
    </div>
  );
```

Replace the `#preset-list` div's contents wrapper — find:

```tsx
      <div id="preset-list">
        {savedForKind.length > 0 && <div className="preset-group-label">Saved</div>}
        {savedForKind.map((preset) => renderItem(preset, true, userPresets.indexOf(preset)))}
        <div className="preset-group-label">Library</div>
        {libraryForKind.map((preset, i) => renderItem(preset, false, i))}
      </div>
```

Replace with:

```tsx
      <div id="preset-list">
        {savedForKind.length > 0 && (
          <>
            <div className="preset-group-label">Saved</div>
            <div className="preset-grid">
              {savedForKind.map((preset) => renderItem(preset, true, userPresets.indexOf(preset)))}
            </div>
          </>
        )}
        <div className="preset-group-label">Library</div>
        <div className="preset-grid">
          {libraryForKind.map((preset, i) => renderItem(preset, false, i))}
        </div>
      </div>
```

- [ ] **Step 2: Replace `.preset-item`/`.preset-swatches`/`.preset-name` with card-gallery CSS**

In `main.scss`, delete `.preset-item` (superseded) and replace `.preset-swatches`/`.preset-swatch`/
`.preset-name` with:

```scss
.preset-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $space-3;
}

.preset-card {
  background-color: $surface;
  border: 1px solid $border;
  border-radius: $radius-sm;
  box-shadow: $shadow-sm;
  padding: $space-3;
}

.preset-card-swatches {
  display: flex;
  gap: 2px;
  margin-bottom: $space-2;
}

.preset-swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
}

.preset-card-name {
  font-size: $text-sm;
  font-weight: 500;
  color: $text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: $space-2;
}

.preset-card-actions {
  display: flex;
  gap: $space-1;
}
```

- [ ] **Step 3: Run the targeted tests**

Run: `npm test -- PresetPanel`
Expected: all 6 existing tests pass unchanged — they query `getByTitle("Apply preset")`,
`getByTitle("Delete preset")`, `getByPlaceholderText("Preset name")`, `getByTitle("Save preset")`,
and preset-name text content, none of which changed. `getByText("Brand Blue")`/`getByText("Warm
Tints")` (preset names) also still resolve since `.preset-card-name` still renders the same text.

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/js/main/components/PresetPanel.tsx src/js/main/main.scss
git commit -m "Restyle presets as a two-column card gallery"
```

---

## Task 5: VAR name inputs — individually labeled fields

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/VarNamesRow.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss` (add `.var-field`, `.var-field-label`,
  `.var-field-num`; delete `#var-names-row` if superseded)

**Interfaces:**
- No prop/store changes — still `varNames`/`setVarName` from the store, same as before.
- The input's `placeholder={\`Name ${i + 1}\`}` is preserved verbatim so the existing test's
  `getAllByPlaceholderText(/Name \d/)` query keeps resolving without any test changes.

- [ ] **Step 1: Wrap each input in a labeled field with a number badge**

Replace the full file:

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
        <div key={i} className="var-field">
          <div className="var-field-label">
            <span className="var-field-num">{i + 1}</span>
            Variant name
          </div>
          <input
            type="text"
            placeholder={`Name ${i + 1}`}
            value={varNames[i] ?? ""}
            onChange={(e) => setVarName(i, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add the field/label/badge CSS**

In `main.scss`, replace `#var-names-row`'s rule (if one exists — this ID had no dedicated rule in
the current file, only relied on default block flow) by adding:

```scss
// ── VAR name inputs ─────────────────────────────────────────────────────

#var-names-row {
  display: flex;
  flex-direction: column;
  gap: $space-3;
}

.var-field-label {
  display: flex;
  align-items: center;
  gap: $space-2;
  font-size: $text-xs;
  color: $text-faint;
  margin-bottom: $space-1;
}

.var-field-num {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background-color: $surface-raised;
  color: $text-dim;
  font-size: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.var-field input[type="text"] {
  width: 100%;
  box-sizing: border-box;
}
```

- [ ] **Step 3: Run the targeted tests**

Run: `npm test -- VarNamesRow`
Expected: both existing tests pass unchanged — `getAllByPlaceholderText(/Name \d/)` still resolves
3 inputs (the placeholder attribute is unchanged), and the store-update test still passes the same
way.

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/js/main/components/VarNamesRow.tsx src/js/main/main.scss
git commit -m "Give each VAR name input its own label and number badge"
```

---

## Task 6: Emoji section field regrouping + bigger assignment rows + picker grid selected-state

This is the second-highest-risk task in this plan — it adds one real, deliberate behavior change
(`EmojiPickerGrid`'s new `selectedPath` prop), not just a restyle.

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/EmojiSection.tsx`
- Modify: `ae-iterations-next/src/js/main/components/EmojiPickerGrid.tsx`
- Modify: `ae-iterations-next/src/js/main/components/EmojiPickerGrid.test.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss` (`.emoji-pos-row` replacement, assignment-row
  thumbnail size, grid-item selected state)

**Interfaces:**
- Produces: `EmojiPickerGrid` gains `selectedPath?: string`, compared against each item's `path`
  to render a `selected` class. Existing callers that don't pass it (none currently exist outside
  `EmojiSection`) are unaffected since it's optional.

- [ ] **Step 1: Regroup Position (X+Y) + Size, separate Layer below a divider**

In `EmojiSection.tsx`, replace the `.emoji-pos-row` block:

```tsx
      <div className="emoji-pos-row">
        <label>
          X
          <input type="number" value={emojiX} onChange={(e) => setEmojiX(parseInt(e.target.value, 10) || 0)} />
        </label>
        <label>
          Y
          <input type="number" value={emojiY} onChange={(e) => setEmojiY(parseInt(e.target.value, 10) || 0)} />
        </label>
        <label>
          Size
          <input type="number" value={emojiSize} onChange={(e) => setEmojiSize(parseInt(e.target.value, 10) || 100)} />
        </label>
        <label>
          Layer
          <input
            type="number"
            value={emojiLayerIndex}
            onChange={(e) => setEmojiLayerIndex(parseInt(e.target.value, 10) || 1)}
          />
        </label>
      </div>
```

with:

```tsx
      <div className="emoji-fields-row">
        <div className="emoji-field emoji-field-position">
          <label className="emoji-field-label">Position</label>
          <div className="emoji-position-group">
            <span className="emoji-axis">X</span>
            <input type="number" value={emojiX} onChange={(e) => setEmojiX(parseInt(e.target.value, 10) || 0)} />
            <span className="emoji-position-sep" />
            <span className="emoji-axis">Y</span>
            <input type="number" value={emojiY} onChange={(e) => setEmojiY(parseInt(e.target.value, 10) || 0)} />
          </div>
        </div>
        <div className="emoji-field emoji-field-size">
          <label className="emoji-field-label">Size</label>
          <input type="number" value={emojiSize} onChange={(e) => setEmojiSize(parseInt(e.target.value, 10) || 100)} />
        </div>
      </div>
      <div className="emoji-layer-row">
        <span className="emoji-layer-label">Attach to layer</span>
        <input
          className="emoji-layer-input"
          type="number"
          value={emojiLayerIndex}
          onChange={(e) => setEmojiLayerIndex(parseInt(e.target.value, 10) || 1)}
        />
      </div>
```

No test in `EmojiSection.test.tsx` asserts on these fields — confirmed by reading the test file,
which only exercises the thumbnail-click/preview flows. No test changes needed for this step.

- [ ] **Step 2: Pass the current row's assigned path into `EmojiPickerGrid`, bump thumbnail size**

In the same file, find the assignment-row block:

```tsx
              {openRow === iter && <EmojiPickerGrid onSelect={(p) => selectEmoji(iter, p)} />}
```

Replace with:

```tsx
              {openRow === iter && (
                <EmojiPickerGrid onSelect={(p) => selectEmoji(iter, p)} selectedPath={path ?? undefined} />
              )}
```

(`path` is already in scope — it's `emojiPaths[iter]`, computed a few lines above in the same
`.map()` callback.)

- [ ] **Step 3: Add `selectedPath` to `EmojiPickerGrid`, render the selected state**

Replace the full file:

```tsx
import { useEffect, useState } from "react";
import { evalTS } from "../../lib/utils/bolt";

interface EmojiFile {
  path: string;
  name: string;
}

export function EmojiPickerGrid({
  onSelect,
  selectedPath,
}: {
  onSelect: (path: string, name: string) => void;
  selectedPath?: string;
}) {
  const [files, setFiles] = useState<EmojiFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    evalTS("listEmojiFiles")
      .then((res) => setFiles(res.files))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return <div className="emoji-empty">{error}</div>;
  if (!files) return <div className="emoji-empty">Loading…</div>;
  if (files.length === 0) return <div className="emoji-empty">No emoji files found.</div>;

  return (
    <div id="emoji-picker-grid">
      {files.map((f) => (
        <div
          key={f.path}
          className={"emoji-grid-item" + (f.path === selectedPath ? " selected" : "")}
          title={f.name}
          onClick={() => onSelect(f.path, f.name)}
        >
          <img src={"file://" + f.path} alt={f.name} />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write the new `selectedPath` test**

In `EmojiPickerGrid.test.tsx`, add these two tests inside the existing `describe("EmojiPickerGrid",
...)` block (after the two existing tests):

```tsx
  it("highlights the item matching selectedPath, not the others", async () => {
    render(<EmojiPickerGrid onSelect={() => {}} selectedPath="/emojis/heart.gif" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTitle("heart.gif").className).toContain("selected");
    expect(screen.getByTitle("fire.gif").className).not.toContain("selected");
  });

  it("highlights nothing when selectedPath is not passed", async () => {
    render(<EmojiPickerGrid onSelect={() => {}} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTitle("fire.gif").className).not.toContain("selected");
    expect(screen.getByTitle("heart.gif").className).not.toContain("selected");
  });
```

- [ ] **Step 5: Write the failing-then-passing check for the new tests**

Run: `npm test -- EmojiPickerGrid`
Expected: 4 tests, all passing (the 2 existing + 2 new).

- [ ] **Step 6: Bump assignment-row thumbnail size, add selected-ring + row hover highlight**

In `main.scss`, replace `.emoji-iter-row`/`.emoji-iter-thumb`:

```scss
.emoji-iter-row {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-2;
  border-radius: $radius-sm;
  transition: background-color $transition-fast;

  &:hover {
    background-color: $surface-hover;
  }
}

.emoji-iter-thumb {
  width: 34px;
  height: 34px;
  border: 1px solid $border;
  border-radius: $radius-sm;
  background-color: $inset;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: $text-dim;
  flex-shrink: 0;

  &.has-emoji {
    border-color: $accent;
    box-shadow: 0 0 0 1px $accent;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
}
```

Replace `.emoji-grid-item` to add the selected state:

```scss
.emoji-grid-item {
  aspect-ratio: 1;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color $transition-fast;

  &:hover {
    border-color: $accent;
  }

  &.selected {
    border: 2px solid $accent;
    box-shadow: 0 0 0 1px $accent;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
}
```

- [ ] **Step 7: Add the new field-row/position-group/layer-row CSS**

Add to `main.scss`:

```scss
// ── Emoji position/size/layer fields ────────────────────────────────────

.emoji-fields-row {
  display: flex;
  gap: $space-3;
  margin-bottom: $space-3;
}

.emoji-field-label {
  display: block;
  font-size: $text-xs;
  color: $text-faint;
  margin-bottom: $space-1;
}

.emoji-field-position {
  flex: 1.4;
}

.emoji-field-size {
  flex: 0.8;
}

.emoji-field-size input[type="number"] {
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.emoji-position-group {
  display: flex;
  align-items: center;
  background-color: $inset;
  border: 1px solid $border;
  border-radius: $radius-sm;
  overflow: hidden;

  input[type="number"] {
    background: transparent;
    border: none;
    width: 100%;
    text-align: center;
    padding: 0.15rem 0.2rem;
  }
}

.emoji-axis {
  color: $text-faint;
  font-size: $text-xs;
  padding-left: $space-2;
  flex-shrink: 0;
}

.emoji-position-sep {
  width: 1px;
  height: 14px;
  background-color: $border;
  flex-shrink: 0;
}

.emoji-layer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid $border;
  padding-top: $space-3;
  margin-bottom: $space-3;
}

.emoji-layer-label {
  font-size: $text-sm;
  color: $text-dim;
}

.emoji-layer-input {
  width: 46px;
  box-sizing: border-box;
  text-align: center;
}
```

Delete the now-unused `.emoji-pos-row` rule (superseded by the classes above).

- [ ] **Step 8: Run the full test suite and build**

Run: `npm test`
Expected: all tests pass, including the 2 new `EmojiPickerGrid` tests (92 + 2 = 94 total).

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 9: Commit**

```bash
git add src/js/main/components/EmojiSection.tsx src/js/main/components/EmojiPickerGrid.tsx src/js/main/components/EmojiPickerGrid.test.tsx src/js/main/main.scss
git commit -m "Regroup emoji fields (Position+Size / Layer), bigger assignment thumbnails, picker grid selected-state"
```

---

## Task 7: Final visual verification

No code changes — confirms everything from Tasks 1–6 together matches the approved v2 mockups.

**Files:** none.

- [ ] **Step 1: Run the full automated suite one more time**

Run: `cd ae-iterations-next && npm test`
Expected: 94 tests passing.

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 2: Visual pass in a real browser**

Run: `npm run dev`, open the printed localhost URL, resize to ~300–320px width.

Verify against the approved mockups (`.superpowers/brainstorm/82985-1784543199/content/
kitchen-sink-v2.html`, `disclosure-fix.html`, `emoji-redo.html`, `emoji-fields-v2.html`):

- Every icon button, the generic `button` rule, and text/number inputs show a visible border +
  shadow at rest (no hover needed to tell they're interactive).
- The Emoji/Presets settings card shows a real iOS-style switch for Emoji and a disclosure row
  (whole row clickable, chevron rotates) for Presets — no "Open" button anywhere.
- Changelog's icon button appears below the Run button, not in the settings card.
- Iteration rows show a resting border/background and an always-visible Preview icon (no hover
  required to see it).
- Presets render as a two-column card gallery with always-visible Apply/Delete icons.
- VAR name inputs each show a number badge and a "Variant name" label above the input.
- The Emoji section shows Position (X/Y grouped) + Size in one row, with "Attach to layer" in its
  own row below a divider. Opening the picker for a row with an emoji already assigned highlights
  that same emoji in the grid.
- Per the design spec's Out of Scope section: font scanning and emoji thumbnail images are
  expected to still fail in this dev-server environment — do not treat either as a regression here.

- [ ] **Step 3: Load in After Effects**

Run: `npm run symlink` if not already symlinked, restart After Effects (or close/reopen the
panel), open the panel via Window > Extensions.

Verify the same list from Step 2 renders identically inside AE's own CEP host.

- [ ] **Step 4: Report findings**

If everything matches, this task is done — no commit (no files changed). If anything doesn't
match, note the specific discrepancy and return to the task that owns the affected file.
