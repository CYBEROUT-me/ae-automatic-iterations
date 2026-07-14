# Changelog Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "what's new" changelog panel to `ae-iterations-next` — a small info-button toggle that shows this rewrite's version history, matching the original `extension/`'s feature.

**Architecture:** A static `changelog.json` bundled as a direct TypeScript/Vite JS import (no runtime file read, no Node dependency) feeds a single self-contained `ChangelogButton` component rendered unconditionally in the panel.

**Tech Stack:** BoltCEP (React + TypeScript + Vite), Vitest + React Testing Library.

**Design spec:** `docs/superpowers/specs/2026-07-13-ae-iterations-changelog-panel-design.md`

## Global Constraints

- Bundled as a direct JS import (`import entries from "../changelog.json"`) — no `fs`, no
  `cs.getSystemPath`, no runtime file read. `tsconfig.json` already has `resolveJsonModule: true`.
- Content: 4 entries documenting this rewrite's own phases (ITR core, VAR mode, emoji overlay,
  font picker), with dates verified against real git history — not the original `extension/`'s
  unrelated 1.0.x history.
- Rendered unconditionally — no `mode === "itr"`/`"var"` gating.
- Gets real Vitest + React Testing Library tests — this is pure panel-side rendering logic with
  a static data import, no AE object model, no Node dependency.
- No change to the current production `extension/` — this phase applies only to
  `ae-iterations-next`.

---

### Task 1: `changelog.json` + `ChangelogButton` component + wiring

**Files:**
- Create: `ae-iterations-next/src/js/main/changelog.json`
- Create: `ae-iterations-next/src/js/main/components/ChangelogButton.tsx`
- Create: `ae-iterations-next/src/js/main/components/ChangelogButton.test.tsx`
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/package.json`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- Produces: `ChangelogButton()` — no props, no exports beyond the component itself. Consumed by
  `LayerInfoPanel.tsx`.

- [ ] **Step 1: Create the changelog data**

Create `ae-iterations-next/src/js/main/changelog.json`:

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

- [ ] **Step 2: Write the failing tests**

Create `ae-iterations-next/src/js/main/components/ChangelogButton.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChangelogButton } from "./ChangelogButton";

describe("ChangelogButton", () => {
  it("hides the entry list until the info button is clicked", () => {
    render(<ChangelogButton />);
    expect(screen.queryByText("v0.4.0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("What's new"));
    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
  });

  it("renders each entry's version, date, and changes from the real bundled data", () => {
    render(<ChangelogButton />);
    fireEvent.click(screen.getByTitle("What's new"));
    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
    expect(screen.getByText("2026-07-14")).toBeInTheDocument();
    expect(screen.getByText(/Cross-platform font picker/)).toBeInTheDocument();
    expect(screen.getByText("v0.1.0")).toBeInTheDocument();
  });

  it("toggles closed when the button is clicked again", () => {
    render(<ChangelogButton />);
    const btn = screen.getByTitle("What's new");
    fireEvent.click(btn);
    expect(screen.getByText("v0.4.0")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByText("v0.4.0")).not.toBeInTheDocument();
  });
});
```

This test deliberately imports the REAL `changelog.json` (no mock) — the data is static bundled
content, so testing against the real file is more meaningful than a mock here, and it will
break loudly (in an obvious, expected way) if a future edit to `changelog.json` removes the
`0.4.0`/`0.1.0` entries this test checks for.

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./ChangelogButton` doesn't exist yet.

- [ ] **Step 4: Write the component**

Create `ae-iterations-next/src/js/main/components/ChangelogButton.tsx`:

```tsx
import { useState } from "react";
import entries from "../changelog.json";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const changelogEntries = entries as ChangelogEntry[];

export function ChangelogButton() {
  const [open, setOpen] = useState(false);

  return (
    <div id="changelog-section">
      <button id="btn-changelog" className={open ? "open" : ""} title="What's new" onClick={() => setOpen(!open)}>
        ℹ
      </button>
      {open && (
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
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 6: Wire into `LayerInfoPanel`**

Open `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`. Add the import:

```ts
import { ChangelogButton } from "./ChangelogButton";
```

Find the last line of the returned JSX:

```tsx
      <RunButton effectiveValue={effectiveValue} />
    </div>
  );
}
```

and add `<ChangelogButton />` as a sibling right after `<RunButton ... />`:

```tsx
      <RunButton effectiveValue={effectiveValue} />
      <ChangelogButton />
    </div>
  );
}
```

Rendered unconditionally (not inside any `mode === "itr"`/`"var"` block) — matches the original's
mode-independent "what's new" button.

- [ ] **Step 7: Bump the version**

Open `ae-iterations-next/package.json`. Change:

```json
  "version": "0.0.1",
```

to:

```json
  "version": "0.4.0",
```

This is the first real versioning this rewrite has done — matching the latest changelog entry.

- [ ] **Step 8: Add styling**

Open `ae-iterations-next/src/js/main/main.scss` and add this block at the end of the file:

```scss
// ── Changelog ─────────────────────────────────────────────────────────────

#changelog-section {
  margin-top: 0.4rem;
}

#btn-changelog {
  width: 1.8rem !important;
  height: 1.8rem !important;
  padding: 0 !important;
  border-radius: 50% !important;
  font-size: 0.85rem !important;
  background-color: $darker !important;
  color: $highlight !important;

  &.open,
  &:hover {
    background-color: $active !important;
    color: white !important;
  }
}

#changelog-list {
  margin-top: 0.4rem;
  max-height: 12rem;
  overflow-y: auto;
  padding: 0.4rem;
  background-color: $darker;
  border-radius: 4px;
}

.cl-entry {
  margin-bottom: 0.5rem;

  &:last-child {
    margin-bottom: 0;
  }
}

.cl-header {
  display: flex;
  gap: 0.4rem;
  align-items: baseline;
}

.cl-version {
  font-weight: 600;
  color: $font;
  font-size: 0.75rem;
}

.cl-date {
  font-size: 0.65rem;
  color: $highlight;
}

.cl-changes {
  margin: 0.2rem 0 0 0.9rem;
  padding: 0;
  font-size: 0.7rem;
  color: $font;

  li {
    margin-bottom: 0.15rem;
  }
}
```

- [ ] **Step 9: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 10: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/changelog.json ae-iterations-next/src/js/main/components/ChangelogButton.tsx ae-iterations-next/src/js/main/components/ChangelogButton.test.tsx ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx ae-iterations-next/package.json ae-iterations-next/src/js/main/main.scss
git commit -m "feat: add changelog panel"
```

---

## Self-Review Notes

- **Spec coverage:** JS-import bundling (Decision 1), retroactive 4-phase content with
  git-verified dates (Decision 2), unconditional visibility (Decision 3) are all implemented in
  this single task.
- **Type consistency:** `ChangelogEntry`'s shape (`version`/`date`/`changes: string[]`) matches
  the JSON structure exactly; no other task/file references this type, so there's no drift risk.
- **No placeholders:** complete, real code and data throughout — no invented content.
- **No manual verification recipe needed** — unlike every prior phase in this rewrite, this
  feature has no AE object model dependency, no new npm dependency, and no platform-specific
  code. A basic visual check (open the panel, click the info button) is sufficient, and the
  automated tests already cover the actual logic.
