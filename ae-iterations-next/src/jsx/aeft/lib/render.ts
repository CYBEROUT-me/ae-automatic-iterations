// Ported from extension/jsx/lib/render.jsx — PNG frame export and render
// queue video render for ITR comps (lines 6-22, 24-52). VAR-mode render
// helpers (renderVarPNGs/renderVarVideos) are out of scope for this plan.

import { ITR_SUFFIXES } from "./findComp";

export function renderPNGs(comps: Record<string, CompItem>, outFolder: Folder): void {
  const errors: string[] = [];
  for (let s = 0; s < ITR_SUFFIXES.length; s++) {
    const suffix = ITR_SUFFIXES[s];
    const comp = comps[suffix];
    if (!comp) {
      errors.push("No comp found for suffix " + suffix);
      continue;
    }
    const prevRes = comp.resolutionFactor;
    if (prevRes[0] !== 1 || prevRes[1] !== 1) comp.resolutionFactor = [1, 1];
    try {
      comp.saveFrameToPng(0, new File(outFolder.fsName + "/" + comp.name + ".png"));
    } catch (e: any) {
      errors.push(comp.name + ": " + e.message);
    }
    comp.resolutionFactor = prevRes;
  }
  if (errors.length) throw new Error(errors.join(" | "));
}

export function renderVideos(comps: Record<string, CompItem>, outFolder: Folder): void {
  const rq = app.project.renderQueue;
  const added: RenderQueueItem[] = [];
  for (let s = 0; s < ITR_SUFFIXES.length; s++) {
    const comp = comps[ITR_SUFFIXES[s]];
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
  if (!added.length) throw new Error("No ITR comps in render queue");
  rq.render();
}
