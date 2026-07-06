export function incrementProjectId(nameWithoutExt: string): string {
  const parts = nameWithoutExt.split("_");
  parts[1] = String(parseInt(parts[1], 10) + 1);
  return parts.join("_");
}
