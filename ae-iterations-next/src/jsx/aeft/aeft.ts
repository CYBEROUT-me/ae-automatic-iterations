import { dispatchTS } from "../utils/utils";
import { getLayerType, collectFills, collectStrokes, readVideoLayerState } from "./lib/layerUtils";
import { findCompByName, findCompsBySuffixes, resolveLayer, ITR_SUFFIXES } from "./lib/findComp";
import { applyLayerValue } from "./lib/applyLayerValue";
import { applyMediaLayer } from "./lib/applyMedia";
import { addEmojiToComp, removeEmojiFromComp } from "./lib/applyEmoji";
import { runIterationBatch } from "./engine/runIterationBatch";
import { ITR_STRATEGY } from "./engine/strategies/itrStrategy";
import { runVarIterationBatch } from "./engine/runVarIterationBatch";
import { stripAspectSuffix, VAR_ASPECT_SUFFIXES } from "./lib/naming";
import { findVarComp } from "./lib/findComp";
import type {
  LayerInfoResult,
  LayerInfo,
  CfgLayer,
  LayerValue,
  RunConfig,
  RunResult,
  RunVarConfig,
  TestVarCompsResult,
} from "../../shared/types";

export const ping = (name: string): { message: string } => {
  return { message: "pong: " + name };
};

export const getLayerInfo = (): LayerInfoResult => {
  const comp = app.project.activeItem;
  if (!(comp instanceof CompItem)) throw new Error("No active composition");
  const sel = comp.selectedLayers;
  if (sel.length === 0) throw new Error("No layer selected");

  const layers: LayerInfo[] = [];
  for (let i = 0; i < sel.length; i++) {
    const layer = sel[i];
    const type = getLayerType(layer);
    const info: LayerInfo = { name: layer.name, index: layer.index, type };
    if (type === "shape") {
      info.fills = collectFills((layer as ShapeLayer).property("Contents"), "Contents");
      info.strokes = collectStrokes((layer as ShapeLayer).property("Contents"), "Contents");
    } else if (type === "text") {
      const td = (layer as TextLayer).sourceText.value;
      info.color = td.fillColor;
      info.font = td.font;
      info.text = td.text;
    } else if (type === "video") {
      info.videoState = readVideoLayerState(layer as AVLayer);
    }
    layers.push(info);
  }

  return { compName: comp.name, layers };
};

// Applies one iteration's values to the target comp's layers in place, for
// live in-AE preview. Wrapped in a single undo group so the panel's Preview
// button is one Ctrl+Z away from a no-op. Ported from host.jsx's
// debugApplyChangeJSON (lines 235-276), minus the ITR-comp listing (out of
// scope for this plan). The emoji-removal step IS ported: without it, a
// leftover emoji-preview layer shifts every subsequent layer's index by one,
// and stroke rows (whose CfgLayer.name is a synthetic label no real AE layer
// has) have no by-name fallback to recover from a stale index.
export const previewApply = (cfg: { compName: string; layers: CfgLayer[]; values: LayerValue[] }): { log: string[] } => {
  const comp = findCompByName(cfg.compName);
  if (!comp) throw new Error("Comp not found: " + cfg.compName);

  const log: string[] = [];
  app.beginUndoGroup("Preview Apply");
  app.beginSuppressDialogs();
  removeEmojiFromComp(comp);

  // Media swaps need importFile, which (per runVarIterationBatch) silently
  // returns null while dialogs are suppressed -- lift suppression just for
  // the import pass, then restore it for the rest of the apply.
  app.endSuppressDialogs(false);
  const preImportedMedia: Record<number, FootageItem> = {};
  for (let pli = 0; pli < cfg.layers.length; pli++) {
    const plc = cfg.layers[pli];
    if (plc.layerType !== "media") continue;
    const pval = cfg.values[pli];
    if (!pval || !pval.mediaPath) continue;
    try {
      const mf = new File(pval.mediaPath);
      if (!mf.exists) {
        log.push("Layer " + plc.index + ": media file not found");
        continue;
      }
      const fi = app.project.importFile(new ImportOptions(mf));
      if (fi) {
        preImportedMedia[plc.index] = fi as FootageItem;
      } else {
        log.push("Layer " + plc.index + ": importFile returned null");
      }
    } catch (e: any) {
      log.push("Layer " + plc.index + ": import error: " + e.message);
    }
  }
  app.beginSuppressDialogs();

  for (let li = 0; li < cfg.layers.length; li++) {
    const lc = cfg.layers[li];
    const layer = resolveLayer(comp, lc);
    if (!layer) {
      log.push("Layer " + lc.index + ": NOT FOUND");
      continue;
    }
    log.push("Layer " + lc.index + ": " + layer.name + "  [" + lc.layerType + "]");
    if (lc.layerType === "media") {
      const fi = preImportedMedia[lc.index];
      if (fi) {
        const ok = applyMediaLayer(layer as AVLayer, fi, !!cfg.values[li].flip);
        log.push("  → mediaSwap: " + (ok ? "OK" : "FAILED"));
      }
    }
    // Plain for-loop, not .map(...): confirmed live in real After Effects
    // that Array.prototype.map is simply missing from this ExtendScript
    // engine — a standalone in-engine probe of map/filter/forEach/for-of/
    // spread/indexOf/Object.keys/slice showed every one of those working
    // EXCEPT .map, which threw "Function X.map is undefined" even on a
    // plain local array with no cross-function boundary involved. vitest
    // can't catch this — it runs this code in Node, where .map is normal.
    const results = applyLayerValue(layer, lc, cfg.values[li]);
    for (let ri = 0; ri < results.length; ri++) {
      log.push("  " + results[ri]);
    }
  }
  app.endUndoGroup();
  app.endSuppressDialogs(false);

  return { log };
};

