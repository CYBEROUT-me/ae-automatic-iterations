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

export const ITR_SUFFIXES = ["ITR_9x16", "ITR_1x1", "ITR_16x9"];
