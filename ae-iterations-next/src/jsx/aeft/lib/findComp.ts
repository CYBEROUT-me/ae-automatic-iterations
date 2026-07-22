import type { CfgLayer } from "../../../shared/types";

export function findCompByName(name: string): CompItem | null {
  for (let i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);
    if (item instanceof CompItem && item.name === name) return item;
  }
  return null;
}

// Finds, for each suffix, the first comp whose name ends with "_" + suffix.
// Mirrors extension/jsx/lib/layer-utils.jsx's findItrComps, generalized.
export function findCompsBySuffixes(suffixes: string[]): Record<string, CompItem> {
  const found: Record<string, CompItem> = {};
  for (let i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);
    if (!(item instanceof CompItem)) continue;
    for (let s = 0; s < suffixes.length; s++) {
      const suffix = "_" + suffixes[s];
      if (item.name.slice(-suffix.length) === suffix) found[suffixes[s]] = item;
    }
  }
  return found;
}

export const ITR_SUFFIXES = ["ITR_9x16", "ITR_1x1", "ITR_16x9", "ITR_4x5"];

// Like findCompByName, but also matches a name with a trailing ".aep" — a
// real AE quirk where comp names can end up carrying the file extension
// after certain copy/rename operations. VAR mode hits this repeatedly
// (rename-time lookup, target-comp resolution, post-reload lookup, and the
// testVarRenderComps diagnostic), so it's a shared helper rather than a
// loop repeated in every one of those spots.
export function findVarComp(name: string): CompItem | null {
  for (let i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);
    if (item instanceof CompItem && (item.name === name || item.name === name + ".aep")) {
      return item;
    }
  }
  return null;
}

// Look up a layer by its stored index; if that slot holds a different layer,
// OR the index itself is now out of range (e.g. an emoji-preview insertion
// or removal shifted indices), fall back to searching by name so iteration
// still targets the right layer. Ported from extension/jsx/host.jsx's
// resolveLayer, with one deliberate fix: the original only ran the by-name
// fallback when the index lookup returned a mismatched layer, not when it
// threw outright — so a stale index (e.g. previewApply's own
// removeEmojiFromComp() call shrinking the comp mid-lookup) skipped the
// fallback entirely and reported a real, still-present layer as NOT FOUND.
// Degrades to a plain index lookup whenever there's no name mismatch.
export function resolveLayer(comp: CompItem, lc: CfgLayer): Layer | null {
  let layer: Layer | null = null;
  try {
    layer = comp.layer(lc.index);
  } catch (e) {}
  if (!layer || layer.name !== lc.name) {
    for (let i = 1; i <= comp.numLayers; i++) {
      try {
        if (comp.layer(i).name === lc.name) {
          layer = comp.layer(i);
          break;
        }
      } catch (e) {}
    }
  }
  return layer;
}