// Renders frame 0 of a comp to a fixed temp-file path (overwritten on every
// call -- no per-call unique filename, so no temp-file accumulation across
// repeated popup opens) and reports its pixel dimensions, backing the
// visual position-picker popup. Falls back to the active comp when no
// compName is given, matching previewApply's own comp-resolution fallback.
export const renderPreviewFrame = (cfg?: { compName?: string }): { path: string; width: number; height: number } => {
  let comp: CompItem | null = null;
  if (cfg && cfg.compName) comp = findCompByName(cfg.compName);
  if (!comp && app.project.activeItem instanceof CompItem) comp = app.project.activeItem;
  if (!comp) throw new Error("No comp found. Refresh a layer first.");

  const outFile = new File(Folder.temp.fsName + "/aeiter_position_preview.png");
  comp.saveFrameToPng(0, outFile);

  return { path: outFile.fsName, width: comp.width, height: comp.height };
};

// Inserts a temporary, undo-groupable emoji layer into the active comp (or
// falls back to any found ITR render comp) so the user can check
// position/size before running a real batch. Ported from host.jsx's
// previewEmojiJSON.
export const previewEmoji = (cfg: {
  emojiPath: string;
  x: number;
  y: number;
  size: number;
  layerIndex: number;
}): { compName: string } => {
  let comp: CompItem | null = null;
  if (app.project.activeItem instanceof CompItem) {
    comp = app.project.activeItem;
  } else {
    const itrComps = findCompsBySuffixes(ITR_SUFFIXES);
    comp = itrComps["ITR_9x16"] || itrComps["ITR_1x1"] || itrComps["ITR_16x9"] || itrComps["ITR_4x5"] || null;
  }
  if (!comp) throw new Error("No active comp found. Open a comp first.");

  const file = new File(cfg.emojiPath);
  if (!file.exists) throw new Error("Emoji file not found: " + cfg.emojiPath);

  app.beginUndoGroup("Emoji Preview");
  try {
    const footage = app.project.importFile(new ImportOptions(file)) as FootageItem;
    if (!footage) throw new Error("Could not import emoji");
    addEmojiToComp(comp, footage, cfg.x, cfg.y, cfg.layerIndex, cfg.size);
  } finally {
    app.endUndoGroup();
  }

  return { compName: comp.name };
};

// Runs the full 5-iteration (or cfg.count-iteration) ITR batch: apply layer
// values, apply the per-iteration emoji overlay, save/close/reopen, render
// PNGs+videos, clean project panel, collect to a self-contained folder, then
// advance to the next copied project via ITR_STRATEGY. Ported from host.jsx's
// runIterationsJSON (lines 281-424).
export const runIterations = (cfg: RunConfig): RunResult => {
  return runIterationBatch(cfg, ITR_STRATEGY);
};

