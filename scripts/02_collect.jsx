// 02_collect.jsx
// Collects the current project into "[projectName] folder/" next to the .aep.
// Creates a self-contained copy with all footage relinked.
// Logic adapted from Finish Him 2.1.jsx.
// Run via File > Scripts > Run Script File… in After Effects.

(function main() {

    var projectFile = app.project.file;
    if (!projectFile) {
        alert("Збережи проєкт перед запуском.");
        return;
    }

    var projectFolder = projectFile.parent;
    var projectName   = projectFile.name.replace(/\.[^.]+$/, "");
    var collectName   = projectName + " folder";

    // ── Create output folders ────────────────────────────────────────────────
    var collectFolder = new Folder(projectFolder.fsName + "/" + collectName);
    if (collectFolder.exists) {
        var overwrite = confirm(
            "Тека «" + collectName + "» вже існує.\nПерезаписати?"
        );
        if (!overwrite) return;
        deleteFolderRecursive(collectFolder);
    }
    collectFolder.create();

    var footageFolder = new Folder(collectFolder.fsName + "/(Footage)");
    footageFolder.create();

    // ── File copy utilities ──────────────────────────────────────────────────
    var srcToDest = {};
    var destPaths = {};

    function binPath(item) {
        var parts  = [];
        var parent = item.parentFolder;
        while (parent && parent !== app.project.rootFolder) {
            parts.unshift(parent.name.replace(/[\/\\:*?"<>|]+/g, "_"));
            parent = parent.parentFolder;
        }
        return parts.join("/");
    }

    function binFolder(item) {
        var rel   = binPath(item);
        var parts = rel ? rel.split("/") : [];
        var cur   = footageFolder;
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
        var path = destDir.fsName + "/" + srcFile.name;
        var n    = 2;
        while (destPaths[path]) {
            path = destDir.fsName + "/" + base + "_" + n + ext;
            n++;
        }
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
        var name  = firstFile.name;
        var match = name.match(/^([\s\S]*?)(\d+)(\.[^.]+)$/);
        if (!match) return copySingleFile(firstFile, destDir);

        var prefix    = match[1];
        var numDigits = match[2].length;
        var ext       = match[3];
        var allFiles  = firstFile.parent.getFiles(prefix + "*" + ext);
        var firstDest = null;

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

    // ── Scan all footage items ───────────────────────────────────────────────
    var relinkMain  = [];
    var relinkProxy = [];
    var missing     = 0;

    for (var ci = 1; ci <= app.project.numItems; ci++) {
        var item = app.project.item(ci);
        if (!(item instanceof FootageItem)) continue;

        var dest = binFolder(item);

        try {
            var ms = item.mainSource;
            if (ms && ms.file) {
                var mf = ms.file;
                if (mf.exists) {
                    var mSeq  = (ms.isSequence === true);
                    var newMF = mSeq ? copySequence(mf, dest) : copySingleFile(mf, dest);
                    relinkMain.push({ item: item, origFile: mf, newFile: newMF, isSeq: mSeq });
                } else {
                    missing++;
                }
            }
        } catch (e) {}

        try {
            if (item.hasProxy) {
                var ps = item.proxySource;
                if (ps && ps.file) {
                    var pf = ps.file;
                    if (pf.exists) {
                        var pSeq  = (ps.isSequence === true);
                        var newPF = pSeq ? copySequence(pf, dest) : copySingleFile(pf, dest);
                        relinkProxy.push({ item: item, origFile: pf, newFile: newPF, isSeq: pSeq });
                    }
                }
            }
        } catch (e) {}
    }

    // ── Relink → save collected .aep → restore ───────────────────────────────
    function applyRelinks(list, toNew) {
        for (var r = 0; r < list.length; r++) {
            var e      = list[r];
            var target = toNew ? e.newFile : e.origFile;
            try {
                e.isSeq ? e.item.replaceWithSequence(target, false) : e.item.replace(target);
            } catch (err) {}
        }
    }

    function applyProxyRelinks(list, toNew) {
        for (var r = 0; r < list.length; r++) {
            var e      = list[r];
            var target = toNew ? e.newFile : e.origFile;
            try {
                e.isSeq ? e.item.setProxyWithSequence(target, false) : e.item.setProxy(target);
            } catch (err) {}
        }
    }

    app.project.save(projectFile);

    applyRelinks(relinkMain, true);
    applyProxyRelinks(relinkProxy, true);

    var collectedAep = new File(collectFolder.fsName + "/" + projectFile.name);
    app.project.save(collectedAep);

    applyRelinks(relinkMain, false);
    applyProxyRelinks(relinkProxy, false);

    app.project.save(projectFile);

    // ── Done ─────────────────────────────────────────────────────────────────
    var total = relinkMain.length + relinkProxy.length;
    var msg   = "✅ Collect готово!\n\n" +
                "Тека: " + collectFolder.fsName + "\n" +
                "Зібрано файлів: " + total;
    if (missing > 0) msg += "\n\n⚠️ Відсутні файли (пропущено): " + missing;
    alert(msg);

    // ── Helpers ──────────────────────────────────────────────────────────────
    function deleteFolderRecursive(folder) {
        var items = folder.getFiles();
        for (var d = 0; d < items.length; d++) {
            if (items[d] instanceof Folder) deleteFolderRecursive(items[d]);
            else items[d].remove();
        }
        folder.remove();
    }

})();
