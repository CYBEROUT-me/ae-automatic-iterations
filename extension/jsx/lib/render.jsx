// lib/render.jsx — PNG frame export and render queue video render

function renderPNGs(comps, outFolder) {
    var errors = [];
    for (var s = 0; s < ITR_SUFFIXES.length; s++) {
        var suffix = ITR_SUFFIXES[s];
        var comp = comps[suffix];
        if (!comp) { errors.push("No comp found for suffix " + suffix); continue; }
        var prevRes = comp.resolutionFactor;
        if (prevRes[0] !== 1 || prevRes[1] !== 1) comp.resolutionFactor = [1, 1];
        try {
            comp.saveFrameToPng(0, new File(outFolder.fsName + "/" + comp.name + ".png"));
        } catch (e) {
            errors.push(comp.name + ": " + e.message);
        }
        comp.resolutionFactor = prevRes;
    }
    if (errors.length) throw new Error(errors.join(" | "));
}

function renderVideos(comps, outFolder) {
    var rq = app.project.renderQueue;
    // Remove finished / errored items so the queue stays clean across runs
    for (var i = rq.numItems; i >= 1; i--) {
        var st = rq.item(i).status;
        if (st === RQItemStatus.DONE || st === RQItemStatus.ERR_STOPPED ||
            st === RQItemStatus.RENDERING) continue; // skip active renders
        // Remove only our newly-unqueued items below; leave user items alone.
    }

    var added = [];
    for (var s = 0; s < ITR_SUFFIXES.length; s++) {
        var comp = comps[ITR_SUFFIXES[s]];
        if (!comp) continue;
        var rqItem = rq.items.add(comp);
        var om = rqItem.outputModules[1];
        try {
            var existingFile = om.file;
            var ext = existingFile ? (existingFile.name.match(/\.[^.]+$/) || [".mov"])[0] : ".mov";
            om.file = new File(outFolder.fsName + "/" + comp.name + ext);
        } catch (e) {
            rqItem.remove();
            throw new Error("Cannot set output file for " + comp.name + ": " + e.message);
        }
        added.push(rqItem);
    }
    if (!added.length) throw new Error("No ITR comps in render queue");
    rq.render();
}