// Thin wrapper around VAR mode's own orchestration function (see
// runVarIterationBatch's header for why it isn't built on IterationStrategy).
export const runVarIterations = (cfg: RunVarConfig): RunResult => {
  return runVarIterationBatch(cfg);
};

// Read-only diagnostic scan: reports which of the 4 VAR render comps
// (9x16/1x1/16x9/4x5) exist in the currently open project, plus a full list
// of every comp in the project. Ported from host.jsx's testVarRenderCompsJSON
// (lines 696-760), minus the cfg.varNames echo section (out of scope for
// this plan — it only affects diagnostic text about names that *would* be
// used, not the comp-presence check that's this function's actual purpose).
export const testVarRenderComps = (): TestVarCompsResult => {
  const projectFile = app.project.file;
  if (!projectFile) throw new Error("Project not saved. Save it first.");

  const log: string[] = [];
  const originalBase = stripAspectSuffix(projectFile.name.replace(/\.[^.]+$/, ""));
  log.push("Project: " + projectFile.name);
  log.push("Base name: " + originalBase);
  log.push("");
  log.push("Scanning for render comps in current project:");

  let foundCount = 0;
  for (let s = 0; s < VAR_ASPECT_SUFFIXES.length; s++) {
    const targetName = originalBase + "_" + VAR_ASPECT_SUFFIXES[s];
    const found = findVarComp(targetName);
    if (found) {
      foundCount++;
      log.push(
        "  OK  " + found.name +
          "  (" + found.width + "x" + found.height +
          "  " + Math.round(found.duration * 100) / 100 + "s" +
          "  " + found.numLayers + " layers" +
          "  " + Math.round(found.frameRate * 10) / 10 + " fps)"
      );
    } else {
      log.push("  MISSING  " + targetName);
    }
  }

  log.push("");
  log.push(foundCount + " / " + VAR_ASPECT_SUFFIXES.length + " render comps found.");
  log.push("");
  log.push("All compositions in project:");
  for (let ac = 1; ac <= app.project.numItems; ac++) {
    const acItem = app.project.item(ac);
    if (acItem instanceof CompItem) {
      log.push("  " + acItem.name + "  (" + acItem.width + "x" + acItem.height + ")");
    }
  }

  return { log };
};

// Wraps File.openDialog for the panel's "browse for media" file picker
// (VAR mode's per-layer media-swap feature).
export const browseForMedia = (): { path: string | null } => {
  const f = File.openDialog("Select media file");
  if (!f) return { path: null };
  return { path: f.fsName };
};

// Scans the bundled emojis/ folder (copied verbatim into dist/cep/emojis/ at
// build time from extension/emojis/ by vite.config.ts's copyEmojisPlugin --
// plain `publicDir` can't do this, since it flattens directory contents into
// the root of outDir instead of preserving the emojis/ folder name; see the
// comment above copyEmojisPlugin in vite.config.ts) and returns image files,
// sorted by name. There is no ExtendScript equivalent
// of the panel-side cs.getSystemPath(SystemPath.EXTENSION), so this locates
// the folder by walking up from the currently-executing jsx bundle's own
// install path: dist/cep/jsx/index.js -> dist/cep/jsx -> dist/cep (the
// extension root, sibling to emojis/).
export const listEmojiFiles = (): { files: { path: string; name: string }[] } => {
  const scriptFile = new File($.fileName);
  const extensionRoot = scriptFile.parent.parent;
  const emojiFolder = new Folder(extensionRoot.fsName + "/emojis");
  if (!emojiFolder.exists) throw new Error("emojis/ folder not found at " + emojiFolder.fsName);

  const imgExts = [".gif", ".png", ".jpg", ".jpeg", ".webp"];
  const entries = emojiFolder.getFiles();
  const files: { path: string; name: string }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const f = entries[i];
    if (!(f instanceof File)) continue;
    const dot = f.name.lastIndexOf(".");
    if (dot === -1) continue;
    const ext = f.name.slice(dot).toLowerCase();
    if (imgExts.indexOf(ext) === -1) continue;
    files.push({ path: f.fsName, name: f.name });
  }
  files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return { files };
};
