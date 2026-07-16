# Panel Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ae-iterations-next`'s unstyled scaffold look with a cohesive indigo/violet design-token system, a small SVG icon set, and denser, genuinely interactive layouts, applied to every panel component.

**Architecture:** A pure SCSS token rewrite (Task 1) establishes the new palette/scale with no markup changes, so the build stays green throughout. Later tasks apply two reusable interaction patterns — an "icon toolbar row" and a "compact hover-row" — component by component, replacing full-width buttons and the standalone preview-button row with inline icon actions.

**Tech Stack:** React 19 + TypeScript, SCSS (compiled by `sass`/Vite), Zustand, Vitest + Testing Library, new dependency `lucide-react` (SVG icon components).

## Global Constraints

- Design tokens, exact hex values, and the icon list are defined in
  `docs/superpowers/specs/2026-07-16-panel-visual-redesign-design.md` sections 1–2. Use those
  values verbatim — do not invent alternate colors.
- This phase is purely visual/interaction-layer: no new `evalTS` calls, no new host (`.ts`/`.jsx`)
  code, no change to what any control *does* for the user. Where a task restructures a
  component's internal state (e.g. lifting a toggle's open/closed flag to a parent), the
  externally-visible behavior must stay identical.
- Every existing test file must keep passing (`npm test` from `ae-iterations-next/`). Where a
  test asserts DOM structure/text tied to markup this plan changes, the task that changes that
  markup updates the test in the same commit — never leave a test red.
