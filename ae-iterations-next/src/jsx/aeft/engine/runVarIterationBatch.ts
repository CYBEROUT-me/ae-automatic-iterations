// engine/runVarIterationBatch.ts — VAR mode's own orchestration function.
// NOT built on IterationStrategy: VAR's real phase order (render video before
// save, render PNG after reopen; branch fresh from one shared original copy
// each iteration rather than chaining forward) is different enough from
// ITR's that forcing it through the same loop would need more mode-hooks
// than the abstraction is worth. See docs/superpowers/specs/
// 2026-07-06-ae-iterations-var-mode-design.md, Decision 4.
//
// Ported from extension/jsx/host.jsx's runVarIterationsJSON (lines 429-690),
// with two deliberate deviations documented in this plan's Task 9 header.

import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { applyMediaLayer } from "../lib/applyMedia";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { stripAspectSuffix, VAR_ASPECT_SUFFIXES } from "../lib/naming";
import { findVarComp } from "../lib/findComp";
import type { RunVarConfig, RunResult } from "../../../shared/types";

export function runVarIterationBatch(cfg: RunVarConfig): RunResult {
  const projectFile = app.project.file;
  if (!projectFile) throw new Error("Project not saved. Save it first.");

  const warnings: string[] = [];

  app.project.save(projectFile);
  const tempFile = new File(projectFile.parent.fsName + "/__aeiter_tmp__.aep");
  if (tempFile.exists) {
    try {
      tempFile.remove();
    } catch (e) {}
  }
  if (!projectFile.copy(tempFile.fsName)) {
    throw new Error("Could not create temp copy of base project.");
  }

  const originalBase = stripAspectSuffix(projectFile.name.replace(/\.[^.]+$/, ""));

  app.beginSuppressDialogs();
  try {
    for (let iter = 0; iter < cfg.count; iter++) {
      const rawName = (cfg.varNames[iter] || "VAR" + (iter + 1)).replace(/\.aep$/i, "");
      const varName = rawName.replace(/[\/\\:*?"<>|]/g, "_");
      const varBase = stripAspectSuffix(varName);

      const varFile = new File(projectFile.parent.fsName + "/" + varName + ".aep");
      if (varFile.exists) {
        try {
          varFile.remove();
        } catch (e) {}
      }
      if (!tempFile.copy(varFile.fsName)) {
        warnings.push("VAR " + varName + ": could not copy base project, skipping.");
        continue;
      }

      // Open BETWEEN copy and rename: renaming below operates on app.project
      // (whichever document is currently active), so the copy must be open
      // first.
      app.open(varFile);

      const renderComps: Record<string, CompItem> = {};
      for (let rs = 0; rs < VAR_ASPECT_SUFFIXES.length; rs++) {
        const origRenderName = originalBase + "_" + VAR_ASPECT_SUFFIXES[rs];
        const ritem = findVarComp(origRenderName);
        if (ritem) {
          ritem.name = varBase + "_" + VAR_ASPECT_SUFFIXES[rs];
          renderComps[VAR_ASPECT_SUFFIXES[rs]] = ritem;
        }
      }

      // Lift suppression so importFile can show codec/alpha dialogs if
      // needed — importFile silently returns null while suppressed.
      app.endSuppressDialogs(false);

      const preImportedMedia: Record<number, FootageItem> = {};
      for (let pli = 0; pli < cfg.layers.length; pli++) {
        const plc = cfg.layers[pli];
        if (plc.layerType !== "media") continue;
        const pval = cfg.values[iter][pli];
        if (!pval || !pval.mediaPath) continue;
        try {
          const mf = new File(pval.mediaPath);
          if (!mf.exists) {
            warnings.push("VAR " + varName + " layer " + plc.index + ": media file not found");
            continue;
          }
          const fi = app.project.importFile(new ImportOptions(mf));
          if (fi) {
            preImportedMedia[plc.index] = fi as FootageItem;
          } else {
            warnings.push("VAR " + varName + " layer " + plc.index + ": importFile returned null");
          }
        } catch (e: any) {
          warnings.push("VAR " + varName + " layer " + plc.index + ": import error: " + e.message);
        }
      }

      // Restore suppression for apply / save / render / collect.
      app.beginSuppressDialogs();

      // Resolve the target comp: if cfg.compName ends with an aspect suffix,
      // it was one of the render comps just renamed above -> look up
      // varBase + that suffix. Otherwise it's a nested precomp that was
      // never touched -> look it up by its original name unchanged.
      const cfgCompBase = cfg.compName.replace(/\.aep$/i, "");
      let origAspect = "";
      for (let as = 0; as < VAR_ASPECT_SUFFIXES.length; as++) {
        const asSuffix = "_" + VAR_ASPECT_SUFFIXES[as];
        if (cfgCompBase.slice(-asSuffix.length) === asSuffix) {
          origAspect = VAR_ASPECT_SUFFIXES[as];
          break;
        }
      }
      const searchCompName = origAspect ? varBase + "_" + origAspect : cfgCompBase;
      const comp = findVarComp(searchCompName);
      if (!comp) {
        throw new Error("VAR " + varName + ": comp not found: " + searchCompName);
      }

      app.beginUndoGroup("VAR " + varName);
      for (let li = 0; li < cfg.layers.length; li++) {
        const lc = cfg.layers[li];
        const layer = comp.layer(lc.index);
        if (!layer) {
          warnings.push("VAR " + varName + ": layer " + lc.index + " not found");
          continue;
        }
        const val = cfg.values[iter][li];
        if (lc.layerType === "media") {
          const fi2 = preImportedMedia[lc.index];
          if (fi2) {
            const ok = applyMediaLayer(layer as AVLayer, fi2);
            if (!ok) warnings.push("VAR " + varName + ": replaceSource failed on layer " + lc.index);
          }
        } else {
          const log = applyLayerValue(layer, lc, val);
          for (const failure of applyLayerValueFailures(log)) {
            warnings.push("VAR " + varName + " layer " + lc.index + ": " + failure);
          }
        }
      }
      app.endUndoGroup();
      app.endSuppressDialogs(false);

      const gdFolder = new Folder(projectFile.parent.fsName + "/GD");
      if (!gdFolder.exists) gdFolder.create();
      const deliveryFolder = new Folder(gdFolder.fsName + "/" + varName);
      if (!deliveryFolder.exists) deliveryFolder.create();
      const collectFolder = new Folder(deliveryFolder.fsName + "/" + varName + " folder");
      if (!collectFolder.exists) collectFolder.create();

      // Render VIDEO now, while replaceSource media is still in-memory — the
      // render queue handles in-memory footage fine; saveFrameToPng (below,
      // after save+reopen) does not.
      try {
        renderVideos(renderComps, deliveryFolder, VAR_ASPECT_SUFFIXES);
      } catch (e: any) {
        warnings.push("VAR " + varName + " video: " + e.message);
      }

      // Save, then close+reopen so replaced footage loads from disk.
      app.project.save(varFile);
      app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
      app.beginSuppressDialogs();
      app.open(varFile);
      app.endSuppressDialogs(false);

      const cleanProtected: string[] = [];
      for (let cps = 0; cps < VAR_ASPECT_SUFFIXES.length; cps++) {
        cleanProtected.push(varBase + "_" + VAR_ASPECT_SUFFIXES[cps]);
        cleanProtected.push(varBase + "_" + VAR_ASPECT_SUFFIXES[cps] + ".aep");
      }
      try {
        cleanProject(cleanProtected);
      } catch (e: any) {
        warnings.push("VAR " + varName + " clean: " + e.message);
      }

      // Re-resolve the render comps by name AFTER the reload — the pre-reload
      // CompItem references in `renderComps` point at a stale object graph
      // and must not be reused here.
      const reloadedRenderComps: Record<string, CompItem> = {};
      for (let ps = 0; ps < VAR_ASPECT_SUFFIXES.length; ps++) {
        const pngCompName = varBase + "_" + VAR_ASPECT_SUFFIXES[ps];
        const pIt = findVarComp(pngCompName);
        if (pIt) reloadedRenderComps[VAR_ASPECT_SUFFIXES[ps]] = pIt;
      }
      try {
        renderPNGs(reloadedRenderComps, deliveryFolder, VAR_ASPECT_SUFFIXES);
      } catch (e: any) {
        warnings.push("VAR " + varName + " PNG: " + e.message);
      }

      try {
        performCollect(varFile, collectFolder);
      } catch (e: any) {
        warnings.push("VAR " + varName + " collect: " + e.message);
      }

      app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    }
  } finally {
    // Runs even if an iteration threw — a deliberate improvement over the
    // original, which skips this cleanup entirely on its error path.
    try {
      tempFile.remove();
    } catch (e) {}
    app.beginSuppressDialogs();
    app.open(projectFile);
    app.endSuppressDialogs(false);
  }

  return { warnings };
}
