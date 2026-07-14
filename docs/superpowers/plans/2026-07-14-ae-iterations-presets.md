# Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add color/video presets to `ae-iterations-next`'s ITR mode — a built-in library of 16 presets plus user-saved presets, applying a per-iteration value sequence to row 0 with one click.

**Architecture:** A static `presets-library.json` bundled as a direct JS import (no runtime file read, matching the changelog panel). A new cross-platform `userPresets.ts` module handles genuinely dynamic, user-writable persistence via Node `fs`/`os`/`path`. A single `PresetPanel` component owns the toggle, list, apply/save/delete logic, and name input.

**Tech Stack:** BoltCEP (React + TypeScript + Vite), Vitest + React Testing Library.

**Design spec:** `docs/superpowers/specs/2026-07-14-ae-iterations-presets-design.md`

## Global Constraints

- Presets are **ITR-mode only** — hidden entirely in VAR mode, matching the emoji overlay's
  precedent.
- Presets **apply to row 0 only** (`rowLayers[0]`) — not extended to multi-row application.
- `Preset` is `ColorPreset | VideoPreset`: color presets have no `type` field and a
  `colors: string[]`; video presets have `type: "video"` and
  `iterations: { flip: boolean; bw: boolean; tint: string | null; hue: number }[]`.
- Applying clamps to `Math.min(count, preset.length)` — entries beyond that are left untouched.
- `tintAmount` is never part of a saved/applied preset's persisted shape — applying a video
  preset always sets it to the fixed default `50` (the original's exact fallback); saving a
  video preset never reads or writes it.
- Built-in library bundled as a direct JS import (`import library from "../presets-library.json"`)
  — no runtime file read, no Node dependency for this part.
- User-preset persistence uses cross-platform path resolution (macOS: `~/Library/Application
  Support/AE Iterations/`, Windows: `%APPDATA%\AE Iterations\`) — built with explicit
  `path.posix.join`/`path.win32.join` per branch (not plain `path.join`), so path construction
  is correct regardless of which OS actually runs the code computing it — this is the exact bug
  class the font-picker phase's `fontDirectories()` had to fix after the fact; this plan applies
  that lesson from the start.
- `userPresets.ts` gets real unit tests (pure Node filesystem logic, zero AE dependency) with
  `// @vitest-environment node` (this project's default test environment is `jsdom`, under
  which `vi.mock("fs")` silently no-ops — another lesson carried forward from the font-picker
  phase, applied proactively here).
- No change to the current production `extension/` — this phase applies only to
  `ae-iterations-next`.

---

### Task 1: `presets-library.json` + `userPresets.ts`

**Files:**
- Create: `ae-iterations-next/src/js/main/presets-library.json`
- Create: `ae-iterations-next/src/js/main/lib/userPresets.ts`
- Test: `ae-iterations-next/src/js/main/lib/userPresets.test.ts`

**Interfaces:**
- Produces: `ColorPreset`, `VideoPreset`, `Preset` (types), `userPresetsPath(platform?, env?, homedir?): string`, `loadUserPresets(filePath?): Preset[]`, `saveUserPresets(presets, filePath?): void`. Consumed by Task 2 (`PresetPanel`).

- [ ] **Step 1: Create the built-in preset library**

Create `ae-iterations-next/src/js/main/presets-library.json` — ported verbatim from the
original `extension/presets/library.json`:

```json
[
  { "name": "Brand Blue",   "colors": ["#0057B7", "#1A73E8", "#4285F4", "#8AB4F8", "#D2E3FC"] },
  { "name": "Warm Earth",   "colors": ["#8B4513", "#A0522D", "#C9A96E", "#D2B48C", "#F5DEB3"] },
  { "name": "Neon Night",   "colors": ["#FF2D78", "#BF00FF", "#00D4FF", "#00FF9F", "#FFD700"] },
  { "name": "Nordic Fog",   "colors": ["#1C3A44", "#2E5B6A", "#4A7C8E", "#7D9BAA", "#B5C4D1"] },
  { "name": "Sunset",       "colors": ["#FF4500", "#FF6B35", "#FF8C42", "#FFBF00", "#FFD166"] },
  { "name": "Pastel Dream", "colors": ["#FFB3BA", "#FFDFBA", "#FFFFBA", "#BAFFC9", "#BAE1FF"] },
  { "name": "Forest",       "colors": ["#1B4332", "#2D6A4F", "#40916C", "#74C69D", "#B7E4C7"] },
  { "name": "Monochrome",   "colors": ["#F0F0F0", "#BEBEBE", "#808080", "#404040", "#101010"] },
  { "name": "Gold & Black", "colors": ["#1C1C1C", "#3D3D3D", "#B8860B", "#FFD700", "#FFF8DC"] },
  { "name": "Retro 80s",    "colors": ["#FF073A", "#7B2FBE", "#00CFFF", "#39FF14", "#FF9B00"] },
  { "name": "Ocean Depth",  "colors": ["#03045E", "#0077B6", "#00B4D8", "#90E0EF", "#CAF0F8"] },
  { "name": "Muted Sage",   "colors": ["#3D5A47", "#6B705C", "#A5A58D", "#B7B7A4", "#EDDCD2"] },

  { "name": "Warm Tints",   "type": "video", "iterations": [
    { "flip": false, "bw": false, "tint": "#FF6B35", "hue": 0   },
    { "flip": false, "bw": false, "tint": "#FFB347", "hue": 0   },
    { "flip": false, "bw": false, "tint": "#FF4500", "hue": 0   },
    { "flip": true,  "bw": false, "tint": "#FF6B35", "hue": 0   },
    { "flip": false, "bw": true,  "tint": null,       "hue": 0  }
  ]},
  { "name": "Cool Tints",   "type": "video", "iterations": [
    { "flip": false, "bw": false, "tint": "#1A73E8", "hue": 0   },
    { "flip": false, "bw": false, "tint": "#00B4D8", "hue": 0   },
    { "flip": false, "bw": false, "tint": "#7B2FBE", "hue": 0   },
    { "flip": true,  "bw": false, "tint": "#1A73E8", "hue": 0   },
    { "flip": false, "bw": true,  "tint": null,       "hue": 0  }
  ]},
  { "name": "Hue Variants", "type": "video", "iterations": [
    { "flip": false, "bw": false, "tint": null, "hue": 0   },
    { "flip": false, "bw": false, "tint": null, "hue": 45  },
    { "flip": false, "bw": false, "tint": null, "hue": 90  },
    { "flip": false, "bw": false, "tint": null, "hue": 135 },
    { "flip": false, "bw": false, "tint": null, "hue": 180 }
  ]},
  { "name": "Mirror Mix",   "type": "video", "iterations": [
    { "flip": false, "bw": false, "tint": null,       "hue": 0  },
    { "flip": true,  "bw": false, "tint": null,       "hue": 0  },
    { "flip": false, "bw": true,  "tint": null,       "hue": 0  },
    { "flip": true,  "bw": true,  "tint": null,       "hue": 0  },
    { "flip": false, "bw": false, "tint": "#4285F4",  "hue": 0  }
  ]}
]
```

- [ ] **Step 2: Write the failing tests**

Create `ae-iterations-next/src/js/main/lib/userPresets.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { userPresetsPath, loadUserPresets, saveUserPresets } from "./userPresets";
import type { Preset } from "./userPresets";

vi.mock("fs");

describe("userPresetsPath", () => {
  it("resolves the macOS Application Support path", () => {
    const p = userPresetsPath("darwin", {}, "/Users/test");
    expect(p).toBe("/Users/test/Library/Application Support/AE Iterations/user-presets.json");
  });

  it("resolves the Windows APPDATA path when APPDATA is set", () => {
    const p = userPresetsPath("win32", { APPDATA: "C:\\Users\\Test\\AppData\\Roaming" }, "C:\\Users\\Test");
    expect(p).toBe("C:\\Users\\Test\\AppData\\Roaming\\AE Iterations\\user-presets.json");
  });

  it("falls back to homedir on Windows when APPDATA is unset", () => {
    const p = userPresetsPath("win32", {}, "C:\\Users\\Test");
    expect(p).toBe("C:\\Users\\Test\\AE Iterations\\user-presets.json");
  });
});

describe("loadUserPresets", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
  });

  it("returns [] when the file doesn't exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(loadUserPresets("/fake/path.json")).toEqual([]);
  });

  it("returns the parsed presets when the file exists", () => {
    const presets: Preset[] = [{ name: "Test", colors: ["#FF0000"] }];
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(presets) as any);
    expect(loadUserPresets("/fake/path.json")).toEqual(presets);
  });

  it("returns [] when the file contains invalid JSON, without throwing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("{not valid json" as any);
    expect(loadUserPresets("/fake/path.json")).toEqual([]);
  });
});

describe("saveUserPresets", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.mkdirSync).mockReset();
    vi.mocked(fs.writeFileSync).mockReset();
  });

  it("creates the containing directory if it doesn't exist, then writes pretty-printed JSON", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const presets: Preset[] = [{ name: "Test", colors: ["#FF0000"] }];
    saveUserPresets(presets, "/fake/dir/user-presets.json");
    expect(fs.mkdirSync).toHaveBeenCalledWith("/fake/dir", { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      "/fake/dir/user-presets.json",
      JSON.stringify(presets, null, 2),
      "utf8"
    );
  });

  it("skips creating the directory if it already exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    saveUserPresets([], "/fake/dir/user-presets.json");
    expect(fs.mkdirSync).not.toHaveBeenCalled();
  });

  it("propagates a write failure rather than swallowing it", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error("EACCES");
    });
    expect(() => saveUserPresets([], "/fake/dir/user-presets.json")).toThrow("EACCES");
  });
});
```

`saveUserPresets` deliberately throws on failure rather than swallowing it (unlike the
original, which catches internally and calls its own UI status-setter directly) — this
codebase's established convention is for lib functions to throw and let the caller (Task 2's
`PresetPanel`) catch and display its own status message, keeping this module UI-free.

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./userPresets` doesn't exist yet.

- [ ] **Step 4: Write the implementation**

Create `ae-iterations-next/src/js/main/lib/userPresets.ts`:

```ts
// Cross-platform persistence for user-saved presets, stored outside the
// extension's own installed folder so they survive updates. The original
// extension hardcodes a macOS-only path
// (~/Library/Application Support/AE Iterations/); this resolves the
// correct convention per platform instead. Path construction uses
// path.posix.join/path.win32.join explicitly per branch (not plain
// path.join) so it's correct regardless of which OS actually runs the
// code — the font-picker phase's fontDirectories() needed this exact fix
// after the fact; applied proactively here.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export interface ColorPreset {
  name: string;
  colors: string[];
}

