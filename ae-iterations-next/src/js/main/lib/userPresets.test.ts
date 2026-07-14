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
