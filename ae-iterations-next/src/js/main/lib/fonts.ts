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
  // Guards the same way listFontFiles()/extractPostscriptNames() below
  // already do: outside CEP's real Node integration (e.g. Vite's dev
  // server, which has no Node runtime backing it), `path`/`os` resolve to
  // inert stubs whose namespaces/methods aren't implemented, so calling
  // into them throws. loadFonts()'s default parameter calls this function
  // directly (unguarded) from a React effect with no error boundary above
  // it -- an uncaught throw there previously unmounted the entire panel.
  try {
    // Use path.win32/path.posix explicitly (not the bare path.join, which
    // aliases to whichever style matches the *host* OS actually running this
    // code) so the joined separators match the requested `platform` even when
    // it differs from the real host platform -- e.g. a test on macOS calling
    // fontDirectories("win32", ...) must still get backslash-joined paths.
    if (platform === "darwin") {
      return ["/System/Library/Fonts", "/Library/Fonts", path.posix.join(os.homedir(), "Library", "Fonts")];
    }
    if (platform === "win32") {
      const windir = env.WINDIR || "C:\\Windows";
      const dirs = [path.win32.join(windir, "Fonts")];
      if (env.LOCALAPPDATA) {
        dirs.push(path.win32.join(env.LOCALAPPDATA, "Microsoft", "Windows", "Fonts"));
      }
      return dirs;
    }
    return [];
  } catch (e) {
    return [];
  }
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

// A single font file yields one name; a collection (.ttc) yields one
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