export interface VideoPreset {
  name: string;
  type: "video";
  iterations: { flip: boolean; bw: boolean; tint: string | null; hue: number }[];
}

export type Preset = ColorPreset | VideoPreset;

export function userPresetsPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = os.homedir()
): string {
  if (platform === "win32") {
    return path.win32.join(env.APPDATA || homedir, "AE Iterations", "user-presets.json");
  }
  return path.posix.join(homedir, "Library", "Application Support", "AE Iterations", "user-presets.json");
}

export function loadUserPresets(filePath: string = userPresetsPath()): Preset[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return [];
  }
}

export function saveUserPresets(presets: Preset[], filePath: string = userPresetsPath()): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(presets, null, 2), "utf8");
}
```

If `path.dirname`'s behavior on a path built via `path.win32.join`/`path.posix.join` (rather
than the host-native `path.join`) doesn't behave as expected, verify against Node's real
`path` module docs before adjusting — `path.dirname` operates on the host's native separator
convention, so a `saveUserPresets` call with a real Windows-style path computed via
`path.win32.join` should still be fine as long as it's actually being run on Windows in
production (this module's real callers never pass a cross-platform-mismatched path; only the
tests do, and the tests only check `mkdirSync`/`writeFileSync` call arguments, not
`path.dirname`'s cross-platform correctness directly).

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all tests including the new ones.

- [ ] **Step 6: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/presets-library.json ae-iterations-next/src/js/main/lib/userPresets.ts ae-iterations-next/src/js/main/lib/userPresets.test.ts
git commit -m "feat: add presets library data and cross-platform user-preset storage"
```

