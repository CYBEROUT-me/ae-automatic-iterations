// Ported from extension/jsx/lib/render.jsx — PNG frame export and render
// queue video render for ITR comps (lines 6-22, 24-52). VAR-mode render
// helpers (renderVarPNGs/renderVarVideos) are out of scope for this plan.
//
// suffixes is parameterized so both ITR mode (ITR_SUFFIXES) and VAR mode
// (VAR_ASPECT_SUFFIXES) can reuse these functions unchanged.

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

      // saveFrameToPng can report success (no exception) well before the
      // file actually lands on disk -- confirmed live: a run that reported
      // this exact "no PNG existed after 3 attempts (500ms each)" error for
      // 3 comps turned out to have 2 of those 3 PNGs appear on disk once
      // checked again later, meaning the earlier 1.5s window simply wasn't
      // long enough. Call it once, then poll for the artifact over a much
      // longer window -- a FRESH File object each poll, since re-checking
      // .exists on the SAME File instance in this ExtendScript engine can
      // return stale cached state instead of the current filesystem truth.
      comp.saveFrameToPng(0, pngFile);
      let wrote = false;
      for (let attempt = 0; attempt < 10 && !wrote; attempt++) {
        const check = new File(pngFile.fsName);
        wrote = check.exists && check.length > 0;
        if (!wrote) $.sleep(750);
      }
      comp.resolutionFactor = prevRes;
      if (!wrote) {
        const missingFootage = findMissingFootageNames(comp);
        const missingNote = missingFootage.length ? " (missing footage in this comp: " + missingFootage.join(", ") + ")" : " (no missing footage detected on this comp's own layers)";
        errors.push(comp.name + ": saveFrameToPng reported no error, but no PNG existed at " + pngFile.fsName + " after ~7.5s of polling" + missingNote);
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
