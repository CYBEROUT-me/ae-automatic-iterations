# Font Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ae-iterations-next`'s plain "type the exact PostScript name" text field (for text-layer rows) with a live-filtered autocomplete dropdown of real, installed system fonts, working correctly on both macOS and Windows.

**Architecture:** A new panel-side (Node) module scans OS-standard font directories and parses each font file with `fontkit` to extract real PostScript names — one mechanism, both platforms. A new `FontInput` component wraps a controlled text input with its own inline dropdown (no shared/global search box). `ColorFields.tsx`'s existing text-row font field is swapped to use it.

**Tech Stack:** BoltCEP (React + TypeScript + Vite), `fontkit` (new dependency), Vitest + React Testing Library.

**Design spec:** `docs/superpowers/specs/2026-07-13-ae-iterations-font-picker-design.md`

## Global Constraints

- Applies to **both ITR and VAR mode** — `ColorFields.tsx`'s text-row branch is shared by
  both, no mode-gating needed.
- **Cross-platform correctness, not a macOS-only port.** The original's `system_profiler`
  shortcut has no Windows equivalent; this plan replaces it entirely with font-file parsing
  that works identically on both platforms.
- **Panel-side (Node), not host-side (`aeft.ts`)** — font scanning is an OS/filesystem concern
  with no ExtendScript equivalent, unlike `browseForMedia`/`listEmojiFiles`.
