(function main() {

    // ── Checks ───────────────────────────────────────────────────────────────
    var selection = app.project.selection;
    if (selection.length === 0) {
        alert("Немає виділених композицій у Project панелі.");
        return;
    }
    var projectFile = app.project.file;
    if (!projectFile) {
        alert("Збережи проєкт, щоб скрипт знав, куди зберігати файли.");
        return;
    }

    // ── Folder setup ─────────────────────────────────────────────────────────
    // Structure:
    //   For GD/                        ← shared container, never wiped
    //     AB_123_345_XZ/               ← full project name, conflict dialog here
    //       CompName.png               ← previews
    //       CompName.mov               ← renders
    //       AB_123 folder/             ← collect (first two name segments)
    //         ProjectName.aep
    //         (Footage)/               ← mirrors AE project panel bin hierarchy

    var projectFolder  = projectFile.parent;
    var projectName    = projectFile.name.replace(/\.[^.]+$/, "");
    var collectName    = projectName.split("_").slice(0, 2).join("_") + " folder";

    function askFolderConflict(name) {
        var dlg = new Window("dialog", "Тека вже існує");
        dlg.orientation = "column";
        dlg.alignChildren = "fill";
        dlg.margins = 18;
        dlg.spacing = 12;

        var lbl = dlg.add("statictext", undefined,
            "Тека «" + name + "» вже існує.\nЩо робити з файлами?",
            { multiline: true });
        lbl.alignment = "left";

        var btnGroup = dlg.add("group");
        btnGroup.orientation   = "row";
        btnGroup.alignChildren = "center";
        btnGroup.alignment     = "center";

        var btnOverwrite = btnGroup.add("button", undefined, "Перезаписати");
        var btnNew       = btnGroup.add("button", undefined, "Нова тека");
        var btnCancel    = btnGroup.add("button", undefined, "Скасувати");

        var result = "cancel";
        btnOverwrite.onClick = function () { result = "overwrite"; dlg.close(); };
        btnNew.onClick       = function () { result = "new";       dlg.close(); };
        btnCancel.onClick    = function () { result = "cancel";    dlg.close(); };

        dlg.show();
        return result;
    }

    function deleteFolderRecursive(folder) {
        var items = folder.getFiles();
        for (var d = 0; d < items.length; d++) {
            if (items[d] instanceof Folder) deleteFolderRecursive(items[d]);
            else items[d].remove();
        }
        folder.remove();
    }

    // "For GD" accumulates output for all projects — create once, never wipe.
    var forGDFolder = new Folder(projectFolder.fsName + "/For GD");
    if (!forGDFolder.exists) forGDFolder.create();

    // The full-project-name folder is the conflict point.
    var projectOutFolder = new Folder(forGDFolder.fsName + "/" + projectName);
    if (projectOutFolder.exists) {
        var choice = askFolderConflict(projectName);
        if (choice === "cancel") return;
        if (choice === "new") {
            var n = 2;
            while (projectOutFolder.exists) {
                projectOutFolder = new Folder(forGDFolder.fsName + "/" + projectName + " " + n);
                n++;
            }
        } else {
            deleteFolderRecursive(projectOutFolder); // overwrite: wipe for a clean result
        }
    }
    projectOutFolder.create();

    // Collect subfolder and footage folder live inside the project-name folder.
    var collectFolder = new Folder(projectOutFolder.fsName + "/" + collectName);
    var footageFolder = new Folder(collectFolder.fsName + "/(Footage)");
    collectFolder.create();
    footageFolder.create();

    // ── Gather selected comps ─────────────────────────────────────────────────
    var selectedComps = [];
    for (var i = 0; i < selection.length; i++) {
        if (selection[i] instanceof CompItem) selectedComps.push(selection[i]);
    }
    if (selectedComps.length === 0) {
        alert("Серед виділеного немає жодної композиції.");
        return;
    }

    // ── 1. PNG previews ───────────────────────────────────────────────────────
    app.beginUndoGroup("Finish Him — PNG Preview");

    function saveFrame(comp, destFolder) {
        var prevRes = comp.resolutionFactor;
        var wasFull = (prevRes[0] === 1 && prevRes[1] === 1);
        if (!wasFull) comp.resolutionFactor = [1, 1];
        try {
            comp.saveFrameToPng(comp.time, new File(destFolder.fsName + "/" + comp.name + ".png"));
        } catch (e) {
            alert("⚠️ Не вдалося зберегти PNG для «" + comp.name + "»:\n" + e.message);
        }
        if (!wasFull) comp.resolutionFactor = prevRes;
    }

    for (var pi = 0; pi < selectedComps.length; pi++) {
        saveFrame(selectedComps[pi], projectOutFolder);
    }

    app.endUndoGroup();

    // ── 2. Collect Files ──────────────────────────────────────────────────────
    // Done before render — project is in a clean state.
    // (Footage) structure mirrors the AE project panel bin hierarchy.

    var srcToDest = {}; // srcFsName → dest File  (deduplication)
    var destPaths = {}; // destPath  → true        (conflict detection)

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

    app.project.save(projectFile); // restore point before relinking

    applyRelinks(relinkMain, true);
    applyProxyRelinks(relinkProxy, true);

    var collectedAep = new File(collectFolder.fsName + "/" + projectFile.name);
    app.project.save(collectedAep);

    applyRelinks(relinkMain, false);
    applyProxyRelinks(relinkProxy, false);

    app.project.save(projectFile); // restore working project

    // ── 3. Render ─────────────────────────────────────────────────────────────
    // Added to queue after collect so the collected .aep has no queued items.
    // Undo group closed before render — holding it open during a synchronous
    // render blocks AE's UI event loop.
    app.beginUndoGroup("Finish Him — Render Queue");

    var addedRQItems = [];
    for (var qi = 0; qi < selectedComps.length; qi++) {
        var rqItem = app.project.renderQueue.items.add(selectedComps[qi]);
        var om = rqItem.outputModules[1];
        try {
            var outFile = om.file;
            if (outFile) om.file = new File(projectOutFolder.fsName + "/" + outFile.name);
        } catch (e) {}
        addedRQItems.push(rqItem);
    }

    app.endUndoGroup();

    app.project.renderQueue.render();

    // ── 4. Done ───────────────────────────────────────────────────────────────
    var failedNames = [];
    for (var ri = 0; ri < addedRQItems.length; ri++) {
        if (addedRQItems[ri].status !== RQItemStatus.DONE) {
            failedNames.push(addedRQItems[ri].comp.name);
        }
    }

    var totalFiles = relinkMain.length + relinkProxy.length;
    var msg = "✅ Готово!\n\n" +
        "For GD: "         + forGDFolder.fsName     + "\n" +
        "Проєкт: "         + projectOutFolder.fsName + "\n" +
        "Collect: "        + collectFolder.fsName    + "\n" +
        "Зібрано файлів: " + totalFiles              + "\n" +
        "Рендер: " + (failedNames.length === 0 ? "успішно" : "помилка");
    if (missing > 0)            msg += "\n\n⚠️ Відсутні у проєкті (пропущено): " + missing;
    if (failedNames.length > 0) msg += "\n⚠️ Не відрендерено: " + failedNames.join(", ");
    alert(msg);

})();
