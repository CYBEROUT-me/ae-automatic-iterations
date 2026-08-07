// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { panelStatePath, loadPanelState, savePanelState, emptyPanelState, PANEL_STATE_VERSION } from "./panelState";
import type { PanelStateFile } from "./panelState";

vi.mock("fs");

describe("panelStatePath", () => {
  it("resolves the macOS Application Support path", () => {
    expect(panelStatePath("darwin", {}, "/Users/test")).toBe(
      "/Users/test/Library/Application Support/AE Iterations/panel-state.json"
    );
  });

  it("resolves the Windows APPDATA path when APPDATA is set", () => {
    expect(panelStatePath("win32", { APPDATA: "C:\\Users\\Test\\AppData\\Roaming" }, "C:\\Users\\Test")).toBe(
      "C:\\Users\\Test\\AppData\\Roaming\\AE Iterations\\panel-state.json"
    );
  });

  it("falls back to homedir on Windows when APPDATA is unset", () => {
    expect(panelStatePath("win32", {}, "C:\\Users\\Test")).toBe("C:\\Users\\Test\\AE Iterations\\panel-state.json");
  });
});

describe("loadPanelState", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.readFileSync).mockReset();
  });

  it("returns empty state when the file doesn't exist", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(loadPanelState("/fake/path.json")).toEqual(emptyPanelState());
  });

  it("returns the parsed state when the file exists", () => {
    const state: PanelStateFile = {
      version: PANEL_STATE_VERSION,
      lastSession: { count: 3, badgeEnabled: true },
      jobPresets: [{ name: "Promo", setup: { count: 5 } }],
    };
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(state) as any);
    expect(loadPanelState("/fake/path.json")).toEqual(state);
  });

  it("degrades to empty state on malformed JSON rather than throwing", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue("{ not json" as any);
    expect(loadPanelState("/fake/path.json")).toEqual(emptyPanelState());
  });

  it("discards a file written by a different schema version", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: PANEL_STATE_VERSION + 1, lastSession: { count: 9 }, jobPresets: [] }) as any
    );
    expect(loadPanelState("/fake/path.json")).toEqual(emptyPanelState());
  });

  it("tolerates a file missing jobPresets entirely", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(
      JSON.stringify({ version: PANEL_STATE_VERSION, lastSession: { count: 2 } }) as any
    );
    const loaded = loadPanelState("/fake/path.json");
    expect(loaded.jobPresets).toEqual([]);
    expect(loaded.lastSession).toEqual({ count: 2 });
  });
});

describe("savePanelState", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.mkdirSync).mockReset();
    vi.mocked(fs.writeFileSync).mockReset();
  });

  it("creates the directory and writes the file", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const ok = savePanelState(emptyPanelState(), "/fake/dir/panel-state.json");
    expect(ok).toBe(true);
    expect(fs.mkdirSync).toHaveBeenCalledWith("/fake/dir", { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it("reports failure instead of throwing when the write fails", () => {
    // Autosave runs on ordinary UI edits — a disk error must never take the
    // panel down or interrupt what the user is typing.
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.writeFileSync).mockImplementation(() => {
      throw new Error("EACCES");
    });
    expect(savePanelState(emptyPanelState(), "/fake/dir/panel-state.json")).toBe(false);
  });

  it("does nothing when the path could not be resolved", () => {
    expect(savePanelState(emptyPanelState(), "")).toBe(false);
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
