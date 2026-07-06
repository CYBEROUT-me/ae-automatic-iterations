// lib/project.ts — copy & rename project, rename comps

import { incrementProjectId } from "./naming";

export function copyProject(srcFile: File): { file: File; oldId: string; newId: string } {
  const baseName = srcFile.name.replace(/\.[^.]+$/, "");
  const ext = (srcFile.name.match(/\.[^.]+$/) || [".aep"])[0];
  const parts = baseName.split("_");
  const oldId = parts[1];
  const newName = incrementProjectId(baseName);
  const newFile = new File(srcFile.parent.fsName + "/" + newName + ext);
  if (newFile.exists) newFile.remove();
  const ok = srcFile.copy(newFile.fsName);
  if (!ok) throw new Error("File copy failed: " + newFile.name);
  return { file: newFile, oldId, newId: newName.split("_")[1] };
}

export function renameComps(oldId: string, newId: string): void {
  const toRename: { item: CompItem; name: string }[] = [];
  for (let i = 1; i <= app.project.numItems; i++) {
    const item = app.project.item(i);
    if (!(item instanceof CompItem)) continue;
    const p = item.name.split("_");
    if (p.length >= 2 && p[1] === oldId) {
      p[1] = newId;
      toRename.push({ item, name: p.join("_") });
    }
  }
  for (const r of toRename) r.item.name = r.name;
}
