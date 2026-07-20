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

// Guarded the same way fonts.ts's fontDirectories() is: outside CEP's real
// Node integration (e.g. Vite's dev server, which has no Node runtime
// backing it), `path`/`os` resolve to inert stubs whose namespaces/methods
// aren't implemented, so calling into them throws. loadUserPresets()'s
// default parameter calls this function directly (unguarded) from
// PresetPanel's initial state -- an uncaught throw there previously
// unmounted the entire panel the moment the Presets toggle was opened.
export function userPresetsPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = ""
): string {
  try {
    const resolvedHomedir = homedir || os.homedir();
    if (platform === "win32") {
      return path.win32.join(env.APPDATA || resolvedHomedir, "AE Iterations", "user-presets.json");
    }
    return path.posix.join(resolvedHomedir, "Library", "Application Support", "AE Iterations", "user-presets.json");
  } catch (e) {
    return "";
  }
}

export function loadUserPresets(filePath: string = userPresetsPath()): Preset[] {
  try {
    if (!filePath || !fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return [];
  }
}

export function saveUserPresets(presets: Preset[], filePath: string = userPresetsPath()): void {
  if (!filePath) return;
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(presets, null, 2), "utf8");
}
