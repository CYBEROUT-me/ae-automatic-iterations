// Cross-platform persistence for the panel's own setup — the overlay and
// global configuration a user builds up before a run (mode, count, variant
// names, badge/logo/emoji settings). Stored alongside user-presets.json,
// outside the extension's installed folder so it survives updates, using
// the same explicit path.posix/path.win32 branching as userPresets.ts.
//
// Deliberately does NOT persist compName/layerInfo/rowLayers/values: those
// are keyed to one specific comp's layer indices, and silently re-applying
// them after the panel reopens against a different project would misapply
// values to whatever layer now happens to sit at that index. Those still
// require a Refresh, exactly as before.
//
// One file holds both the auto-restored last session and any named job
// presets, so a single read/write covers both features.

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Bumped only for a breaking shape change. Note that applySetup (see
// state/panelSetup.ts) validates every field individually and ignores
// anything it doesn't recognise, so additive changes do NOT need a bump —
// an older file simply restores fewer fields instead of being discarded.
export const PANEL_STATE_VERSION = 1;

export interface PanelSetup {
  mode?: string;
  count?: number;
  sameForAll?: boolean;
  varNames?: string[];
  emojiEnabled?: boolean;
  emojiPaths?: (string | null)[];
  emojiX?: number;
  emojiY?: number;
  emojiSize?: number;
  emojiLayerIndex?: number;
  badgeEnabled?: boolean;
  badgeTexts?: (string | null)[];
  badgeX?: number;
  badgeY?: number;
  badgeSize?: number;
  badgeCircleColor?: [number, number, number];
  badgeTextColor?: [number, number, number];
  badgeLayerIndex?: number;
  badgeEnabledPerIteration?: boolean[];
  logoEnabled?: boolean;
  logoPath?: string | null;
  logoX?: number;
  logoY?: number;
  logoSize?: number;
  logoLayerIndex?: number;
  logoPerIteration?: boolean[];
}

export interface JobPreset {
  name: string;
  setup: PanelSetup;
}

export interface PanelStateFile {
  version: number;
  lastSession: PanelSetup | null;
  jobPresets: JobPreset[];
}

export function emptyPanelState(): PanelStateFile {
  return { version: PANEL_STATE_VERSION, lastSession: null, jobPresets: [] };
}

// Guarded exactly like userPresetsPath(): outside CEP's real Node
// integration, `path`/`os` resolve to inert stubs that throw when called,
// and this runs during panel mount where an uncaught throw would unmount
// the whole panel.
export function panelStatePath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homedir: string = ""
): string {
  try {
    const resolvedHomedir = homedir || os.homedir();
    if (platform === "win32") {
      return path.win32.join(env.APPDATA || resolvedHomedir, "AE Iterations", "panel-state.json");
    }
    return path.posix.join(resolvedHomedir, "Library", "Application Support", "AE Iterations", "panel-state.json");
  } catch (e) {
    return "";
  }
}

// Always returns a usable object — a missing, unreadable, malformed, or
// future-versioned file degrades to "no saved state" rather than throwing,
// since this is called during mount.
export function loadPanelState(filePath: string = panelStatePath()): PanelStateFile {
  try {
    if (!filePath || !fs.existsSync(filePath)) return emptyPanelState();
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object") return emptyPanelState();
    if (parsed.version !== PANEL_STATE_VERSION) return emptyPanelState();
    return {
      version: PANEL_STATE_VERSION,
      lastSession: parsed.lastSession && typeof parsed.lastSession === "object" ? parsed.lastSession : null,
      jobPresets: Array.isArray(parsed.jobPresets) ? parsed.jobPresets : [],
    };
  } catch (e) {
    return emptyPanelState();
  }
}

// Never throws: this runs on a debounced autosave triggered by ordinary
// UI edits, and a disk failure there must not take the panel down or
// interrupt what the user is doing.
export function savePanelState(state: PanelStateFile, filePath: string = panelStatePath()): boolean {
  try {
    if (!filePath) return false;
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
    return true;
  } catch (e) {
    return false;
  }
}
