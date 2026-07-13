// Unified iteration engine — replaces extension/jsx/host.jsx's
// runIterationsJSON body (lines 281–424). Parameterized via IterationStrategy
// so a future VAR-mode replacement for runVarIterationsJSON can reuse this
// same loop with a different strategy. Emoji handling from the original is
// out of scope for this plan (per Task 11's previewApply precedent).

import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { findCompByName, findCompsBySuffixes, resolveLayer, ITR_SUFFIXES } from "../lib/findComp";
import type { RunConfig, RunResult } from "../../../shared/types";

export interface TargetState {
  file: File;
  compName: string;
}

export interface IterationStrategy {
  // Given the current target, produce the file+comp name for the NEXT iteration.
  // Called after finishing iteration `iter`, only when iter < count - 1.
  nextTarget(current: TargetState, iter: number): TargetState;
  // Optional extra work to run against the target comp before render (no-op for ITR core in this plan).
  perIterationExtra?(comp: CompItem, iter: number): void;
  // Folder name (under GD/) for this iteration's delivery output.
  outputFolderName(target: TargetState, iter: number): string;
}

export function runIterationBatch(cfg: RunConfig, strategy: IterationStrategy): RunResult {
  const projectFile = app.project.file;
  if (!projectFile) throw new Error("Project not saved. Save it first.");

  let current: TargetState = { file: projectFile, compName: cfg.compName };
  const warnings: string[] = [];

  app.beginSuppressDialogs();
  try {
    for (let iter = 0; iter < cfg.count; iter++) {
      if (current.compName && cfg.layers.length > 0) {
        const comp = findCompByName(current.compName);
        if (!comp) throw new Error("Iter " + (iter + 1) + ": comp not found: " + current.compName);

        app.beginUndoGroup("Iteration " + (iter + 1));
        for (let li = 0; li < cfg.layers.length; li++) {
          const lc = cfg.layers[li];
          const layer = resolveLayer(comp, lc);
          if (!layer) {
            warnings.push("Iter " + (iter + 1) + ": layer " + lc.index + " not found");
            continue;
          }
          const val = cfg.values[iter][li];
          const log = applyLayerValue(layer, lc, val);
          for (const failure of applyLayerValueFailures(log)) {
            warnings.push("Iter " + (iter + 1) + " layer " + lc.index + ": " + failure);
          }
        }
        app.endUndoGroup();

        if (strategy.perIterationExtra) strategy.perIterationExtra(comp, iter);
      }

      app.project.save(current.file);
      app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      app.open(current.file);

      const baseName = current.file.name.replace(/\.[^.]+$/, "");
      const gdFolder = new Folder(current.file.parent.fsName + "/GD");
      if (!gdFolder.exists) gdFolder.create();
      const deliveryFolder = new Folder(gdFolder.fsName + "/" + strategy.outputFolderName(current, iter));
      if (!deliveryFolder.exists) deliveryFolder.create();
      const collectFolder = new Folder(deliveryFolder.fsName + "/" + baseName + " folder");
      if (!collectFolder.exists) collectFolder.create();

      const itrComps = findCompsBySuffixes(ITR_SUFFIXES);
      try {
        renderPNGs(itrComps, deliveryFolder, ITR_SUFFIXES);
      } catch (e: any) {
        warnings.push("Iter " + (iter + 1) + " PNG: " + e.message);
      }
      try {
        renderVideos(itrComps, deliveryFolder, ITR_SUFFIXES);
      } catch (e: any) {
        warnings.push("Iter " + (iter + 1) + " video: " + e.message);
      }

      const protectedNames: string[] = [];
      for (let s = 0; s < ITR_SUFFIXES.length; s++) {
        const comp = itrComps[ITR_SUFFIXES[s]];
        if (comp) protectedNames.push(comp.name);
      }
      try {
        cleanProject(protectedNames);
      } catch (e: any) {
        warnings.push("Iter " + (iter + 1) + " clean: " + e.message);
      }
      try {
        performCollect(current.file, collectFolder);
      } catch (e: any) {
        warnings.push("Iter " + (iter + 1) + " collect: " + e.message);
      }

      if (iter < cfg.count - 1) {
        // strategy.nextTarget already makes the copied project the active
        // document (copyProject -> app.open -> renameComps) before returning,
        // so no separate app.open is needed here.
        current = strategy.nextTarget(current, iter);
      }
    }
  } finally {
    app.endSuppressDialogs(false);
  }

  return { warnings };
}
