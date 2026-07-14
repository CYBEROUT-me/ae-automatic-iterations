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
