import { dispatchTS } from "../utils/utils";
import { getLayerType, collectFills, collectStrokes, readVideoLayerState } from "./lib/layerUtils";
import { findCompByName } from "./lib/findComp";
import { applyLayerValue } from "./lib/applyLayerValue";
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
// debugApplyChangeJSON (lines 235-276), minus the ITR-comp listing and emoji
// removal (both out of scope for this plan).
export const previewApply = (cfg: { compName: string; layers: CfgLayer[]; values: LayerValue[] }): { log: string[] } => {
  const comp = findCompByName(cfg.compName);
  if (!comp) throw new Error("Comp not found: " + cfg.compName);

  const log: string[] = [];
  app.beginSuppressDialogs();
  app.beginUndoGroup("Preview Apply");
  for (let li = 0; li < cfg.layers.length; li++) {
    const lc = cfg.layers[li];
    // Plain index lookup, no name-fallback: there's no emoji/index-shifting
    // feature in this plan yet. A future phase that inserts layers into the
    // comp (e.g. emoji overlay) must reintroduce name-fallback resolution
    // (like the original extension's `resolveLayer` in extension/jsx/host.jsx)
    // or index-based layer targeting will silently break.
    const layer = comp.layer(lc.index);
    if (!layer) {
      log.push("Layer " + lc.index + ": NOT FOUND");
      continue;
    }
    log.push("Layer " + lc.index + ": " + layer.name + "  [" + lc.layerType + "]");
    log.push(...applyLayerValue(layer, lc, cfg.values[li]).map((l) => "  " + l));
  }
  app.endUndoGroup();
  app.endSuppressDialogs(false);

  return { log };
};

// Runs the full 5-iteration (or cfg.count-iteration) ITR batch: apply layer
// values, save/close/reopen, render PNGs+videos, clean project panel,
// collect to a self-contained folder, then advance to the next copied
// project via ITR_STRATEGY. Ported from host.jsx's runIterationsJSON
// (lines 281-424), minus emoji handling (out of scope for this plan).
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
