// lib/render.jsx — PNG frame export and render queue video render

function renderPNGs(comps, outFolder) {
    app.beginUndoGroup("Render PNGs");
    for (var s = 0; s < ITR_SUFFIXES.length; s++) {
        var comp = comps[ITR_SUFFIXES[s]];
        if (!comp) continue;
        var prevRes = comp.resolutionFactor;
        if (prevRes[0] !== 1 || prevRes[1] !== 1) comp.resolutionFactor = [1, 1];
        try {
            comp.saveFrameToPng(0, new File(outFolder.fsName + "/" + comp.name + ".png"));
        } catch (e) {}
        comp.resolutionFactor = prevRes;
    }
    app.endUndoGroup();
}

function renderVideos(comps, outFolder) {
    app.beginUndoGroup("Render Videos");
    var rqItems = [];
    for (var s = 0; s < ITR_SUFFIXES.length; s++) {
        var comp = comps[ITR_SUFFIXES[s]];
        if (!comp) continue;
        var rqItem = app.project.renderQueue.items.add(comp);
        var om = rqItem.outputModules[1];
        try {
            var existingFile = om.file;
            var ext = existingFile ? (existingFile.name.match(/\.[^.]+$/) || [".mov"])[0] : ".mov";
            om.file = new File(outFolder.fsName + "/" + comp.name + ext);
        } catch (e) {}
        rqItems.push(rqItem);
    }
    app.endUndoGroup();
    app.project.renderQueue.render();
    return rqItems;
}
