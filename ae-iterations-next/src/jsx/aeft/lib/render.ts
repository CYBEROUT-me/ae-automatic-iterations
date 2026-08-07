// Ported from extension/jsx/lib/render.jsx — PNG frame export and render
// queue video render for ITR comps (lines 6-22, 24-52). VAR-mode render
// helpers (renderVarPNGs/renderVarVideos) are out of scope for this plan.
//
// suffixes is parameterized so both ITR mode (ITR_SUFFIXES) and VAR mode
// (VAR_ASPECT_SUFFIXES) can reuse these functions unchanged.

import { saveFrameVerified } from "./saveFrame";

// Top-level-only check (does not recurse into nested precomps) for whether
// any of a comp's own layers point at footage AE currently considers
// missing -- exactly the kind of thing that could make a comp fail to
// render a frame without saveFrameToPng itself ever throwing.
function findMissingFootageNames(comp: CompItem): string[] {
  const missing: string[] = [];
  for (let i = 1; i <= comp.numLayers; i++) {
    try {
      const source = (comp.layer(i) as any).source;
      if (source && source instanceof FootageItem && source.footageMissing) {
        missing.push(source.name);
      }
    } catch (e) {}
  }
  return missing;
}

export function renderPNGs(comps: Record<string, CompItem>, outFolder: Folder, suffixes: string[]): void {
  const errors: string[] = [];
  for (let s = 0; s < suffixes.length; s++) {
    const suffix = suffixes[s];
    const comp = comps[suffix];
    if (!comp) {
      errors.push("No comp found for suffix " + suffix);
      continue;
    }
    // Whole per-comp body in one try/catch, including resolutionFactor --
    // an earlier version read/restored resolutionFactor outside the try, so
    // any exception there (or from a comp reference invalidated mid-loop)
    // propagated straight out of the function, silently discarding every
    // error already collected for earlier comps AND skipping every comp
    // still to come, with no trace of why. That's indistinguishable from
    // "rendered only the first comp" -- exactly the repeatedly-reported
    // symptom -- so this now can never abort the loop for one bad comp.
    try {
      const prevRes = comp.resolutionFactor;
      if (prevRes[0] !== 1 || prevRes[1] !== 1) comp.resolutionFactor = [1, 1];
      const pngFile = new File(outFolder.fsName + "/" + comp.name + ".png");

      // Save-and-verify lives in lib/saveFrame.ts -- saveFrameToPng
      // regularly returns before the file exists, so the artifact has to
      // be waited for rather than assumed. See that file's header for the
      // evidence behind it.
      const wrote = saveFrameVerified(comp, pngFile);
      comp.resolutionFactor = prevRes;
      if (!wrote) {
        const missingFootage = findMissingFootageNames(comp);
        const missingNote = missingFootage.length ? " (missing footage in this comp: " + missingFootage.join(", ") + ")" : " (no missing footage detected on this comp's own layers)";
        errors.push(comp.name + ": saveFrameToPng reported no error, but no PNG existed at " + pngFile.fsName + " after ~7.5s of waiting" + missingNote);
      }
    } catch (e: any) {
      errors.push(comp.name + ": " + e.message);
    }
  }
  if (errors.length) throw new Error(errors.join(" | "));
}

export function renderVideos(comps: Record<string, CompItem>, outFolder: Folder, suffixes: string[]): void {
  const rq = app.project.renderQueue;
  const added: RenderQueueItem[] = [];
  for (let s = 0; s < suffixes.length; s++) {
    const comp = comps[suffixes[s]];
    if (!comp) continue;
    const rqItem = rq.items.add(comp);
    const om = rqItem.outputModules[1];
    try {
      const existingFile = om.file;
      const ext = existingFile ? (existingFile.name.match(/\.[^.]+$/) || [".mov"])[0] : ".mov";
      om.file = new File(outFolder.fsName + "/" + comp.name + ext);
    } catch (e: any) {
      rqItem.remove();
      throw new Error("Cannot set output file for " + comp.name + ": " + e.message);
    }
    added.push(rqItem);
  }
  if (!added.length) throw new Error("No comps in render queue");
  rq.render();
}
