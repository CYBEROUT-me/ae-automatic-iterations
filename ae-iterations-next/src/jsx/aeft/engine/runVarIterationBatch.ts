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
//
// Setup, per-variant work and teardown are exposed as three separate
// functions so the panel can drive the run one variant at a time (see
// aeft.ts's varRunBegin/varRunStep/varRunEnd commands). Running the whole
// batch inside a single ExtendScript call held AE's main thread for the
// entire job — no progress, no way to stop, and an unresponsive app for
// minutes. Splitting it lets AE breathe between variants and makes
// cancelling possible at all. runVarIterationBatch() remains as a
// single-call wrapper over the same three pieces.

import { applyLayerValue, applyLayerValueFailures } from "../lib/applyLayerValue";
import { applyMediaLayer } from "../lib/applyMedia";
import { addBadgeToComp, removeBadgeFromComp } from "../lib/applyBadge";
import { addLogoToComp, removeLogoFromComp } from "../lib/applyLogo";
import { resolveOverlayAttachment } from "../lib/applyImageOverlay";
import { renderPNGs, renderVideos } from "../lib/render";
import { cleanProject } from "../lib/clean";
import { performCollect } from "../lib/collect";
import { stripAspectSuffix, VAR_ASPECT_SUFFIXES } from "../lib/naming";
import { findVarComp } from "../lib/findComp";
import { reportProgress } from "../lib/progress";
import type { RunVarConfig, RunResult } from "../../../shared/types";

// Everything a step needs that is established once, before any variant
// runs. Held by the caller (aeft.ts keeps it in module scope) so it
// survives between the separate evalTS calls that drive a chunked run.
export interface VarRunContext {
  projectFile: File;
  tempFile: File;
  originalBase: string;
}

export function varRunBegin(): VarRunContext {
  const projectFile = app.project.file;
  if (!projectFile) throw new Error("Project not saved. Save it first.");

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

  return {
    projectFile: projectFile,
    tempFile: tempFile,
    originalBase: stripAspectSuffix(projectFile.name.replace(/\.[^.]+$/, "")),
  };
}

// Safe to call more than once, and safe to call after a step threw — a
// cancelled or failed run has to be able to unwind without leaving the
// temp copy behind or the user staring at a variant project instead of
// the one they started from.
export function varRunEnd(ctx: VarRunContext): void {
  try {
    ctx.tempFile.remove();
  } catch (e) {}
  try {
    app.beginSuppressDialogs();
    app.open(ctx.projectFile);
    app.endSuppressDialogs(false);
  } catch (e) {}
}

