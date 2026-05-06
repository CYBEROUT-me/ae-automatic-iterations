// lib/collect.jsx — Collect project (copy footage, relink, save, restore)

function performCollect(projectFile, collectFolder) {
    var footageFolder = new Folder(collectFolder.fsName + "/(Footage)");
    if (!footageFolder.exists) footageFolder.create();

    var srcToDest = {}, destPaths = {};

    function binPath(item) {
        var parts = [], parent = item.parentFolder;
        while (parent && parent !== app.project.rootFolder) {
            parts.unshift(parent.name.replace(/[\/\\:*?"<>|]+/g, "_"));
            parent = parent.parentFolder;
        }
        return parts.join("/");
    }

    function binFolder(item) {
        var rel = binPath(item), parts = rel ? rel.split("/") : [], cur = footageFolder;
        for (var p = 0; p < parts.length; p++) {
            cur = new Folder(cur.fsName + "/" + parts[p]);
            if (!cur.exists) cur.create();
        }
        return cur;
    }

    function claimDest(srcFile, destDir) {
        if (srcToDest[srcFile.fsName]) return srcToDest[srcFile.fsName];
        var base = srcFile.name.replace(/\.[^.]+$/, "");
        var ext  = (srcFile.name.match(/\.[^.]+$/) || [""])[0];
        var path = destDir.fsName + "/" + srcFile.name, n = 2;
        while (destPaths[path]) { path = destDir.fsName + "/" + base + "_" + n + ext; n++; }
        destPaths[path] = true;
        srcToDest[srcFile.fsName] = new File(path);
        return srcToDest[srcFile.fsName];
    }

    function copySingleFile(srcFile, destDir) {
        var dest = claimDest(srcFile, destDir);
        if (!dest.exists) srcFile.copy(dest.fsName);
        return dest;
    }

    function copySequence(firstFile, destDir) {
        var name = firstFile.name, match = name.match(/^([\s\S]*?)(\d+)(\.[^.]+)$/);
        if (!match) return copySingleFile(firstFile, destDir);
        var prefix = match[1], numDigits = match[2].length, ext = match[3];
        var allFiles = firstFile.parent.getFiles(prefix + "*" + ext), firstDest = null;
        for (var si = 0; si < allFiles.length; si++) {
            var ff = allFiles[si];
            if (!(ff instanceof File)) continue;
            var fm = ff.name.match(/^([\s\S]*?)(\d+)(\.[^.]+)$/);
            if (!fm || fm[1] !== prefix || fm[2].length !== numDigits || fm[3] !== ext) continue;
            var frameDest = new File(destDir.fsName + "/" + ff.name);
            if (!frameDest.exists) ff.copy(frameDest.fsName);
            if (!firstDest) firstDest = frameDest;
        }
        if (firstDest) srcToDest[firstFile.fsName] = firstDest;
        return firstDest || copySingleFile(firstFile, destDir);
    }

    var relinkMain = [], relinkProxy = [];
    for (var ci = 1; ci <= app.project.numItems; ci++) {
        var item = app.project.item(ci);
        if (!(item instanceof FootageItem)) continue;
        var dest = binFolder(item);
        try {
            var ms = item.mainSource;
            if (ms && ms.file && ms.file.exists) {
                var newMF = ms.isSequence ? copySequence(ms.file, dest) : copySingleFile(ms.file, dest);
                relinkMain.push({ item: item, origFile: ms.file, newFile: newMF, isSeq: ms.isSequence });
            }
        } catch (e) {}
        try {
            if (item.hasProxy) {
                var ps = item.proxySource;
                if (ps && ps.file && ps.file.exists) {
                    var newPF = ps.isSequence ? copySequence(ps.file, dest) : copySingleFile(ps.file, dest);
                    relinkProxy.push({ item: item, origFile: ps.file, newFile: newPF, isSeq: ps.isSequence });
                }
            }
        } catch (e) {}
    }

    function applyRelinks(list, toNew) {
        for (var r = 0; r < list.length; r++) {
            var e = list[r], target = toNew ? e.newFile : e.origFile;
            try { e.isSeq ? e.item.replaceWithSequence(target, false) : e.item.replace(target); } catch (err) {}
        }
    }
    function applyProxyRelinks(list, toNew) {
        for (var r = 0; r < list.length; r++) {
            var e = list[r], target = toNew ? e.newFile : e.origFile;
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
