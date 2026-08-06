// Ported from extension/jsx/lib/render.jsx — PNG frame export and render
// queue video render for ITR comps (lines 6-22, 24-52). VAR-mode render
// helpers (renderVarPNGs/renderVarVideos) are out of scope for this plan.
//
// suffixes is parameterized so both ITR mode (ITR_SUFFIXES) and VAR mode
// (VAR_ASPECT_SUFFIXES) can reuse these functions unchanged.

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
      comp.saveFrameToPng(0, new File(outFolder.fsName + "/" + comp.name + ".png"));
      comp.resolutionFactor = prevRes;
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
