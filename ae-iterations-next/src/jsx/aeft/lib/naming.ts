export function incrementProjectId(nameWithoutExt: string): string {
  const parts = nameWithoutExt.split("_");
  parts[1] = String(parseInt(parts[1], 10) + 1);
  return parts.join("_");
}

export const VAR_ASPECT_SUFFIXES = ["9x16", "1x1", "16x9", "4x5"];

export function stripAspectSuffix(name: string): string {
  for (let s = 0; s < VAR_ASPECT_SUFFIXES.length; s++) {
    const suffix = "_" + VAR_ASPECT_SUFFIXES[s];
    if (name.slice(-suffix.length) === suffix) {
      return name.slice(0, -suffix.length);
    }
  }
  return name;
}