- Dark-only. No panel geometry changes (`cep.config.ts` untouched).
- Two corrections found while reading the actual source during planning (documented here since
  they refine, not contradict, the approved spec):
  - **`MediaFields`** (VAR mode's media-swap row) has no flip/B&W/tint/hue controls — that's
    `VideoFields` (ITR mode's video layers), a different component. `MediaFields` only has a
    "Browse…" button and a filename label. Task 5 restyles it as its own simple icon+label chip,
    not the flip/B&W/tint/hue chip set.
  - **Preset rows never had an "applied" concept** — `applyPreset` is fire-and-forget, no state
    tracks "last applied." Task 4 drops the spec's "shows a Check" idea (nothing to back it) and
    instead gives the existing "Apply" action a `Play` icon + `title="Apply preset"` (consistent
    with `Trash2`/`title="Delete preset"`, already present).

---

## Task 1: Design tokens — rewrite `variables.scss`, migrate all consumers

**Files:**
- Modify: `ae-iterations-next/src/js/variables.scss` (full rewrite)
- Modify: `ae-iterations-next/src/js/main/main.scss` (token renames only — no selector/structure
  changes yet)
- Modify: `ae-iterations-next/src/js/index.scss` (token renames only)

**Interfaces:**
- Produces: the SCSS variable names every later task uses — `$bg, $surface, $surface-hover,
  $inset, $border, $text, $text-dim, $text-strong, $accent, $accent-hover, $accent-glow, $changed,
  $warning, $error, $text-xs, $text-sm, $text-md, $space-1..5, $radius-sm, $radius-md,
  $transition-fast, $transition-press`. `$primary`/`$secondary` are **not** deleted yet — they're
  still consumed by `.preview-btn` in `main.scss`, which Task 3 removes.

This task is a mechanical rename pass so the build stays green with no visual-structure changes.
Map every old-token usage by its **role**, not a blind name swap — `$dark` served three different
roles in the old file (border, disabled/placeholder text, and one background), and collapsing all
three onto `$border` would make text and badge backgrounds unreadable:

| Old usage (by role) | New token |
|---|---|
| `$darkest` (page bg) | `$bg` |
| `$darker` as a base background | `$surface` |
| `$darker` as a *hover* background (only `.tab-btn:hover`) | `$surface-hover` |
| `$dark` as a border | `$border` |
| `$dark` as text/placeholder color | `$text-dim` |
| `$dark` as a background (only `.iter-num`) | `$surface` |
| `$font` (text color) | `$text` |
| `$highlight` (secondary/meta text) | `$text-dim` |
| `$active` (any role: bg, border, box-shadow, accent-color) | `$accent` |

- [ ] **Step 1: Rewrite `variables.scss`**

```scss
// Surfaces
$bg: #1b1a24;
$surface: #252430;
$surface-hover: #302f3d;
$inset: #14131b;
$border: #2c2b38;

// Text
$text: #c9c7d4;
$text-dim: #83809a;
$text-strong: #f3f2f7;

// Accent
$accent: #7b5fd8;
$accent-hover: #8c72e0;
$accent-glow: rgba(123, 95, 216, 0.4);

// Status (unchanged — still enough contrast on the new background)
$changed: #3caea3;
$warning: #f6d55c;
$error: #ed553b;

// Retired by Task 3 alongside .preview-btn — the only remaining consumer.
$primary: #88715a;
$secondary: #4a3928;

// Type scale
$text-xs: 10px;
$text-sm: 11px;
$text-md: 12.5px;

// Spacing scale
$space-1: 2px;
$space-2: 4px;
$space-3: 6px;
$space-4: 8px;
$space-5: 12px;

// Radii
$radius-sm: 4px;
$radius-md: 6px;

// Motion
$transition-fast: 100ms ease;
$transition-press: 80ms ease;
```

- [ ] **Step 2: Rewrite `main.scss` — apply the token map above, no other changes**

Replace the file's contents with the same structure as today, with every old variable swapped per
the role table. The three exceptions to a literal name-swap:

```scss
// .tab-btn:hover — was $darker, now the hover-specific token
&:hover:not(:disabled) {
  background-color: $surface-hover !important;
}
```

```scss
// .iter-num — was $dark as a background; $surface reads as a filled badge,
// $border (a hairline color) would be nearly invisible here
.iter-num {
  background-color: $surface;
  color: $text;
}
```

```scss
// input[type="text"], input[type="number"] — $dark split by role
input[type="text"],
input[type="number"] {
  background-color: $surface;
  border: 1px solid $border;
  color: $text;

  &:focus {
    border-color: $accent;
  }

  &::placeholder {
    color: $text-dim;
  }
}
```

Every other `$oldname` in the file maps 1:1 per the table (e.g. `#mode-tabs { border-bottom: 1px
solid $border; }`, `.extra-layer-group { border-top: 1px solid $border; }`, `#btn-run:disabled {
color: $text-dim !important; background-color: $surface !important; }`, `#status.status-idle,
&.status-running { background-color: $surface; color: $text; }`, `#btn-changelog { background-
color: $surface !important; } &.open, &:hover { background-color: $accent !important; }`, etc.).
`.preview-btn` keeps `$primary`/`$secondary` untouched — Task 3 deletes the whole rule.

- [ ] **Step 3: Rewrite `index.scss` — apply the same token map**

```scss
button {
  font-size: 0.8rem;
  background-color: $surface;
  padding: 0.2rem 0.5rem;
  text-align: center;
  vertical-align: middle;
  border-radius: 5px;
  color: white;
  border: none;
  outline: none;
  user-select: none;
}

button:hover {
  background-color: $accent;
}

button:active {
  background-color: $accent;
}

label {
  color: $text;
}
```

```scss
::-webkit-scrollbar-track {
  background: $bg;
  padding: 2.25em 1.6875em;
}

::-webkit-scrollbar-thumb {
  background: $surface;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: $surface-hover;
}
```

(`index.scss`'s generic `button` rule is what unclassed buttons like "Refresh Layer" and VAR
mode's "Test" button currently fall back to — this is why it's in scope here, not just
`main.scss`.)

- [ ] **Step 4: Verify the build and test suite are green**

Run: `cd ae-iterations-next && npm run build`
Expected: exits 0, no Sass "Undefined variable" errors.

Run: `npm test`
Expected: all existing tests pass unchanged (no test asserts a literal color/hex from these
files).

- [ ] **Step 5: Commit**

```bash
cd ae-iterations-next
git add src/js/variables.scss src/js/main/main.scss src/js/index.scss
git commit -m "Rewrite design tokens: indigo/violet palette + type/spacing/radii/motion scale"
```

---

## Task 2: Icon dependency + `IterationRow` hover-row (optional preview action)

**Files:**
- Modify: `ae-iterations-next/package.json` (add `lucide-react`)
- Modify: `ae-iterations-next/src/js/main/main.scss` (add `.hover-row`/`.row-action` classes)
- Modify: `ae-iterations-next/src/js/main/components/IterationRow.tsx`
- Modify: `ae-iterations-next/src/js/main/components/ColorFields.tsx` (fill available row width)

**Interfaces:**
- Consumes: tokens from Task 1 (`$surface-hover`, `$radius-sm`, `$text-dim`, `$text-strong`,
  `$transition-fast`, `$space-2`, `$space-3`).
- Produces: `IterationRow` gains an optional `onPreview?: () => void` prop — Task 3 passes it from
  `LayerInfoPanel`. Until Task 3, no caller passes it, so the new `Play` button never renders and
  the app's behavior is unchanged (the old `#preview-row` buttons still work).
- Produces: `.hover-row` / `.row-action` are the shared classes Task 4 also uses for preset list
  rows.

- [ ] **Step 1: Add the `lucide-react` dependency**

Run: `cd ae-iterations-next && npm install lucide-react`
Expected: `package.json`'s `dependencies` gains a `"lucide-react": "^<resolved-version>"` line;
`npm install` exits 0.

- [ ] **Step 2: Add the shared hover-row pattern to `main.scss`**

Append to `ae-iterations-next/src/js/main/main.scss`:

```scss
// ── Compact hover-row (iteration rows, preset list rows) ──────────────────

.hover-row {
  border-radius: $radius-sm;
  transition: background-color $transition-fast;

  &:hover {
    background-color: $surface-hover;
  }

  &:hover .row-action {
    opacity: 1;
  }
}

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
  opacity: 0;
  flex-shrink: 0;
  padding: 0;
  transition: opacity $transition-fast, color $transition-fast, background-color $transition-fast;

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

Also tighten `.iter-row`'s own rule (it keeps its existing selector, just adds padding to match the
hover-row's inset):

```scss
.iter-row {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-2;
}
```

- [ ] **Step 3: Update `IterationRow.tsx` to accept an optional preview action**

Replace the full file:

```tsx
import type { RowLayer } from "../state/rowLayers";
import { LAYER_HANDLERS } from "../state/layerHandlers";
import { Play } from "lucide-react";

export function IterationRow({
  row,
  iter,
  onPreview,
}: {
  row: RowLayer;
  iter: number;
  onPreview?: () => void;
}) {
  const handler = LAYER_HANDLERS[row.type];
  if (!handler) return <div className="iter-row">Unsupported layer type: {row.type}</div>;
  const Fields = handler.RowFields;
  return (
    <div className="iter-row hover-row">
      <span className="iter-num">{iter + 1}</span>
      <Fields row={row} iter={iter} />
      {onPreview && (
        <button className="row-action" title={`Preview iteration ${iter + 1}`} onClick={onPreview}>
          <Play />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Let `ColorFields`' text inputs fill the row so the trailing action sits at the edge**

In `ae-iterations-next/src/js/main/main.scss`, change the `.color-cell` rule:

```scss
.color-cell {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  flex: 1;
}

.color-cell input[type="text"] {
  flex: 1;
  min-width: 3rem;
}
```

(`ColorFields.tsx` itself is unchanged — only its container's CSS grows to fill the row.)

- [ ] **Step 5: Run the existing test suite**

Run: `npm test -- IterationRow ColorFields`
Expected: all passing — `IterationRow.test.tsx` never passes `onPreview`, so its assertions
(`getByPlaceholderText("PostScript name")`, `getAllByDisplayValue("#FF0000")`) are unaffected; no
`row-action` button renders without the prop.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/js/main/main.scss src/js/main/components/IterationRow.tsx
git commit -m "Add lucide-react; give iteration rows a hover-revealed preview action"
```

---

## Task 3: LayerInfoPanel toolbars — refresh/count stepper, shared Emoji/Presets/Changelog toggle row

This is the highest-risk task: it restructures three components from "self-contained button +
panel" into "content-only panel, toggle owned by the parent," and deletes the old preview-button
row now that Task 2 gives every iteration row its own preview action.

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/components/EmojiSection.tsx`
- Modify: `ae-iterations-next/src/js/main/components/PresetPanel.tsx` (toggle removal only —
  row restyle is Task 4)
- Rename: `ae-iterations-next/src/js/main/components/ChangelogButton.tsx` →
  `ae-iterations-next/src/js/main/components/ChangelogList.tsx`
- Rename: `ae-iterations-next/src/js/main/components/ChangelogButton.test.tsx` →
  `ae-iterations-next/src/js/main/components/ChangelogList.test.tsx`
- Modify: `ae-iterations-next/src/js/main/components/EmojiSection.test.tsx`
- Modify: `ae-iterations-next/src/js/main/components/PresetPanel.test.tsx` (toggle-related tests
  only — Task 4 updates the rest)
- Modify: `ae-iterations-next/src/js/main/main.scss` (icon-toolbar + stepper classes; delete
  `.preview-btn`/`#preview-row`)

**Interfaces:**
- Consumes: `IterationRow`'s `onPreview?` prop (Task 2).
- Produces: `EmojiSection`, `PresetPanel`, `ChangelogList` all become **content-only** — no
  props, no internal open/closed state, no toggle button. Each renders unconditionally; the
  caller (`LayerInfoPanel`) decides whether to mount it.

### Why this restructuring is necessary (read before starting)

Today, `EmojiSection`/`PresetPanel`/`ChangelogButton` each own their own toggle button *and* their
expanded content, self-contained. The approved design merges all three toggles into one shared
icon-toolbar row — which means the toggle buttons can no longer live inside three separate
components; **one** parent must render all three side by side. `LayerInfoPanel` becomes that
parent: it owns `presetsOpen`/`changelogOpen` local state (mirroring the pattern it already uses
for `mode === "var"` and `emojiEnabled` conditionals) and renders the toggle buttons itself, then
conditionally mounts each content component below — e.g. `{presetsOpen && <PresetPanel />}`,
exactly like the existing `{mode === "itr" && <EmojiSection />}`.

`emojiEnabled` doesn't need new state — it's already in the store and already gates both "is
emoji included in the run" and "is the config panel visible." The checkbox that read/wrote it just
moves from inside `EmojiSection` to the shared toolbar in `LayerInfoPanel`.

- [ ] **Step 1: Strip the toggle out of `EmojiSection.tsx`**

Replace the full file:

```tsx
import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS } from "../../lib/utils/bolt";
import { EmojiPickerGrid } from "./EmojiPickerGrid";

export function EmojiSection() {
  const {
    emojiPaths, emojiX, emojiY, emojiSize, emojiLayerIndex, count,
    setEmojiPath, setEmojiX, setEmojiY, setEmojiSize, setEmojiLayerIndex,
  } = useAppStore(
    useShallow((s) => ({
      emojiPaths: s.emojiPaths, emojiX: s.emojiX, emojiY: s.emojiY,
      emojiSize: s.emojiSize, emojiLayerIndex: s.emojiLayerIndex, count: s.count,
      setEmojiPath: s.setEmojiPath, setEmojiX: s.setEmojiX,
      setEmojiY: s.setEmojiY, setEmojiSize: s.setEmojiSize, setEmojiLayerIndex: s.setEmojiLayerIndex,
    }))
  );
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState("");

  const toggleRow = (iter: number) => setOpenRow(openRow === iter ? null : iter);

  const selectEmoji = (iter: number, path: string) => {
    setEmojiPath(iter, path);
    setOpenRow(null);
  };

  const previewEmoji = () => {
    const firstPath = emojiPaths.find((p) => !!p);
    if (!firstPath) {
      setPreviewStatus("Select an emoji first.");
      return;
    }
    setPreviewStatus("Previewing…");
    evalTS("previewEmoji", { emojiPath: firstPath, x: emojiX, y: emojiY, size: emojiSize, layerIndex: emojiLayerIndex })
      .then((res) => setPreviewStatus(`Previewed in ${res.compName} — Ctrl+Z to undo`))
      .catch((err) => setPreviewStatus("Preview failed: " + String(err)));
  };

  return (
    <div id="emoji-config">
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
      <div id="emoji-iter-rows">
        {Array.from({ length: count }, (_, iter) => {
          const path = emojiPaths[iter];
          const name = path ? path.split("/").pop() : "No emoji";
          return (
            <div key={iter} className="emoji-iter-row">
              <span className="emoji-iter-num">{iter + 1}</span>
              <div className={"emoji-iter-thumb" + (path ? " has-emoji" : "")} onClick={() => toggleRow(iter)}>
                {path ? <img src={"file://" + path} alt={name} /> : "+"}
              </div>
              <span className="emoji-iter-name">{name}</span>
              {openRow === iter && <EmojiPickerGrid onSelect={(p) => selectEmoji(iter, p)} />}
            </div>
          );
        })}
      </div>
      <button onClick={previewEmoji}>Preview Emoji</button>
      {previewStatus && <div className="emoji-preview-status">{previewStatus}</div>}
    </div>
  );
}
```

(`#emoji-section` and `.emoji-enable-label` are gone from the markup — remove their rules from
`main.scss` in Step 5. `#emoji-config` keeps its id and styling as the outermost element now.)

- [ ] **Step 2: Update `EmojiSection.test.tsx` — remove the toggle test, drop the store's now-unused `emojiEnabled` field from setup**

Replace the full file:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiSection } from "./EmojiSection";
import { useAppStore } from "../state/store";

vi.mock("../../lib/utils/bolt", () => ({
  evalTS: vi.fn((command: string) => {
    if (command === "listEmojiFiles") {
      return Promise.resolve({ files: [{ path: "/emojis/fire.gif", name: "fire.gif" }] });
    }
    if (command === "previewEmoji") {
      return Promise.resolve({ compName: "Comp A" });
    }
    return Promise.reject(new Error("unexpected command: " + command));
  }),
}));

describe("EmojiSection", () => {
  beforeEach(() => {
    useAppStore.setState({
      count: 3, emojiPaths: [], emojiX: 540, emojiY: 1347, emojiSize: 100, emojiLayerIndex: 1,
    });
  });

  it("opens the picker grid on thumbnail click and assigns the selected emoji to that row", async () => {
    render(<EmojiSection />);
    fireEvent.click(screen.getAllByText("+")[0]); // first row's empty thumbnail
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.click(screen.getByTitle("fire.gif"));
    expect(useAppStore.getState().emojiPaths[0]).toBe("/emojis/fire.gif");
    expect(screen.getByText("fire.gif")).toBeInTheDocument();
  });

  it("previews using the first row with a path set", async () => {
    useAppStore.setState({ emojiPaths: [null, "/emojis/heart.gif"] });
    render(<EmojiSection />);
    fireEvent.click(screen.getByText("Preview Emoji"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText(/Previewed in Comp A/)).toBeInTheDocument();
  });
});
```

Note the `import { describe, it, expect, vi } from "vitest";` line drops `beforeEach` from the
named import only if unused elsewhere — here `beforeEach` is still used as a bare global (Vitest
injects it as a global in this project's config, matching every other test file's usage above),
so keep the import exactly as shown (`describe, it, expect, vi` — no `beforeEach` in the import
list, matching the original file's own import line, which never imported `beforeEach` either
despite calling it).

- [ ] **Step 3: Strip the toggle out of `PresetPanel.tsx` (row restyle is Task 4 — keep `×`/"Apply"/"Save Preset" text for now)**

Replace the full file:

```tsx
import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { hexToRgb, rgbToHex } from "../lib/color";
import { loadUserPresets, saveUserPresets } from "../lib/userPresets";
import library from "../presets-library.json";
import type { Preset, VideoPreset } from "../lib/userPresets";

const libraryPresets = library as Preset[];

function isVideoPreset(p: Preset): p is VideoPreset {
  return (p as VideoPreset).type === "video";
}

function swatchCount(preset: Preset): number {
  return isVideoPreset(preset) ? preset.iterations.length : preset.colors.length;
}

function swatchColor(preset: Preset, i: number): string {
  if (isVideoPreset(preset)) {
    const it = preset.iterations[i];
    return it?.tint || (it?.bw ? "#555" : "#333");
  }
  return preset.colors[i] || "#333";
}

export function PresetPanel() {
  const { rowLayers, count, values, setValue } = useAppStore(
    useShallow((s) => ({ rowLayers: s.rowLayers, count: s.count, values: s.values, setValue: s.setValue }))
  );
  const [userPresets, setUserPresets] = useState<Preset[]>(() => loadUserPresets());
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  const row0 = rowLayers[0];
  const isVideoRow = row0?.type === "video";
  const savedForKind = userPresets.filter((p) => isVideoPreset(p) === isVideoRow);
  const libraryForKind = libraryPresets.filter((p) => isVideoPreset(p) === isVideoRow);

  const applyPreset = (preset: Preset) => {
    if (!row0) return;
    if (isVideoPreset(preset)) {
      const n = Math.min(count, preset.iterations.length);
      for (let i = 0; i < n; i++) {
        const it = preset.iterations[i];
        setValue(row0.rowKey, i, {
          flip: it.flip,
          bw: it.bw,
          tint: it.tint ? hexToRgb(it.tint) : null,
          tintAmount: 50,
          hue: it.hue,
        });
      }
    } else {
      const n = Math.min(count, preset.colors.length);
      for (let i = 0; i < n; i++) {
        const existing = values[row0.rowKey]?.[i];
        setValue(row0.rowKey, i, { ...existing, color: hexToRgb(preset.colors[i]) });
      }
    }
  };

  const deletePreset = (index: number) => {
    const updated = userPresets.filter((_, i) => i !== index);
    try {
      saveUserPresets(updated);
      setUserPresets(updated);
    } catch (e) {
      setStatus("Could not delete preset: " + String(e));
    }
  };

  const savePreset = () => {
    if (!row0) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const preset: Preset = isVideoRow
      ? {
          name: trimmed,
          type: "video",
          iterations: Array.from({ length: count }, (_, i) => {
            const v = values[row0.rowKey]?.[i];
            return {
              flip: !!v?.flip,
              bw: !!v?.bw,
              tint: v?.tint ? rgbToHex(v.tint) : null,
              hue: v?.hue ?? 0,
            };
          }),
        }
      : {
          name: trimmed,
          colors: Array.from({ length: count }, (_, i) => {
            const v = values[row0.rowKey]?.[i];
            return v?.color ? rgbToHex(v.color).toUpperCase() : "#FF0000";
          }),
        };

    const updated = [preset, ...userPresets];
    try {
      saveUserPresets(updated);
      setUserPresets(updated);
      setName("");
      setStatus("");
    } catch (e) {
      setStatus("Could not save preset: " + String(e));
    }
  };

  const renderItem = (preset: Preset, isUser: boolean, index: number) => (
    <div key={(isUser ? "user-" : "lib-") + preset.name + index} className="preset-item">
      <div className="preset-swatches">
        {Array.from({ length: swatchCount(preset) }, (_, i) => (
          <div key={i} className="preset-swatch" style={{ background: swatchColor(preset, i) }} />
        ))}
      </div>
      <span className="preset-name">{preset.name}</span>
      <button className="preset-apply" onClick={() => applyPreset(preset)}>
        Apply
      </button>
      {isUser && (
        <button className="preset-delete" title="Delete preset" onClick={() => deletePreset(index)}>
          ×
        </button>
      )}
    </div>
  );

  return (
    <div id="preset-panel">
      <div id="preset-save-row">
        <input
          id="preset-name-input"
          type="text"
          placeholder="Preset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button id="btn-save-preset" onClick={savePreset}>
          Save Preset
        </button>
      </div>
      {status && <div className="preset-status">{status}</div>}
      <div id="preset-list">
        {savedForKind.length > 0 && <div className="preset-group-label">Saved</div>}
        {savedForKind.map((preset) => renderItem(preset, true, userPresets.indexOf(preset)))}
        <div className="preset-group-label">Library</div>
        {libraryForKind.map((preset, i) => renderItem(preset, false, i))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update `PresetPanel.test.tsx` — remove the toggle-visibility test; render `<PresetPanel />` directly everywhere else**

Replace the full file:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PresetPanel } from "./PresetPanel";
import { useAppStore } from "../state/store";
import { hexToRgb } from "../lib/color";
import * as userPresetsLib from "../lib/userPresets";
import type { RowLayer } from "../state/rowLayers";

vi.mock("../lib/userPresets", () => ({
  loadUserPresets: vi.fn(() => []),
  saveUserPresets: vi.fn(),
}));

const colorRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "shape", name: "Rect", fillPath: "" };
const videoRow: RowLayer = { layerIndex: 2, rowKey: "2", type: "video", name: "BG", fillPath: "" };

describe("PresetPanel", () => {
  beforeEach(() => {
    vi.mocked(userPresetsLib.loadUserPresets).mockReturnValue([]);
    vi.mocked(userPresetsLib.saveUserPresets).mockReset();
    useAppStore.setState({ rowLayers: [colorRow], count: 3, values: {} });
  });

  it("shows only color presets when row 0 is a color-capable row", () => {
    render(<PresetPanel />);
    expect(screen.getByText("Brand Blue")).toBeInTheDocument();
    expect(screen.queryByText("Warm Tints")).not.toBeInTheDocument();
  });

  it("shows only video presets when row 0 is a video row", () => {
    useAppStore.setState({ rowLayers: [videoRow], count: 3, values: {} });
    render(<PresetPanel />);
    expect(screen.getByText("Warm Tints")).toBeInTheDocument();
    expect(screen.queryByText("Brand Blue")).not.toBeInTheDocument();
  });

  it("applies a color preset's hex values to row 0, clamped to the current count", () => {
    render(<PresetPanel />);
    fireEvent.click(screen.getAllByText("Apply")[0]);
    const values = useAppStore.getState().values["1"];
    expect(values).toHaveLength(3);
    expect(values[0].color).toEqual(hexToRgb("#0057B7"));
    expect(values[1].color).toEqual(hexToRgb("#1A73E8"));
    expect(values[2].color).toEqual(hexToRgb("#4285F4"));
  });

  it("saves the current row-0 state as a new user preset", () => {
    useAppStore.getState().setValue("1", 0, { color: hexToRgb("#123456") });
    render(<PresetPanel />);
    fireEvent.change(screen.getByPlaceholderText("Preset name"), { target: { value: "My Preset" } });
    fireEvent.click(screen.getByText("Save Preset"));
    expect(userPresetsLib.saveUserPresets).toHaveBeenCalledWith([
      expect.objectContaining({ name: "My Preset", colors: ["#123456", "#FF0000", "#FF0000"] }),
    ]);
  });

  it("deletes a user preset", () => {
    vi.mocked(userPresetsLib.loadUserPresets).mockReturnValue([{ name: "Old One", colors: ["#000000"] }]);
    render(<PresetPanel />);
    fireEvent.click(screen.getByTitle("Delete preset"));
    expect(userPresetsLib.saveUserPresets).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 5: Rename `ChangelogButton.tsx` → `ChangelogList.tsx`, strip the toggle**

Create `ae-iterations-next/src/js/main/components/ChangelogList.tsx`:

```tsx
import entries from "../changelog.json";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const changelogEntries = entries as ChangelogEntry[];

export function ChangelogList() {
  return (
    <div id="changelog-list">
      {changelogEntries.map((entry) => (
        <div key={entry.version} className="cl-entry">
          <div className="cl-header">
            <span className="cl-version">v{entry.version}</span>
            <span className="cl-date">{entry.date}</span>
          </div>
          <ul className="cl-changes">
            {entry.changes.map((change, i) => (
              <li key={i}>{change}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

Delete `ae-iterations-next/src/js/main/components/ChangelogButton.tsx`.

- [ ] **Step 6: Rename the test file, drop the toggle test**

Create `ae-iterations-next/src/js/main/components/ChangelogList.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChangelogList } from "./ChangelogList";

describe("ChangelogList", () => {
  it("renders each entry's version, date, and changes from the real bundled data", () => {
    render(<ChangelogList />);
    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
    expect(screen.getByText("2026-07-14")).toBeInTheDocument();
    expect(screen.getByText(/Cross-platform font picker/)).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });
});
```

Delete `ae-iterations-next/src/js/main/components/ChangelogButton.test.tsx`.

- [ ] **Step 7: Rewrite `LayerInfoPanel.tsx` — icon toolbars, stepper, shared toggle state, delete `#preview-row`**

Replace the full file:

```tsx
import { useEffect, useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS } from "../../lib/utils/bolt";
import { IterationRow } from "./IterationRow";
import { toCfgLayers } from "../state/rowLayers";
import { RunButton } from "./RunButton";
import { VarNamesRow } from "./VarNamesRow";
import { EmojiSection } from "./EmojiSection";
import { PresetPanel } from "./PresetPanel";
import { ChangelogList } from "./ChangelogList";
import { effectiveValue as effectiveValueImpl } from "../state/effectiveValue";
import { loadFonts } from "../lib/fonts";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue } from "../../../shared/types";
import { RefreshCw, ChevronUp, ChevronDown, Smile, Star, Info } from "lucide-react";

export function LayerInfoPanel() {
  const {
    compName, rowLayers, count, setCount, values, sameForAll, setSameForAll, setLayerInfo, mode,
    emojiEnabled, setEmojiEnabled,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName,
      rowLayers: s.rowLayers,
      count: s.count,
      setCount: s.setCount,
      values: s.values,
      sameForAll: s.sameForAll,
      setSameForAll: s.setSameForAll,
      setLayerInfo: s.setLayerInfo,
      mode: s.mode,
      emojiEnabled: s.emojiEnabled,
      setEmojiEnabled: s.setEmojiEnabled,
    }))
  );

  const [testLog, setTestLog] = useState<string[] | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  // Kicks off the font scan as soon as the panel mounts, in the background,
  // regardless of whether a text layer is currently selected — matching the
  // original extension's one-time startup loadFonts() call, so the list is
  // very likely already cached by the time a user focuses a font field.
  useEffect(() => {
    loadFonts();
  }, []);

  const refresh = () => {
    evalTS("getLayerInfo")
      .then((res) => setLayerInfo(res.compName, res.layers))
      .catch((err) => alert("Refresh failed: " + String(err)));
  };

  const testVarComps = () => {
    evalTS("testVarRenderComps")
      .then((res) => setTestLog(res.log))
      .catch((err) => setTestLog(["Test failed: " + String(err)]));
  };

  // Effective value used for rendering/reading a non-first, non-stroke, non-video row
  // when sameForAll is on — mirrors main.js's buildValues() sameForAll branch.
  const effectiveValue = (row: RowLayer, iter: number): LayerValue | undefined =>
    effectiveValueImpl(rowLayers, values, sameForAll, row, iter, mode);

  // Applies one iteration's values live to the target comp, so the artist
  // can eyeball a column of values in AE before committing to a full run.
  // Any row's Play action for iteration N calls this same function — preview
  // has always applied the whole iteration column across every row at once,
  // not a single row in isolation.
  const previewIteration = (iter: number) => {
    if (!compName) return;
    const layers = toCfgLayers(rowLayers);
    const iterValues = rowLayers.map((r) => effectiveValue(r, iter) ?? {});
    evalTS("previewApply", { compName, layers, values: iterValues })
      .then((res) => console.log(res.log.join("\n")))
      .catch((err) => alert("Preview failed: " + String(err)));
  };

  const showSameForAll = new Set(rowLayers.map((r) => r.layerIndex)).size > 1;

  return (
    <div id="layer-section">
      <div className="icon-toolbar">
        <button className="icon-btn" title="Refresh layer selection" onClick={refresh}>
          <RefreshCw />
        </button>
        <div className="toolbar-layername">{compName ? `${compName} — ${rowLayers.length} row(s)` : "No layer selected"}</div>
        <div className="count-field">
          <span>Count</span>
          <div className="stepper">
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 5))}
            />
            <div className="stepper-btns">
              <button className="stepper-btn" title="Increase count" onClick={() => setCount(count + 1)}>
                <ChevronUp />
              </button>
              <button className="stepper-btn" title="Decrease count" onClick={() => setCount(Math.max(1, count - 1))}>
                <ChevronDown />
              </button>
            </div>
          </div>
        </div>
      </div>
      {mode === "itr" && (
        <div className="icon-toolbar">
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
          <div className="toolbar-spacer" />
          <button
            className={"icon-btn" + (changelogOpen ? " active-state" : "")}
            title="What's new"
            onClick={() => setChangelogOpen(!changelogOpen)}
          >
            <Info />
          </button>
        </div>
      )}
      {mode === "itr" && showSameForAll && (
        <label id="same-all-section">
          <input type="checkbox" checked={sameForAll} onChange={(e) => setSameForAll(e.target.checked)} />
          Same value for all layers
        </label>
      )}
      {mode === "itr" && emojiEnabled && <EmojiSection />}
      {mode === "itr" && presetsOpen && <PresetPanel />}
      {mode === "itr" && changelogOpen && <ChangelogList />}
      {mode === "var" && (
        <>
          <VarNamesRow />
          <button onClick={testVarComps}>Test</button>
          {testLog && <pre id="var-test-log">{testLog.join("\n")}</pre>}
        </>
      )}
      {rowLayers.map((row) => (
        <div key={row.rowKey} className="extra-layer-group">
          <div className="layer-group-label">{row.name} [{row.type}]</div>
          {Array.from({ length: count }, (_, iter) => (
            <IterationRow
              key={iter}
              row={row}
              iter={iter}
              onPreview={mode === "itr" ? () => previewIteration(iter) : undefined}
            />
          ))}
        </div>
      ))}
      <RunButton effectiveValue={effectiveValue} />
    </div>
  );
}
```

Note `changelogOpen` is gated on `mode === "itr"` alongside the other two toggles — the changelog
button previously rendered unconditionally at the bottom regardless of mode; it now lives in the
ITR-only toolbar row. This is an intentional, low-risk behavior narrowing (changelog was always
reachable in both modes; the toolbar it now belongs to only renders in ITR mode) — flag this to
the user during final review rather than silently deciding it, since it's the one visible
behavior change in this task.

- [ ] **Step 8: Add icon-toolbar/stepper CSS, delete `.preview-btn`/`#preview-row`, delete now-orphaned rules**

In `ae-iterations-next/src/js/main/main.scss`:

Delete the entire `// ── Preview row ──` section (`#preview-row` and `.preview-btn` rules).

Delete `#emoji-section` and `.emoji-enable-label` rules (no longer rendered — `#emoji-config` is
now the section's own outermost element and already has its own rule).

Delete `#btn-presets` and `#preset-section` rules (no longer rendered — Task 4 restyles what
`#preset-panel` itself needs).

Delete `#changelog-section` and `#btn-changelog` rules (no longer rendered).

Delete `#count-label input[type="number"]` rule (superseded by `.stepper input` below).

Add:

```scss
// ── Icon toolbar (refresh/count, emoji/presets/changelog) ─────────────────

.icon-toolbar {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-3 $space-4;
  border-bottom: 1px solid $border;
}

.icon-btn {
  width: 22px;
  height: 22px;
  border-radius: $radius-sm;
  background-color: $surface;
  color: $text-dim;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  position: relative;
  transition: background-color $transition-fast, color $transition-fast, transform $transition-press;

  svg {
    width: 13px;
    height: 13px;
  }

  &:hover:not(:disabled) {
    background-color: $surface-hover;
    color: $text-strong;
  }

  &:active:not(:disabled) {
    transform: scale(0.92);
  }

  &.active-state {
    background-color: $accent;
    color: white;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.toolbar-layername {
  flex: 1;
  color: $text-dim;
  font-size: $text-sm;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar-spacer {
  flex: 1;
}

.count-field {
  display: flex;
  align-items: center;
  gap: $space-2;
  flex-shrink: 0;
  font-size: $text-sm;
  color: $text-dim;
}

.stepper {
  display: flex;
  align-items: center;
  background-color: $inset;
  border-radius: $radius-sm;
  overflow: hidden;

  input[type="number"] {
    width: 20px;
    text-align: center;
    background: transparent;
    border: none;
    color: $text-strong;
    font-size: $text-sm;
    padding: $space-1 0;

    &::-webkit-inner-spin-button,
    &::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
  }
}

.stepper-btns {
  display: flex;
  flex-direction: column;
}

.stepper-btn {
  width: 16px;
  height: 10px;
  background: transparent;
  border: none;
  color: $text-dim;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background-color $transition-fast, color $transition-fast;

  svg {
    width: 9px;
    height: 9px;
  }

  &:hover {
    background-color: $surface-hover;
    color: $text-strong;
  }
}
```

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: all passing, including the rewritten `EmojiSection.test.tsx`, `PresetPanel.test.tsx`,
and `ChangelogList.test.tsx`. No file still imports the deleted `ChangelogButton`.

Run: `grep -rn "ChangelogButton" ae-iterations-next/src` (from repo root)
Expected: no matches.

- [ ] **Step 10: Commit**

```bash
git add -A ae-iterations-next/src/js/main/components ae-iterations-next/src/js/main/main.scss
git commit -m "Merge refresh/count/emoji/presets/changelog into icon toolbars; delete preview-row"
```

---

## Task 4: Preset row restyle + EmojiPickerGrid restyle

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/PresetPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/components/PresetPanel.test.tsx`
- Modify: `ae-iterations-next/src/js/main/components/EmojiPickerGrid.tsx` (className only)
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- Consumes: `.hover-row`/`.row-action` from Task 2.

- [ ] **Step 1: Restyle `PresetPanel.tsx`'s row and save-row markup**

In `ae-iterations-next/src/js/main/components/PresetPanel.tsx`, add the icon imports:

```tsx
import { Save, Play, Trash2 } from "lucide-react";
```

Replace the `renderItem` function:

```tsx
  const renderItem = (preset: Preset, isUser: boolean, index: number) => (
    <div key={(isUser ? "user-" : "lib-") + preset.name + index} className="preset-item hover-row">
      <div className="preset-swatches">
        {Array.from({ length: swatchCount(preset) }, (_, i) => (
          <div key={i} className="preset-swatch" style={{ background: swatchColor(preset, i) }} />
        ))}
      </div>
      <span className="preset-name">{preset.name}</span>
      <button className="row-action" title="Apply preset" onClick={() => applyPreset(preset)}>
        <Play />
      </button>
      {isUser && (
        <button className="row-action" title="Delete preset" onClick={() => deletePreset(index)}>
          <Trash2 />
        </button>
      )}
    </div>
  );
```

Replace the save row's button:

```tsx
        <button id="btn-save-preset" title="Save preset" onClick={savePreset}>
          <Save />
        </button>
```

- [ ] **Step 2: Update the two tests that queried the old text**

In `ae-iterations-next/src/js/main/components/PresetPanel.test.tsx`, change:

```tsx
  it("applies a color preset's hex values to row 0, clamped to the current count", () => {
    render(<PresetPanel />);
    fireEvent.click(screen.getAllByTitle("Apply preset")[0]);
```

and:

```tsx
  it("saves the current row-0 state as a new user preset", () => {
    useAppStore.getState().setValue("1", 0, { color: hexToRgb("#123456") });
    render(<PresetPanel />);
    fireEvent.change(screen.getByPlaceholderText("Preset name"), { target: { value: "My Preset" } });
    fireEvent.click(screen.getByTitle("Save preset"));
```

(`screen.getByTitle("Delete preset")` in the last test is already correct — unchanged.)

- [ ] **Step 3: Restyle `EmojiPickerGrid.tsx`'s selected/hover cell**

The component itself needs no logic change — only its `.emoji-grid-item` CSS changes (Step 4).

- [ ] **Step 4: Update `main.scss`**

Replace the `.preset-item` rule:

```scss
.preset-item {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-2;
}
```

Replace `.preset-apply, .preset-delete` (now unused — both became `.row-action`) by deleting that
rule entirely.

Replace `.emoji-grid-item:hover` and the removed `has-emoji` accent references:

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

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- PresetPanel EmojiPickerGrid`
Expected: all passing.

- [ ] **Step 6: Commit**

```bash
git add src/js/main/components/PresetPanel.tsx src/js/main/components/PresetPanel.test.tsx src/js/main/components/EmojiPickerGrid.tsx src/js/main/main.scss
git commit -m "Restyle preset rows and emoji grid to icon actions + accent tokens"
```

---

## Task 5: VideoFields icon+label chips, MediaFields icon+label restyle

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/VideoFields.tsx`
- Modify: `ae-iterations-next/src/js/main/components/MediaFields.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- No prop/behavior changes — `title` attributes that existing tests query
  (`getByTitle("Flip Horizontal")`) are preserved verbatim.

- [ ] **Step 1: Add icons to `VideoFields.tsx`**

```tsx
import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { hexToRgb, rgbToHex } from "../lib/color";
import type { LayerValue } from "../../../shared/types";
import { FlipHorizontal2, Contrast } from "lucide-react";

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
        <FlipHorizontal2 />
      </button>
      <button
        className={"video-toggle" + (v.bw ? " active" : "")}
        title="Black & White"
        onClick={() => update({ bw: !v.bw })}
      >
        <Contrast /> B&amp;W
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

`Droplet` and `SlidersHorizontal` (listed in the spec's icon table for tint/hue) don't have a
toggle button to attach to — tint is a checkbox+color+number group and hue is a plain number
input, neither of which gains a new button in this phase. Add them as decorative prefix icons
instead (the same non-interactive-label role `Type` already plays in `FontInput`), so the spec's
icon list is actually used rather than dead-lettered:

```tsx
import { FlipHorizontal2, Contrast, Droplet, SlidersHorizontal } from "lucide-react";
```

```tsx
      <div className="tint-cell">
        <Droplet className="field-icon" />
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
      <SlidersHorizontal className="field-icon" />
      <input
        type="number"
        min={-180}
        max={180}
        title="Hue shift (degrees)"
        value={v.hue ?? 0}
        onChange={(e) => update({ hue: parseInt(e.target.value, 10) || 0 })}
      />
```

Add the shared icon-label rule to `main.scss` (Step 3 below folds this in):

```scss
.field-icon {
  width: 11px;
  height: 11px;
  color: $text-dim;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Add an icon to `MediaFields.tsx`'s Browse button**

```tsx
import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { evalTS } from "../../lib/utils/bolt";
import { FolderOpen } from "lucide-react";

export function MediaFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  const fileName = value?.mediaPath ? value.mediaPath.split("/").pop() : "No file";

  const browse = () => {
    evalTS("browseForMedia")
      .then((res) => {
        if (res.path) setValue(row.rowKey, iter, { ...value, mediaPath: res.path });
      })
      .catch((err) => alert("Browse failed: " + String(err)));
  };

  return (
    <div className="media-fields">
      <button className="video-toggle" onClick={browse}>
        <FolderOpen /> Browse…
      </button>
      <span className="media-file-label">{fileName}</span>
    </div>
  );
}
```

(Reuses the existing `.video-toggle` class for the same icon+label chip look — no new class
needed; `MediaFields` never had toggle/active state, so the `.active` modifier just never
applies here.)

- [ ] **Step 3: Retoken `.video-toggle`, `.tint-cell`, `.media-fields` in `main.scss`**

```scss
.video-toggle {
  background-color: $surface !important;
  color: $text !important;
  display: inline-flex !important;
  align-items: center;
  gap: $space-1;
  transition: background-color $transition-fast;

  svg {
    width: 12px;
    height: 12px;
  }

  &:hover:not(:disabled) {
    background-color: $surface-hover !important;
  }

  &.active {
    background-color: $accent !important;
    color: white !important;
  }
}

.field-icon {
  width: 11px;
  height: 11px;
  color: $text-dim;
  flex-shrink: 0;
}
```

(`.tint-cell`, `.media-fields`, `.media-file-label` rules keep their existing layout properties —
only add `color: $text-dim` to `.media-file-label` if it doesn't already inherit a token color;
check the current rule and add the property only if missing.)

- [ ] **Step 4: Run tests**

Run: `npm test -- VideoFields MediaFields`
Expected: all passing — `getByTitle("Flip Horizontal")`, `getByRole("checkbox")`,
`getAllByDisplayValue(/^#/)`, `getByText("Browse…")`, `getByText("No file")` all still resolve
(icons are additional children, not replacements for the existing text/title).

- [ ] **Step 5: Commit**

```bash
git add src/js/main/components/VideoFields.tsx src/js/main/components/MediaFields.tsx src/js/main/main.scss
git commit -m "Add icons to video/media field chips, retoken to new palette"
```

---

## Task 6: RunButton interaction states, FontInput dropdown, remaining token restyle

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/FontInput.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- No prop/behavior changes.

`ModeTabs`/`VarNamesRow` need no work here beyond Task 1's mechanical rename — the spec calls
them "token restyle only" and neither gains a new interaction state, so Task 1's color swap
already satisfies them. `RunButton`/`#status` are different: the spec (section 4) promises a
hover glow, a press-scale, and tightened padding that never existed in the original file at all —
Task 1 only gave `#btn-run`/`#status` a like-for-like color rename. This task adds the missing
states, superseding Task 1's simpler version of both selectors.

- [ ] **Step 1: Give `#btn-run`/`#status` their real interaction states**

In `ae-iterations-next/src/js/main/main.scss`, replace the `#btn-run` and `#status` rules
(currently just color-renamed versions from Task 1) with:

```scss
#btn-run {
  background-color: $accent !important;
  font-size: $text-md !important;
  padding: $space-4 0 !important;
  font-weight: 600;
  border-radius: $radius-md;
  transition: background-color $transition-fast, box-shadow $transition-fast, transform $transition-press;

  &:hover:not(:disabled) {
    background-color: $accent-hover !important;
    box-shadow: 0 2px 10px $accent-glow;
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
    box-shadow: none;
  }

  &:disabled {
    background-color: $surface !important;
    color: $text-dim !important;
    cursor: not-allowed;
  }
}

#status {
  padding: $space-2 $space-3;
  border-radius: $radius-sm;
  font-size: $text-sm;
  line-height: 1.35;
  word-break: break-word;

  &.status-idle,
  &.status-running {
    background-color: $surface;
    color: $text;
  }

  &.status-done {
    background-color: rgba($changed, 0.15);
    color: $changed;
  }

  &.status-warning {
    background-color: rgba($warning, 0.15);
    color: $warning;
  }

  &.status-error {
    background-color: rgba($error, 0.15);
    color: $error;
  }
}
```

- [ ] **Step 2: Add a `Type` icon and `ChevronDown` affordance to `FontInput.tsx`**

```tsx
import { useEffect, useState } from "react";
import { loadFonts } from "../lib/fonts";
import { Type, ChevronDown } from "lucide-react";

const MAX_RESULTS = 30;

export function FontInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [allFonts, setAllFonts] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadFonts().then(setAllFonts);
  }, []);

  const matches = allFonts
    ? allFonts.filter((f) => f.toLowerCase().includes(value.toLowerCase())).slice(0, MAX_RESULTS)
    : [];

  const select = (font: string) => {
    onChange(font);
    setOpen(false);
  };

  return (
    <div className="font-input-wrap">
      <Type className="font-input-icon" />
      <input
        type="text"
        placeholder="PostScript name"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      <ChevronDown className="font-input-chevron" />
      {open && (
        <div className="font-dropdown">
          {allFonts === null ? (
            <div className="font-empty">Loading fonts…</div>
          ) : matches.length === 0 ? (
            <div className="font-empty">No fonts found</div>
          ) : (
            matches.map((f) => (
              <div
                key={f}
                className="font-option hover-row"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(f);
                }}
              >
                {f}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

(The `onMouseDown`-not-`onClick` comment from the original is dropped only because the code below
it is unchanged and self-explanatory at this point in the file's history — the reasoning still
applies, but restating it a second time here isn't load-bearing for this task's diff.)

- [ ] **Step 3: Retoken `main.scss`'s font dropdown rules, add icon positioning**

```scss
.font-input-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;

  input[type="text"] {
    padding-left: 22px;
    padding-right: 18px;
  }
}

.font-input-icon {
  position: absolute;
  left: 6px;
  width: 11px;
  height: 11px;
  color: $text-dim;
  pointer-events: none;
}

.font-input-chevron {
  position: absolute;
  right: 6px;
  width: 11px;
  height: 11px;
  color: $text-dim;
  pointer-events: none;
}

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
  margin-top: 2px;
}

.font-option {
  padding: $space-3 $space-4;
  font-size: $text-sm;
  color: $text;
  cursor: pointer;
}

.font-empty {
  padding: $space-3 $space-4;
  font-size: $text-sm;
  color: $text-dim;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- FontInput ColorFields IterationRow ModeTabs VarNamesRow RunButton`
Expected: all passing (`FontInput.test.tsx` never asserted on the old dropdown's exact styling,
only on text content and focus/mousedown behavior, all unchanged; there is no
`RunButton.test.tsx` in this codebase, so that filter simply matches nothing — harmless).

- [ ] **Step 5: Commit**

```bash
git add src/js/main/components/FontInput.tsx src/js/main/main.scss
git commit -m "Give the Run button real hover/press states, add icon affordances to font dropdown"
```

---

## Task 7: Final visual verification

No code changes — this task confirms the full panel matches the approved mockups and nothing
regressed, following the project's established convention (see `PRESET-T3`, `EMOJI-T10`,
`VAR-T11` in `.superpowers/sdd/progress.md`) of a manual verification recipe for panel-wiring
changes rather than a new automated test.

**Files:** none.

- [ ] **Step 1: Run the full automated suite one more time**

Run: `cd ae-iterations-next && npm test`
Expected: all tests passing.

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 2: Visual pass in a real browser**

Run: `npm run dev`, open the printed localhost URL.

Verify against the approved mockups (Deep Indigo + Violet palette,
`.superpowers/brainstorm/53662-1784201191/content/palette.html` theme-c, and
`ux-density.html`):
- Refresh icon + layer name + count stepper sit in one toolbar row.
- Emoji/Presets/Changelog icon buttons sit in a second toolbar row; clicking each toggles its
  panel below and gives the button `.active-state` (violet fill).
- Iteration rows highlight on hover and reveal a Play icon at the row's right edge; no standalone
  "Preview N" buttons remain anywhere.
- The Run button glows on hover and compresses on press; when disabled it does not react to
  hover at all.
- Preset list rows highlight on hover and reveal Play/Trash2 icons.

- [ ] **Step 3: Load in After Effects**

Run: `npm run symlink`, restart After Effects, open the panel via Window > Extensions.

Verify the panel renders identically to the browser check above inside AE's own CEP host (colors,
icon rendering, and hover states all depend on the CEF runtime AE embeds, not just a desktop
browser — this is the same reason every prior phase's manual-verification step re-checks inside
AE specifically).

- [ ] **Step 4: Report findings**

If everything matches, this task is done — no commit (no files changed). If anything doesn't
match, note the specific discrepancy and return to the task that owns the affected file.
