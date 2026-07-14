// This file's default project environment (jsdom, set in vitest.config.ts)
// breaks bare `vi.mock("fs")`: under jsdom, Vite's SSR loader treats Node
// builtins as fully external and never transforms their source, so
// automocking silently no-ops (fs.readdirSync stays the real function). It
// also resolves the bare "path" specifier to a stray legacy npm package
// (node_modules/path@0.12.7, pulled in transitively by
// babel-plugin-transform-scss) instead of Node's builtin, which throws
// `util.isString is not a function` on modern Node. Both are fixed by
// running this file under Vitest's "node" environment instead — verified
// locally: mocking + path resolution both work correctly under "node" but
// not under "jsdom". This module has no DOM dependency, so "node" is also
// the semantically correct environment for it.
// @vitest-environment node
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