- **Per-row inline dropdown**, not the original's shared floating search box.
- A file that fails to parse is skipped, not fatal — matches this codebase's established
  per-item error-handling convention (e.g. `cleanProject`'s per-item try/catch). A directory
  that can't be read is skipped the same way.
- `fonts.ts` and `FontInput.tsx` are genuinely unit-testable (no AE object model involved) and
  get real Vitest + React Testing Library tests — unlike `src/jsx/aeft/**` host code, which
  ships without tests in this codebase.
- No change to the current production `extension/` — this phase applies only to
  `ae-iterations-next`.

---

### Task 1: `fonts.ts` — cross-platform font scanning + parsing

**Files:**
- Modify: `ae-iterations-next/package.json` (add `fontkit`, `@types/fontkit`)
- Create: `ae-iterations-next/src/js/main/lib/fonts.ts`
- Test: `ae-iterations-next/src/js/main/lib/fonts.test.ts`

**Interfaces:**
- Produces: `loadFonts(dirs?: string[]): Promise<string[]>`, `fontDirectories(platform?: NodeJS.Platform, env?: NodeJS.ProcessEnv): string[]`, `_resetFontCache(): void` (test-only). Consumed by Task 2 (`FontInput`) and Task 3 (`LayerInfoPanel`'s eager preload).

`fontkit`'s real API (verified against `@types/fontkit@2.0.8`, not guessed): `fontkit.openSync(filePath)` returns `Font | FontCollection`. `Font` has a `postscriptName: string` property. `FontCollection` (`.ttc`/`.dfont` files) has a `fonts: Font[]` property — distinguish the two with `"fonts" in result`.

- [ ] **Step 1: Install dependencies**

```bash
cd ae-iterations-next
npm install fontkit
npm install --save-dev @types/fontkit
```

- [ ] **Step 2: Write the failing tests**

Create `ae-iterations-next/src/js/main/lib/fonts.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as fontkit from "fontkit";
import { loadFonts, fontDirectories, _resetFontCache } from "./fonts";

vi.mock("fs");
vi.mock("fontkit");

describe("fontDirectories", () => {
  it("returns macOS font directories on darwin", () => {
    const dirs = fontDirectories("darwin", {});
    expect(dirs).toContain("/System/Library/Fonts");
    expect(dirs).toContain("/Library/Fonts");
  });

  it("returns Windows font directories on win32, including the per-user dir when LOCALAPPDATA is set", () => {
    const dirs = fontDirectories("win32", {
      WINDIR: "C:\\Windows",
      LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local",
    });
    expect(dirs).toContain("C:\\Windows\\Fonts");
    expect(dirs).toContain("C:\\Users\\Test\\AppData\\Local\\Microsoft\\Windows\\Fonts");
  });

  it("omits the per-user dir on win32 when LOCALAPPDATA is unset", () => {
    const dirs = fontDirectories("win32", { WINDIR: "C:\\Windows" });
    expect(dirs).toEqual(["C:\\Windows\\Fonts"]);
  });

  it("returns an empty list for an unsupported platform", () => {
    expect(fontDirectories("linux", {})).toEqual([]);
  });
});

describe("loadFonts", () => {
  beforeEach(() => {
    _resetFontCache();
    vi.mocked(fs.readdirSync).mockReset();
    vi.mocked(fontkit.openSync).mockReset();
  });

  it("scans the given directories and returns sorted, deduplicated postscript names", async () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["Arial.ttf", "notes.txt", "Arial.ttf"] as any);
    vi.mocked(fontkit.openSync).mockReturnValue({ postscriptName: "ArialMT" } as any);

    const result = await loadFonts(["/fake/fonts"]);
    expect(result).toEqual(["ArialMT"]);
  });

  it("ignores files without a recognized font extension", async () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["Arial.ttf", "readme.md", "icon.png"] as any);
    vi.mocked(fontkit.openSync).mockReturnValue({ postscriptName: "ArialMT" } as any);

    await loadFonts(["/fake/fonts"]);
    expect(fontkit.openSync).toHaveBeenCalledTimes(1);
  });

  it("skips a file that fails to parse without aborting the whole scan", async () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["Broken.ttf", "Good.ttf"] as any);
    vi.mocked(fontkit.openSync).mockImplementation((filePath: any) => {
      if (filePath.includes("Broken")) throw new Error("corrupt font");
      return { postscriptName: "GoodFontMT" } as any;
    });

    const result = await loadFonts(["/fake/fonts"]);
    expect(result).toEqual(["GoodFontMT"]);
  });

  it("expands a font collection (.ttc) into each sub-font's postscript name", async () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["Collection.ttc"] as any);
    vi.mocked(fontkit.openSync).mockReturnValue({
      type: "TTC",
      fonts: [{ postscriptName: "FontA-Regular" }, { postscriptName: "FontA-Bold" }],
    } as any);

    const result = await loadFonts(["/fake/fonts"]);
    expect(result).toEqual(["FontA-Bold", "FontA-Regular"]);
  });

  it("returns an empty list when a directory can't be read, without throwing", async () => {
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error("EACCES");
    });

    const result = await loadFonts(["/fake/fonts"]);
    expect(result).toEqual([]);
  });

  it("caches the result — a second call does not re-scan", async () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["Arial.ttf"] as any);
    vi.mocked(fontkit.openSync).mockReturnValue({ postscriptName: "ArialMT" } as any);

    await loadFonts(["/fake/fonts"]);
    vi.mocked(fs.readdirSync).mockClear();
    await loadFonts(["/fake/fonts"]);
    expect(fs.readdirSync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `./fonts` doesn't exist yet.

- [ ] **Step 4: Write the implementation**

Create `ae-iterations-next/src/js/main/lib/fonts.ts`:

```ts
// Cross-platform font autocomplete source. Scans OS-standard font
// directories and parses each file with fontkit to extract real PostScript
// names — the same names AE itself resolves at render time. Replaces the
// original extension's macOS-only `system_profiler` shell trick, which has
// no Windows equivalent that yields true PostScript names (registry/
// PowerShell font enumeration only exposes display names like "Arial Bold").

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as fontkit from "fontkit";

const FONT_EXTENSIONS = [".ttf", ".otf", ".ttc"];

export function fontDirectories(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (platform === "darwin") {
    return ["/System/Library/Fonts", "/Library/Fonts", path.join(os.homedir(), "Library", "Fonts")];
  }
  if (platform === "win32") {
    const windir = env.WINDIR || "C:\\Windows";
    const dirs = [path.join(windir, "Fonts")];
    if (env.LOCALAPPDATA) {
      dirs.push(path.join(env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts"));
    }
    return dirs;
  }
  return [];
}

function listFontFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => FONT_EXTENSIONS.includes(path.extname(name).toLowerCase()))
      .map((name) => path.join(dir, name));
  } catch (e) {
    return [];
  }
}

// A single font file yields one name; a collection (.ttc/.dfont) yields one
// per sub-font. Any parse failure yields none — the scan continues with the
// next file rather than aborting.
function extractPostscriptNames(filePath: string): string[] {
  try {
    const result = fontkit.openSync(filePath);
    if ("fonts" in result) {
      return result.fonts.map((f) => f.postscriptName).filter((n): n is string => !!n);
    }
    return result.postscriptName ? [result.postscriptName] : [];
  } catch (e) {
    return [];
  }
}

let cache: Promise<string[]> | null = null;

// Cached at module scope after the first call — every FontInput instance
// shares one scan, regardless of how many times loadFonts() is called.
export function loadFonts(dirs: string[] = fontDirectories()): Promise<string[]> {
  if (!cache) {
    cache = Promise.resolve().then(() => {
      const names = new Set<string>();
      for (const dir of dirs) {
        for (const file of listFontFiles(dir)) {
          for (const name of extractPostscriptNames(file)) {
            names.add(name);
          }
        }
      }
      return Array.from(names).sort();
    });
  }
  return cache;
}

// Test-only: clears the module-scope cache so each test starts fresh.
export function _resetFontCache(): void {
  cache = null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the new ones.

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exit 0. If `fontkit`'s CommonJS module doesn't import cleanly under this project's ESM-ish `import * as fontkit from "fontkit"` syntax, check `@types/fontkit`'s module declaration and adjust the import style (e.g. `import fontkit = require("fontkit")` or a default import) — don't guess silently, note what you found and why in your report.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ae-iterations-next/package.json ae-iterations-next/package-lock.json ae-iterations-next/src/js/main/lib/fonts.ts ae-iterations-next/src/js/main/lib/fonts.test.ts
git commit -m "feat: add cross-platform font scanning (fonts.ts)"
```

---

### Task 2: `FontInput` component

**Files:**
- Create: `ae-iterations-next/src/js/main/components/FontInput.tsx`
- Test: `ae-iterations-next/src/js/main/components/FontInput.test.tsx`

**Interfaces:**
- Consumes: `loadFonts` (`../lib/fonts`, Task 1).
- Produces: `FontInput({ value: string; onChange: (v: string) => void })`. Consumed by Task 3 (`ColorFields.tsx`).

- [ ] **Step 1: Write the failing tests**

Create `ae-iterations-next/src/js/main/components/FontInput.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FontInput } from "./FontInput";
import * as fontsLib from "../lib/fonts";

vi.mock("../lib/fonts", () => ({
  loadFonts: vi.fn(),
}));

describe("FontInput", () => {
  beforeEach(() => {
    vi.mocked(fontsLib.loadFonts).mockResolvedValue(["ArialMT", "Arial-BoldMT", "Helvetica"]);
  });

  it("shows 'Loading fonts…' before the font list resolves", () => {
    vi.mocked(fontsLib.loadFonts).mockReturnValue(new Promise(() => {}));
    render(<FontInput value="" onChange={() => {}} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    expect(screen.getByText("Loading fonts…")).toBeInTheDocument();
  });

  it("filters the dropdown by the current value, case-insensitively", async () => {
    render(<FontInput value="arial" onChange={() => {}} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("ArialMT")).toBeInTheDocument();
    expect(screen.getByText("Arial-BoldMT")).toBeInTheDocument();
    expect(screen.queryByText("Helvetica")).not.toBeInTheDocument();
  });

  it("shows 'No fonts found' when nothing matches", async () => {
    render(<FontInput value="zzz-no-match" onChange={() => {}} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("No fonts found")).toBeInTheDocument();
  });

  it("calls onChange and closes the dropdown when a result is selected", async () => {
    const onChange = vi.fn();
    render(<FontInput value="arial" onChange={onChange} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    await new Promise((r) => setTimeout(r, 0));
    fireEvent.mouseDown(screen.getByText("ArialMT"));
    expect(onChange).toHaveBeenCalledWith("ArialMT");
    expect(screen.queryByText("Arial-BoldMT")).not.toBeInTheDocument();
  });

  it("calls onChange as the user types", () => {
    const onChange = vi.fn();
    render(<FontInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("PostScript name"), { target: { value: "Hel" } });
    expect(onChange).toHaveBeenCalledWith("Hel");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./FontInput` doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `ae-iterations-next/src/js/main/components/FontInput.tsx`:

```tsx
import { useEffect, useState } from "react";
import { loadFonts } from "../lib/fonts";

const MAX_RESULTS = 30;

// Fully controlled — the caller (ColorFields) owns the value, this component
// only renders/edits it and layers an autocomplete dropdown on top. No
// shared/global search box: every FontInput instance is self-contained,
// matching every other component in this codebase (MediaFields,
// EmojiPickerGrid, etc.) rather than the original extension's one
// panel-wide floating search input.
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
      {open && (
        <div className="font-dropdown">
          {allFonts === null ? (
            <div className="font-empty">Loading fonts…</div>
          ) : matches.length === 0 ? (
            <div className="font-empty">No fonts found</div>
          ) : (
            matches.map((f) => (
              // onMouseDown + preventDefault (not onClick) so the selection
              // fires before the input's onBlur closes the dropdown — the
              // original extension's exact trick for avoiding a
              // blur-then-click ordering race.
              <div
                key={f}
                className="font-option"
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the new ones.

- [ ] **Step 5: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/FontInput.tsx ae-iterations-next/src/js/main/components/FontInput.test.tsx
git commit -m "feat: add FontInput autocomplete component"
```

---

### Task 3: Wire into `ColorFields`, eager-load on panel mount, styling, manual verification recipe

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/ColorFields.tsx`
- Create: `ae-iterations-next/src/js/main/components/ColorFields.test.tsx`
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- Consumes: `FontInput` (Task 2), `loadFonts` (Task 1).
- Produces: the complete, usable font-autocomplete flow.

- [ ] **Step 1: Write the failing test**

`ColorFields.tsx` currently has no dedicated test file. A plain "type and check the store
updates" test would pass on both the old raw `<input>` and the new `FontInput` (they share the
same placeholder and both call `onChange` on typing), so it wouldn't actually prove the swap
happened. Add a second test that only the new `FontInput` can satisfy: a dropdown showing a
known font name on focus, which the old plain input has no concept of. Create
`ae-iterations-next/src/js/main/components/ColorFields.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorFields } from "./ColorFields";
import { useAppStore } from "../state/store";
import type { RowLayer } from "../state/rowLayers";

vi.mock("../lib/fonts", () => ({
  loadFonts: vi.fn().mockResolvedValue(["Helvetica-Bold", "ArialMT"]),
}));

const textRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "text", name: "Title", fillPath: "" };

describe("ColorFields — text row font field", () => {
  it("updates the store when the font field changes", () => {
    useAppStore.setState({ values: {} });
    render(<ColorFields row={textRow} iter={0} />);
    fireEvent.change(screen.getByPlaceholderText("PostScript name"), { target: { value: "Helvetica-Bold" } });
    expect(useAppStore.getState().values["1"]?.[0]?.font).toBe("Helvetica-Bold");
  });

  it("shows the FontInput autocomplete dropdown on focus, proving it's not the old plain input", async () => {
    useAppStore.setState({ values: {} });
    render(<ColorFields row={textRow} iter={0} />);
    fireEvent.focus(screen.getByPlaceholderText("PostScript name"));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByText("Helvetica-Bold")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL on the second test ("shows the FontInput autocomplete dropdown…") — the old
plain `<input>` has no dropdown, so "Helvetica-Bold" never appears as text anywhere. The first
test ("updates the store…") is expected to already PASS even before Step 3, since a plain
controlled input also calls `onChange` on typing — that's fine; it's still worth keeping as a
regression guard, it just isn't the test proving this task's change.

- [ ] **Step 3: Wire `FontInput` into `ColorFields`**

Open `ae-iterations-next/src/js/main/components/ColorFields.tsx`. Add the import:

```ts
import { FontInput } from "./FontInput";
```

Find:

```tsx
          <input
            type="text"
            placeholder="PostScript name"
            value={value?.font ?? ""}
            onChange={(e) => setValue(row.rowKey, iter, { ...value, font: e.target.value })}
          />
```

and replace it with:

```tsx
          <FontInput
            value={value?.font ?? ""}
            onChange={(font) => setValue(row.rowKey, iter, { ...value, font })}
          />
```

- [ ] **Step 4: Add the eager font-load call to `LayerInfoPanel`**

Open `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`. Add the import:

```ts
import { useEffect } from "react";
import { loadFonts } from "../lib/fonts";
```

(If `useEffect` isn't already imported from `"react"` in this file, add it to the existing
React import; don't duplicate the import statement.)

Add this call inside the `LayerInfoPanel` function body, near its other hooks:

```ts
  useEffect(() => {
    loadFonts();
  }, []);
```

This starts the font scan as soon as the panel mounts, in the background, regardless of
whether any text layer is currently selected — matching the original extension's one-time
`loadFonts()` call at startup, so the list is very likely already cached by the time a user
actually focuses a font field.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the new `ColorFields.test.tsx`, with no regressions.

- [ ] **Step 6: Add styling**

Open `ae-iterations-next/src/js/main/main.scss` and add this block at the end of the file:

```scss
// ── Font picker ───────────────────────────────────────────────────────────

.font-input-wrap {
  position: relative;
  display: inline-flex;
}

.font-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  max-height: 8rem;
  overflow-y: auto;
  background-color: $darker;
  border: 1px solid $dark;
  border-radius: 4px;
  margin-top: 2px;
}

.font-option {
  padding: 0.25rem 0.4rem;
  font-size: 0.7rem;
  color: $font;
  cursor: pointer;

  &:hover {
    background-color: rgba($active, 0.15);
  }
}

.font-empty {
  padding: 0.3rem 0.4rem;
  font-size: 0.7rem;
  color: $highlight;
}
```

- [ ] **Step 7: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/ColorFields.tsx ae-iterations-next/src/js/main/components/ColorFields.test.tsx ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx ae-iterations-next/src/js/main/main.scss
git commit -m "feat: wire FontInput into ColorFields, eager-load fonts on panel mount"
```

- [ ] **Step 9: Write the manual verification recipe**

This is the real acceptance test — no subagent can verify real font directories or a real
After Effects font-apply round-trip. Write the following recipe into your task report:

**On macOS:**
1. Build and reload the extension (`npm run build`, reopen the panel in AE).
2. Select a text layer, click Refresh. Click into the font field — confirm "Loading fonts…"
   appears briefly, then a real list of installed font PostScript names (not display names —
   e.g. `Helvetica-Bold`, not "Helvetica Bold").
3. Type a partial name (e.g. "Ari") — confirm the dropdown filters live, case-insensitively,
   capped at 30 results.
4. Click a result — confirm it fills the field and the dropdown closes.
5. Click **Preview N** (if available) or **Run Iterations** — confirm the selected font is
   actually applied to the text layer in AE (open the layer's Source Text properties and check
   the font, or just eyeball the rendered text).
6. Open a second text-layer row (or a second iteration column) — confirm its font field also
   gets the same cached list instantly, with no repeated "Loading fonts…" delay.

**On Windows:**
7. Repeat steps 1-6 on a Windows machine. Specifically confirm: the dropdown shows real,
   correct PostScript names (not "Arial Bold"-style display names) — cross-check a couple
   against a font you know the PostScript name of. If a font you know is installed doesn't
   appear, check whether it's a `.ttc` file (collection) — if collections don't parse
   correctly, that's the disclosed risk from the design spec's Risks section, worth a follow-up.
8. Confirm no console errors appear when the panel opens (e.g. a font directory permission
   error) — a directory that can't be read should degrade silently to skipping it, not surface
   an error to the user.

If font autocomplete doesn't work at all on either platform, check `fontDirectories()`'s
returned paths against the real, current OS username/paths on that machine — path construction
bugs (wrong separator, wrong env var name) are the most likely failure mode, not `fontkit`
itself.

---

## Self-Review Notes

- **Spec coverage:** cross-platform scanning (Decision 1), per-row dropdown (Decision 2),
  panel-side placement (Decision 3) are all implemented in Tasks 1-3. The design's flagged
  `fontkit` API risk was resolved before writing this plan (verified against the real
  `@types/fontkit@2.0.8` declarations — `Font | FontCollection` union, `"fonts" in result`
  discriminant — not guessed).
- **Type consistency checked:** `loadFonts`/`fontDirectories`/`_resetFontCache` (Task 1) are
  used with identical signatures in Task 2 (`FontInput`) and Task 3 (`LayerInfoPanel`'s eager
  call). `FontInput`'s `{ value, onChange }` prop shape is used identically in Task 3's
  `ColorFields` integration.
- **No placeholders:** every task ships complete, real, API-verified code — no invented
  `fontkit` methods, no "write tests for the above" without actual test code.
- **Testability upgrade over prior phases:** unlike the ITR/VAR/emoji phases' host-side
  (`aeft.ts`/AE-object-model) code, `fonts.ts` has zero AE dependency and is fully unit-tested
  with mocked `fs`/`fontkit` — this phase's plan leans on that rather than deferring everything
  to a manual recipe, since it genuinely can.
