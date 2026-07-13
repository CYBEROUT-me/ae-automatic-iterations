// Unified iteration engine — replaces extension/jsx/host.jsx's
// runIterationsJSON body (lines 281–424). Parameterized via IterationStrategy
// so a future VAR-mode replacement for runVarIterationsJSON can reuse this
// same loop with a different strategy. Emoji handling from the original is
// out of scope for this plan (per Task 11's previewApply precedent).

import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { addEmojiToComp, removeEmojiFromComp } from "../lib/applyEmoji";
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
        removeEmojiFromComp(comp); // clear any leftover preview emoji before trusting layer indices
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

      // Emoji is independent of the layer-value gate above — it must run
      // even in emoji-only mode (no comp/layers selected), and it targets
      // all 4 render comps, not the single layer-value target comp.
      let emojiFootageName: string | null = null;
      if (cfg.emoji && cfg.emoji.enabled) {
        const emojiPath = cfg.emoji.perIteration[iter];
        if (emojiPath) {
          // Import once for this iteration; suppress must be OFF for
          // importFile to work. Both halves of this pair are inside the
          // loop body, so there's no cross-iteration suppression gap.
          app.endSuppressDialogs(false);
          let emojiFootage: FootageItem | null = null;
          try {
            const emojiFile = new File(emojiPath);
            if (emojiFile.exists) {
              emojiFootage = app.project.importFile(new ImportOptions(emojiFile)) as FootageItem;
            } else {
              warnings.push("Iter " + (iter + 1) + " emoji: file not found");
            }
          } catch (e: any) {
            warnings.push("Iter " + (iter + 1) + " emoji import: " + e.message);
          }
          app.beginSuppressDialogs();

          if (emojiFootage) {
            emojiFootageName = emojiFootage.name; // captured before close invalidates the reference
            const emojiComps = findCompsBySuffixes(ITR_SUFFIXES);
            for (let es = 0; es < ITR_SUFFIXES.length; es++) {
              const emojiComp = emojiComps[ITR_SUFFIXES[es]];
              if (!emojiComp) continue;
              try {
                addEmojiToComp(emojiComp, emojiFootage, cfg.emoji.x, cfg.emoji.y, cfg.emoji.layerIndex, cfg.emoji.size);
              } catch (e: any) {
                warnings.push("Iter " + (iter + 1) + " emoji [" + ITR_SUFFIXES[es] + "]: " + e.message);
              }
            }
          }
        }
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
      if (emojiFootageName) protectedNames.push(emojiFootageName);
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
