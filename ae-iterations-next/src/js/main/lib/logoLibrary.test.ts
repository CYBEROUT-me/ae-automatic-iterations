// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { logoLibraryPath, listLogoFiles } from "./logoLibrary";

vi.mock("fs");

describe("logoLibraryPath", () => {
  it("resolves the macOS Application Support path", () => {
    const p = logoLibraryPath("darwin", {}, "/Users/test");
    expect(p).toBe("/Users/test/Library/Application Support/AE Iterations/logos");
  });

  it("resolves the Windows APPDATA path when APPDATA is set", () => {
    const p = logoLibraryPath("win32", { APPDATA: "C:\\Users\\Test\\AppData\\Roaming" }, "C:\\Users\\Test");
    expect(p).toBe("C:\\Users\\Test\\AppData\\Roaming\\AE Iterations\\logos");
  });

  it("falls back to homedir on Windows when APPDATA is unset", () => {
    const p = logoLibraryPath("win32", {}, "C:\\Users\\Test");
    expect(p).toBe("C:\\Users\\Test\\AE Iterations\\logos");
  });
});

describe("listLogoFiles", () => {
  beforeEach(() => {
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.mkdirSync).mockReset();
    vi.mocked(fs.readdirSync).mockReset();
    vi.mocked(fs.statSync).mockReset();
  });

  it("creates the folder and returns [] when it doesn't exist yet", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    expect(listLogoFiles("/fake/logos")).toEqual([]);
    expect(fs.mkdirSync).toHaveBeenCalledWith("/fake/logos", { recursive: true });
  });

  it("returns image files as absolute paths, sorted, skipping non-images", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockReturnValue(["b.png", "a.jpg", "readme.txt", "c.PNG"] as any);
    vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
    expect(listLogoFiles("/fake/logos")).toEqual([
      "/fake/logos/a.jpg",
      "/fake/logos/b.png",
      "/fake/logos/c.PNG",
    ]);
  });

  it("recurses into subfolders (e.g. one per brand/client)", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockImplementation((dir: any) => {
      if (dir === "/fake/logos") return ["BrandA", "top.png"] as any;
      if (dir === "/fake/logos/BrandA") return ["a-icon.png"] as any;
      return [] as any;
    });
    vi.mocked(fs.statSync).mockImplementation((p: any) => ({ isDirectory: () => String(p).endsWith("BrandA") }) as any);
    expect(listLogoFiles("/fake/logos")).toEqual(["/fake/logos/BrandA/a-icon.png", "/fake/logos/top.png"]);
  });

  it("returns [] without throwing when reading the directory fails", () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readdirSync).mockImplementation(() => {
      throw new Error("EACCES");
    });
    expect(listLogoFiles("/fake/logos")).toEqual([]);
  });
});
