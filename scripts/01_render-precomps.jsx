// 01_render-precomps.jsx
// For each of the 3 ITR precomps (ITR_9x16, ITR_1x1, ITR_16x9):
//   1. Saves frame 0 as PNG next to the .aep file.
//   2. Adds to the render queue and renders as video (uses whatever
//      Output Module template is currently set in AE preferences).
// Run via File > Scripts > Run Script File… in After Effects.

(function main() {

    var projectFile = app.project.file;
    if (!projectFile) {
        alert("Збережи проєкт перед запуском.");
        return;
    }

    var outFolder = projectFile.parent;

    // ── Find the 3 precomps ──────────────────────────────────────────────────
    var SUFFIXES = ["ITR_9x16", "ITR_1x1", "ITR_16x9"];
    var found    = {};
    var notFound = [];

    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (!(item instanceof CompItem)) continue;
        for (var s = 0; s < SUFFIXES.length; s++) {
            var suf = SUFFIXES[s];
            if (item.name.slice(-suf.length) === suf) found[suf] = item;
        }
    }

    for (var s = 0; s < SUFFIXES.length; s++) {
        if (!found[SUFFIXES[s]]) notFound.push(SUFFIXES[s]);
    }

    if (notFound.length > 0) {
        alert("Не знайдено таких комп:\n" + notFound.join("\n") +
              "\n\nКомпозиція повинна мати назву, що закінчується на ці суфікси.");
        return;
    }

    // ── 1. PNG — first frame of each comp ───────────────────────────────────
    function renderFirstFrame(comp, folder) {
        var prevRes = comp.resolutionFactor;
        var wasFull = (prevRes[0] === 1 && prevRes[1] === 1);
        if (!wasFull) comp.resolutionFactor = [1, 1];
        try {
            comp.saveFrameToPng(0, new File(folder.fsName + "/" + comp.name + ".png"));
        } catch (e) {
            alert("Помилка PNG для «" + comp.name + "»:\n" + e.message);
        }
        if (!wasFull) comp.resolutionFactor = prevRes;
    }

    app.beginUndoGroup("Render Precomps — PNG");
    for (var s = 0; s < SUFFIXES.length; s++) {
        renderFirstFrame(found[SUFFIXES[s]], outFolder);
    }
    app.endUndoGroup();

    // ── 2. Video — full render via render queue ──────────────────────────────
    // Undo group must be CLOSED before calling renderQueue.render().
    app.beginUndoGroup("Render Precomps — Queue");

    var rqItems = [];
    for (var s = 0; s < SUFFIXES.length; s++) {
        var comp   = found[SUFFIXES[s]];
        var rqItem = app.project.renderQueue.items.add(comp);
        var om     = rqItem.outputModules[1];

        // Redirect output to the project folder, keeping the extension
        // that comes from whatever Output Module template AE uses.
        try {
            var existingFile = om.file;
            var ext = existingFile
                ? (existingFile.name.match(/\.[^.]+$/) || [".mov"])[0]
                : ".mov";
            om.file = new File(outFolder.fsName + "/" + comp.name + ext);
        } catch (e) {
            // Leave AE's default path if we can't redirect
        }

        rqItems.push(rqItem);
    }

    app.endUndoGroup(); // must close before render

    app.project.renderQueue.render();

    // ── Report ───────────────────────────────────────────────────────────────
    var failed = [];
    for (var r = 0; r < rqItems.length; r++) {
        if (rqItems[r].status !== RQItemStatus.DONE) {
            failed.push(rqItems[r].comp.name);
        }
    }

    var msg = "✅ Готово!\n\n" +
              "PNG + відео збережено у:\n" + outFolder.fsName + "\n\n" +
              "Рендер: " + (failed.length === 0 ? "успішно" : "помилка — " + failed.join(", "));
    alert(msg);

})();