---

### Task 2: `PresetPanel` component

**Files:**
- Create: `ae-iterations-next/src/js/main/components/PresetPanel.tsx`
- Test: `ae-iterations-next/src/js/main/components/PresetPanel.test.tsx`

**Interfaces:**
- Consumes: `ColorPreset`/`VideoPreset`/`Preset`/`loadUserPresets`/`saveUserPresets` (`../lib/userPresets`, Task 1), `hexToRgb`/`rgbToHex` (`../lib/color`, existing), store's `rowLayers`/`count`/`values`/`setValue` (existing).
- Produces: `PresetPanel()` — no props. Consumed by Task 3 (`LayerInfoPanel`).

- [ ] **Step 1: Write the failing tests**

Create `ae-iterations-next/src/js/main/components/PresetPanel.test.tsx`:

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

  it("hides the panel until the toggle button is clicked", () => {
    render(<PresetPanel />);
    expect(screen.queryByText("Brand Blue")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Presets"));
    expect(screen.getByText("Brand Blue")).toBeInTheDocument();
  });

  it("shows only color presets when row 0 is a color-capable row", () => {
    render(<PresetPanel />);
    fireEvent.click(screen.getByText("Presets"));
    expect(screen.getByText("Brand Blue")).toBeInTheDocument();
    expect(screen.queryByText("Warm Tints")).not.toBeInTheDocument();
  });

  it("shows only video presets when row 0 is a video row", () => {
    useAppStore.setState({ rowLayers: [videoRow], count: 3, values: {} });
    render(<PresetPanel />);
    fireEvent.click(screen.getByText("Presets"));
    expect(screen.getByText("Warm Tints")).toBeInTheDocument();
    expect(screen.queryByText("Brand Blue")).not.toBeInTheDocument();
  });

  it("applies a color preset's hex values to row 0, clamped to the current count", () => {
    render(<PresetPanel />);
    fireEvent.click(screen.getByText("Presets"));
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
    fireEvent.click(screen.getByText("Presets"));
    fireEvent.change(screen.getByPlaceholderText("Preset name"), { target: { value: "My Preset" } });
    fireEvent.click(screen.getByText("Save Preset"));
    expect(userPresetsLib.saveUserPresets).toHaveBeenCalledWith([
      expect.objectContaining({ name: "My Preset", colors: ["#123456", "#FF0000", "#FF0000"] }),
    ]);
  });

  it("deletes a user preset", () => {
    vi.mocked(userPresetsLib.loadUserPresets).mockReturnValue([{ name: "Old One", colors: ["#000000"] }]);
    render(<PresetPanel />);
    fireEvent.click(screen.getByText("Presets"));
    fireEvent.click(screen.getByTitle("Delete preset"));
    expect(userPresetsLib.saveUserPresets).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ae-iterations-next
npm run test
```

Expected: FAIL — `./PresetPanel` doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `ae-iterations-next/src/js/main/components/PresetPanel.tsx`:

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
  const [open, setOpen] = useState(false);
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
    <div id="preset-section">
      <button id="btn-presets" className={open ? "open" : ""} onClick={() => setOpen(!open)}>
        Presets
      </button>
      {open && (
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
git add ae-iterations-next/src/js/main/components/PresetPanel.tsx ae-iterations-next/src/js/main/components/PresetPanel.test.tsx
git commit -m "feat: add PresetPanel component"
```

---

### Task 3: Wire into `LayerInfoPanel`, styling, manual verification recipe

**Files:**
- Modify: `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`
- Modify: `ae-iterations-next/src/js/main/main.scss`

**Interfaces:**
- Consumes: `PresetPanel` (Task 2).
- Produces: the complete, usable presets flow.

- [ ] **Step 1: Wire `PresetPanel` into `LayerInfoPanel`, gated on ITR mode**

Open `ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx`. Add the import:

```ts
import { PresetPanel } from "./PresetPanel";
```

Find:

```tsx
      {mode === "itr" && <EmojiSection />}
```

and add `PresetPanel` right after it, still gated on ITR mode:

```tsx
      {mode === "itr" && <EmojiSection />}
      {mode === "itr" && <PresetPanel />}
```

- [ ] **Step 2: Run the full test suite**

```bash
cd ae-iterations-next
npm run test
```

Expected: PASS, no regressions.

- [ ] **Step 3: Add styling**

Open `ae-iterations-next/src/js/main/main.scss` and add this block at the end of the file:

```scss
// ── Presets ───────────────────────────────────────────────────────────────

#preset-section {
  margin-top: 0.4rem;
}

#btn-presets {
  &.open,
  &:hover {
    background-color: $active !important;
    color: white !important;
  }
}

#preset-panel {
  margin-top: 0.4rem;
}

#preset-save-row {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 0.4rem;

  #preset-name-input {
    flex: 1;
  }
}

.preset-status {
  font-size: 0.7rem;
  color: $warning;
  margin-bottom: 0.3rem;
}

#preset-list {
  max-height: 12rem;
  overflow-y: auto;
  padding: 0.4rem;
  background-color: $darker;
  border-radius: 4px;
}

.preset-group-label {
  font-size: 0.65rem;
  color: $highlight;
  text-transform: uppercase;
  margin: 0.4rem 0 0.2rem 0;

  &:first-child {
    margin-top: 0;
  }
}

.preset-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}

.preset-swatches {
  display: flex;
  gap: 0.1rem;
  flex-shrink: 0;
}

.preset-swatch {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 2px;
}

.preset-name {
  flex: 1;
  font-size: 0.7rem;
  color: $font;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-apply,
.preset-delete {
  flex-shrink: 0;
  font-size: 0.65rem !important;
  padding: 0.15rem 0.4rem !important;
}
```

- [ ] **Step 4: Verify the build**

```bash
npm run build
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd ..
git add ae-iterations-next/src/js/main/components/LayerInfoPanel.tsx ae-iterations-next/src/js/main/main.scss
git commit -m "feat: wire PresetPanel into panel"
```

- [ ] **Step 6: Write the manual verification recipe**

This is the real acceptance test — no subagent can verify the real cross-platform file paths on
an actual macOS or Windows machine. Write the following recipe into your task report:

**On macOS:**
1. Build and reload the extension (`npm run build`, reopen the panel in AE).
2. Select a shape or text layer, click Refresh. Click "Presets" — confirm the Library group
   shows the 12 color presets (Brand Blue, Warm Earth, etc.), no video presets.
3. Click "Apply" on a color preset — confirm the row's color fields (across iterations, up to
   the current Count) update to match the preset's hex sequence.
4. Set a few colors manually, type a name into the preset name field, click "Save Preset" —
   confirm a new entry appears under "Saved" with a swatch preview matching what you set.
5. Quit and reopen After Effects (or just reload the extension panel) — confirm the saved
   preset is still there (persisted to disk, not just in-memory).
6. Check `~/Library/Application Support/AE Iterations/user-presets.json` exists and contains
   your saved preset as valid JSON.
7. Click the "×" on your saved preset — confirm it disappears from the list and from the JSON
   file on disk.
8. Select a video/footage layer instead, click Refresh, open Presets — confirm the Library
   group now shows the 4 video presets (Warm Tints, Cool Tints, Hue Variants, Mirror Mix), no
   color presets. Apply one — confirm flip/B&W/tint/hue fields update correctly across
   iterations.

**On Windows:**
9. Repeat steps 1-8 on a Windows machine. Specifically confirm: presets persist to
   `%APPDATA%\AE Iterations\user-presets.json` (not a macOS-style path), and that this
   directory gets created automatically the first time a preset is saved if it doesn't already
   exist.

**Both platforms:**
10. Switch to VAR mode — confirm the Presets button/panel disappears entirely (not just
    visually hidden but functionally absent — matches the emoji overlay's ITR-only precedent).

If presets don't persist across a reload on either platform, check `userPresetsPath()`'s
returned path against the real, current OS username/environment on that machine first — that's
the most likely failure mode, not the JSON read/write logic itself.

---

## Self-Review Notes

- **Spec coverage:** row-0-only scope (Decision 1), ported built-in library (Decision 2),
  cross-platform user-preset storage (Decision 3) are all implemented across Tasks 1-3.
- **Type consistency checked:** `Preset`/`ColorPreset`/`VideoPreset` (Task 1) are used with
  identical shapes in Task 2 (`PresetPanel`) — no drift. `userPresetsPath`/`loadUserPresets`/
  `saveUserPresets` signatures match between Task 1's definition and Task 2's usage (Task 2
  doesn't call `userPresetsPath` directly — it only calls `loadUserPresets()`/
  `saveUserPresets(presets)` with default arguments, which is correct and expected).
- **No placeholders:** every task ships complete, real code and data — the built-in library is
  a verbatim port with a verified byte-for-byte source (`extension/presets/library.json`), not
  invented content.
- **Lessons carried forward proactively, not just fixed reactively:** this plan bakes in the
  `path.win32.join`/`path.posix.join`-per-branch fix and the `@vitest-environment node` pragma
  from the start, rather than waiting for a reviewer to catch the same class of bug the font
  picker phase hit twice.
