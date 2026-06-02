// lib/render.jsx — PNG frame export and render queue video render
// ITR functions use ITR_SUFFIXES ("ITR_9x16" etc.).
// VAR functions use ASPECT_SUFFIXES ("9x16" etc.) and always go via the render
// queue because saveFrameToPng silently fails on comps with replaceSource footage.

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

// ── VAR render helpers ────────────────────────────────────────────────────────

// Render first frame of each VAR comp to PNG via the render queue.
// comps: object keyed by ASPECT_SUFFIXES ("9x16", "1x1", "16x9") → CompItem
// Outputs to /tmp first, then copies to outFolder (AE renderer can't write to
// freshly-created subdirs of ~/Documents/Adobe).
// log: optional array — step-by-step messages are pushed to it.
function renderVarPNGs(comps, outFolder, log) {
    if (!log) log = [];
    var rq  = app.project.renderQueue;
    // Use fsName to resolve the /tmp symlink on macOS (/tmp → /private/tmp)
    var tmp = new Folder("/tmp");
    var tmpPath = tmp.fsName;  // "/private/tmp" on macOS
    log.push("[PNG] tmp path: " + tmpPath);
    var added = [];
    var errors = [];

    for (var s = 0; s < ASPECT_SUFFIXES.length; s++) {
        var comp = comps[ASPECT_SUFFIXES[s]];
        if (!comp) {
            var noCompMsg = "No VAR comp for " + ASPECT_SUFFIXES[s];
            errors.push(noCompMsg);
            log.push("[PNG] ERROR: " + noCompMsg);
            continue;
        }
        log.push("[PNG] Found: " + comp.name + " (" + comp.width + "x" + comp.height + ")");
        var prevRes = comp.resolutionFactor;
        if (prevRes[0] !== 1 || prevRes[1] !== 1) comp.resolutionFactor = [1, 1];
        var rqItem = rq.items.add(comp);
        rqItem.timeSpanStart = 0;
        rqItem.timeSpanDuration = comp.frameDuration;
        var om = rqItem.outputModule(1);
        var pngSet = false;
        var pngTmpls = ["PNG Sequence", "PNG", "PNG Sequence 16 bits per channel"];
        for (var ti = 0; ti < pngTmpls.length; ti++) {
            try { om.applyTemplate(pngTmpls[ti]); pngSet = true; log.push("[PNG] Template: " + pngTmpls[ti]); break; } catch (e) {}
        }
        if (!pngSet) {
            rqItem.remove();
            comp.resolutionFactor = prevRes;
            var noTmplMsg = comp.name + ": no PNG template found in AE";
            errors.push(noTmplMsg);
            log.push("[PNG] ERROR: " + noTmplMsg);
            continue;
        }
        var tmpBase = tmpPath + "/aeiter_var" + s;
        om.file = new File(tmpBase + ".png");
        log.push("[PNG] Queued: " + comp.name + " → " + tmpBase + ".png");
        added.push({ item: rqItem, comp: comp, prevRes: prevRes, s: s, tmpBase: tmpBase });
    }

    if (added.length > 0) {
        log.push("[PNG] Rendering " + added.length + " comp(s) via render queue...");
        try { rq.render(); log.push("[PNG] Render queue finished."); }
        catch (re) { throw new Error("VAR render queue: " + re.message); }
    }

    for (var ai = 0; ai < added.length; ai++) {
        var d = added[ai];
        d.comp.resolutionFactor = d.prevRes;
        // Log item status before removing
        try {
            var itemStatus = d.item.status;
            log.push("[PNG] Item status after render: " + itemStatus + " (DONE=" + RQItemStatus.DONE + ")");
        } catch (se) {}
        try { d.item.remove(); } catch (e) {}
        // AE PNG sequence may add frame-number suffix (e.g. aeiter_var0_00000.png)
        var created = tmp.getFiles("aeiter_var" + d.s + "*.png");
        log.push("[PNG] /tmp search 'aeiter_var" + d.s + "*.png': " + (created ? created.length : 0) + " file(s) found");
        if (created && created.length) {
            for (var fi = 0; fi < created.length; fi++) log.push("[PNG]   " + created[fi].fsName);
        }
        var src = (created && created.length) ? created[0] : new File(d.tmpBase + ".png");
        if (src && src.exists) {
            var dest = new File(outFolder.fsName + "/" + d.comp.name + ".png");
            if (dest.exists) dest.remove();
            src.copy(dest.fsName);
            if (src.exists) src.remove();
            if (!dest.exists) {
                errors.push(d.comp.name + ": copy from /tmp failed");
                log.push("[PNG] ERROR: copy from /tmp failed → " + d.comp.name);
            } else {
                log.push("[PNG] OK: " + d.comp.name + ".png saved");
            }
        } else {
            errors.push(d.comp.name + ": no render queue output in /tmp");
            log.push("[PNG] ERROR: no output found at " + d.tmpBase + " or via glob");
        }
    }

    if (errors.length) throw new Error(errors.join(" | "));
}

// log: optional array — step-by-step messages are pushed to it.
function renderVarVideos(comps, outFolder, log) {
    if (!log) log = [];
    var rq = app.project.renderQueue;
    var added = [];
    for (var s = 0; s < ASPECT_SUFFIXES.length; s++) {
        var comp = comps[ASPECT_SUFFIXES[s]];
        if (!comp) { log.push("[VID] No comp for " + ASPECT_SUFFIXES[s]); continue; }
        log.push("[VID] Found: " + comp.name);
        var rqItem = rq.items.add(comp);
        var om = rqItem.outputModule(1);
        try {
            var existingFile = om.file;
            var ext = existingFile ? (existingFile.name.match(/\.[^.]+$/) || [".mov"])[0] : ".mov";
            om.file = new File(outFolder.fsName + "/" + comp.name + ext);
            log.push("[VID] Queued: " + comp.name + ext);
        } catch (e) {
            rqItem.remove();
            throw new Error("Cannot set output file for " + comp.name + ": " + e.message);
        }
        added.push(rqItem);
    }
    if (!added.length) throw new Error("No VAR comps in render queue");
    log.push("[VID] Rendering " + added.length + " comp(s) via render queue...");
    rq.render();
    log.push("[VID] Render queue finished.");
}