// Produces exactly one variant. Returns its warnings rather than throwing
// for recoverable problems, matching the aggregation the batch wrapper
// has always done.
export function varRunStep(ctx: VarRunContext, cfg: RunVarConfig, iter: number): string[] {
  const warnings: string[] = [];
  const projectFile = ctx.projectFile;
  const tempFile = ctx.tempFile;
  const originalBase = ctx.originalBase;
  const stepLabel = "Variant " + (iter + 1) + "/" + cfg.count;

  const rawName = (cfg.varNames[iter] || "VAR" + (iter + 1)).replace(/\.aep$/i, "");
  const varName = rawName.replace(/[\/\\:*?"<>|]/g, "_");
  const varBase = stripAspectSuffix(varName);
  reportProgress(stepLabel + " — preparing " + varName);

  const varFile = new File(projectFile.parent.fsName + "/" + varName + ".aep");
  if (varFile.exists) {
    // A project file with this exact name already exists -- almost
    // certainly a previous run under the same VAR name, about to be
    // replaced along with its delivery/collect folder. Surfacing this
    // is the whole fix: the overwrite itself is intentional (re-running
    // the same name is the normal fast-iteration workflow), it just
    // must never happen silently.
    warnings.push("VAR " + varName + ": overwrote existing project file and output from a previous run.");
    try {
      varFile.remove();
    } catch (e) {}
  }
  if (!tempFile.copy(varFile.fsName)) {
    warnings.push("VAR " + varName + ": could not copy base project, skipping.");
    return warnings;
  }

  // Open BETWEEN copy and rename: renaming below operates on app.project
  // (whichever document is currently active), so the copy must be open
  // first.
  app.beginSuppressDialogs();
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

  // Logo's import shares this same lifted-suppression window -- it's the
  // same importFile-silently-returns-null-while-suppressed constraint as
  // media above, so there's no reason to open a second window for it.
  let logoFootage: FootageItem | null = null;
  if (cfg.logo && cfg.logo.enabled && cfg.logo.path) {
    try {
      const lf = new File(cfg.logo.path);
      if (!lf.exists) {
        warnings.push("VAR " + varName + ": logo file not found");
      } else {
        logoFootage = app.project.importFile(new ImportOptions(lf)) as FootageItem;
        if (!logoFootage) warnings.push("VAR " + varName + ": logo importFile returned null");
      }
    } catch (e: any) {
      warnings.push("VAR " + varName + ": logo import error: " + e.message);
    }
  }

  // Restore suppression for apply / save / render / collect.
  app.beginSuppressDialogs();

  // Resolve the target comp: if cfg.compName ends with an aspect suffix,
  // it was one of the render comps just renamed above -> look up
  // varBase + that suffix. Otherwise it's a nested precomp that was
  // never touched -> look it up by its original name unchanged.
  // cfg.compName is empty for a badge/logo-only run (no layer was ever
  // selected/refreshed) -- that's not an error, since layer-value
  // application is genuinely optional (badge/logo apply independently,
  // via renderComps["9x16"] below, regardless of comp). Only warn (not
  // throw) so the rest of this iteration -- including badge/logo --
  // still runs.
  let comp: CompItem | null = null;
  if (cfg.compName) {
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
    comp = findVarComp(searchCompName);
    if (!comp) {
      warnings.push("VAR " + varName + ": comp not found: " + searchCompName + " (layer values skipped)");
    }
  }

  reportProgress(stepLabel + " — applying values");
  app.beginUndoGroup("VAR " + varName);
  if (comp) {
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
          const ok = applyMediaLayer(layer as AVLayer, fi2, !!val.flip);
          if (!ok) warnings.push("VAR " + varName + ": replaceSource failed on layer " + lc.index);
        }
      }
      const log = applyLayerValue(layer, lc, val);
      for (const failure of applyLayerValueFailures(log)) {
        warnings.push("VAR " + varName + " layer " + lc.index + ": " + failure);
      }
    }
  }

  // Badge/logo apply only to the 9x16 render comp, never 1x1/16x9/4x5 --
  // independent of the per-layer loop above, same as Emoji is
  // independent of the layer-value gate in ITR mode. Remove-before-add
  // runs even though VAR doesn't chain iterations forward (unlike ITR):
  // it's defending against a leftover Preview-button badge/logo layer
  // that got saved into `tempFile` before this loop ever started (see
  // this task's "watch out for" item 2).
  const badgeLogoComp = renderComps["9x16"];
  if (badgeLogoComp) {
    // Resolve BOTH overlays' attach-to-layer targets BEFORE either
    // touches this comp -- badge's own two layers get inserted at the
    // top, which shifts every existing layer's index by 2. Resolving
    // "attach to layer N" after that (for either overlay) would resolve
    // against the other overlay's own inserted layers instead of the
    // comp's real layer N. See resolveOverlayAttachment's header.
    const badgeAttachLayer = cfg.badge && cfg.badge.enabled
      ? resolveOverlayAttachment(badgeLogoComp, cfg.badge.layerIndex)
      : null;
    const logoAttachLayer = cfg.logo && cfg.logo.enabled && logoFootage
      ? resolveOverlayAttachment(badgeLogoComp, cfg.logo.layerIndex)
      : null;

    if (cfg.badge && cfg.badge.enabled) {
      removeBadgeFromComp(badgeLogoComp);
      const badgeText = cfg.badge.perIteration[iter];
      // enabledPerIteration[iter] undefined (array shorter than count,
      // or omitted entirely) defaults to true, same convention as
      // Logo's perIteration.
      const badgeOnThisIter = !cfg.badge.enabledPerIteration || cfg.badge.enabledPerIteration[iter] !== false;
      if (badgeText && badgeOnThisIter) {
        addBadgeToComp(badgeLogoComp, badgeText, cfg.badge.x, cfg.badge.y, cfg.badge.size, cfg.badge.circleColor, cfg.badge.textColor, badgeAttachLayer);
      }
    }
    if (cfg.logo && cfg.logo.enabled && logoFootage) {
      removeLogoFromComp(badgeLogoComp);
      // perIteration[iter] undefined (array shorter than count, or
      // omitted entirely) defaults to true -- applies to every
      // iteration, the pre-existing behavior before this per-iteration
      // toggle existed.
      const applyThisIter = !cfg.logo.perIteration || cfg.logo.perIteration[iter] !== false;
      if (applyThisIter) {
        addLogoToComp(badgeLogoComp, logoFootage, cfg.logo.x, cfg.logo.y, cfg.logo.size, logoAttachLayer);
      }
    }
  } else if ((cfg.badge && cfg.badge.enabled) || (cfg.logo && cfg.logo.enabled)) {
    warnings.push("VAR " + varName + ": 9x16 render comp not found, badge/logo skipped");
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
  reportProgress(stepLabel + " — rendering video");
  try {
    renderVideos(renderComps, deliveryFolder, VAR_ASPECT_SUFFIXES);
  } catch (e: any) {
    warnings.push("VAR " + varName + " video: " + e.message);
  }

  // Save, then close+reopen so replaced footage loads from disk.
  reportProgress(stepLabel + " — saving and reopening");
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
  reportProgress(stepLabel + " — cleaning project");
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
  reportProgress(stepLabel + " — rendering stills");
  try {
    renderPNGs(reloadedRenderComps, deliveryFolder, VAR_ASPECT_SUFFIXES);
  } catch (e: any) {
    warnings.push("VAR " + varName + " PNG: " + e.message);
  }

  reportProgress(stepLabel + " — collecting");
  try {
    performCollect(varFile, collectFolder);
  } catch (e: any) {
    warnings.push("VAR " + varName + " collect: " + e.message);
  }

  app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
  return warnings;
}

// Single-call wrapper over begin/step/end, preserving the original
// all-at-once API. Still used by anything that doesn't need progress or
// cancellation.
export function runVarIterationBatch(cfg: RunVarConfig): RunResult {
  const ctx = varRunBegin();
  const warnings: string[] = [];

  try {
    for (let iter = 0; iter < cfg.count; iter++) {
      const stepWarnings = varRunStep(ctx, cfg, iter);
      for (let w = 0; w < stepWarnings.length; w++) warnings.push(stepWarnings[w]);
    }
  } finally {
    // Runs even if an iteration threw — a deliberate improvement over the
    // original, which skips this cleanup entirely on its error path.
    varRunEnd(ctx);
  }

  return { warnings: warnings };
}
