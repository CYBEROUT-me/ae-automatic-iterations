// Ported from extension/jsx/lib/collect.jsx — collect project (copy footage,
// relink, save, restore). `item.mainSource`/`item.proxySource` are cast to
// `any` because `isSequence` is not present in the FootageSource ambient
// type (types-for-adobe/AfterEffects/22.0); `item.hasProxy` is likewise a
// real ExtendScript member missing from the ambient AVItem/FootageItem
// types (same class of gap as AVLayer.Effects in Tasks 7/10), so `item` is
// typed `any` in this loop to match the original's untyped duck-typing.

export function performCollect(projectFile: File, collectFolder: Folder): void {
  const footageFolder = new Folder(collectFolder.fsName + "/(Footage)");
  if (!footageFolder.exists) footageFolder.create();

  const srcToDest: Record<string, File> = {};
  const destPaths: Record<string, boolean> = {};

  function binPath(item: any): string {
    const parts: string[] = [];
    let parent = item.parentFolder;
    while (parent && parent !== app.project.rootFolder) {
      parts.unshift(parent.name.replace(/[\/\\:*?"<>|]+/g, "_"));
      parent = parent.parentFolder;
    }
    return parts.join("/");
  }

  function binFolder(item: any): Folder {
    const rel = binPath(item);
    const parts = rel ? rel.split("/") : [];
    let cur = footageFolder;
    for (let p = 0; p < parts.length; p++) {
      cur = new Folder(cur.fsName + "/" + parts[p]);
      if (!cur.exists) cur.create();
    }
    return cur;
  }

  function claimDest(srcFile: File, destDir: Folder): File {
    if (srcToDest[srcFile.fsName]) return srcToDest[srcFile.fsName];
    const base = srcFile.name.replace(/\.[^.]+$/, "");
    const ext = (srcFile.name.match(/\.[^.]+$/) || [""])[0];
    let path = destDir.fsName + "/" + srcFile.name;
    let n = 2;
    while (destPaths[path]) {
      path = destDir.fsName + "/" + base + "_" + n + ext;
      n++;
    }
    destPaths[path] = true;
    srcToDest[srcFile.fsName] = new File(path);
    return srcToDest[srcFile.fsName];
  }

  function copySingleFile(srcFile: File, destDir: Folder): File {
    const dest = claimDest(srcFile, destDir);
    if (!dest.exists) srcFile.copy(dest.fsName);
    return dest;
  }

  function copySequence(firstFile: File, destDir: Folder): File {
    const name = firstFile.name;
    const match = name.match(/^([\s\S]*?)(\d+)(\.[^.]+)$/);
    if (!match) return copySingleFile(firstFile, destDir);
    const prefix = match[1], numDigits = match[2].length, ext = match[3];
    const allFiles = firstFile.parent.getFiles(prefix + "*" + ext);
    let firstDest: File | null = null;
    for (let si = 0; si < allFiles.length; si++) {
      const ff = allFiles[si];
      if (!(ff instanceof File)) continue;
      const fm = ff.name.match(/^([\s\S]*?)(\d+)(\.[^.]+)$/);
      if (!fm || fm[1] !== prefix || fm[2].length !== numDigits || fm[3] !== ext) continue;
      const frameDest = new File(destDir.fsName + "/" + ff.name);
      if (!frameDest.exists) ff.copy(frameDest.fsName);
      if (!firstDest) firstDest = frameDest;
    }
    if (firstDest) srcToDest[firstFile.fsName] = firstDest;
    return firstDest || copySingleFile(firstFile, destDir);
  }

  const relinkMain: { item: any; origFile: File; newFile: File; isSeq: boolean }[] = [];
  const relinkProxy: { item: any; origFile: File; newFile: File; isSeq: boolean }[] = [];

  for (let ci = 1; ci <= app.project.numItems; ci++) {
    const item = app.project.item(ci);
    if (!(item instanceof FootageItem)) continue;
    const dest = binFolder(item);
    try {
      const ms = item.mainSource as any;
      if (ms && ms.file && ms.file.exists) {
        const newMF = ms.isSequence ? copySequence(ms.file, dest) : copySingleFile(ms.file, dest);
        relinkMain.push({ item, origFile: ms.file, newFile: newMF, isSeq: ms.isSequence });
      }
    } catch (e) {}
    try {
      if (item.hasProxy) {
        const ps = item.proxySource as any;
        if (ps && ps.file && ps.file.exists) {
          const newPF = ps.isSequence ? copySequence(ps.file, dest) : copySingleFile(ps.file, dest);
          relinkProxy.push({ item, origFile: ps.file, newFile: newPF, isSeq: ps.isSequence });
        }
      }
    } catch (e) {}
  }

  function applyRelinks(list: typeof relinkMain, toNew: boolean): void {
    for (const e of list) {
      const target = toNew ? e.newFile : e.origFile;
      try { e.isSeq ? e.item.replaceWithSequence(target, false) : e.item.replace(target); } catch (err) {}
    }
  }
  function applyProxyRelinks(list: typeof relinkProxy, toNew: boolean): void {
    for (const e of list) {
      const target = toNew ? e.newFile : e.origFile;
      try { e.isSeq ? e.item.setProxyWithSequence(target, false) : e.item.setProxy(target); } catch (err) {}
    }
  }

  app.project.save(projectFile);
  applyRelinks(relinkMain, true);
  applyProxyRelinks(relinkProxy, true);
  app.project.save(new File(collectFolder.fsName + "/" + projectFile.name));
  applyRelinks(relinkMain, false);
  applyProxyRelinks(relinkProxy, false);
  app.project.save(projectFile);
}
