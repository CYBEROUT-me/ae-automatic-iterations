// host.jsx — CEP entry point.
// NOTE: install.sh concatenates lib/*.jsx + this file (minus #include lines)
//       into the deployed host.jsx, so #include is only used for direct dev loading.

#include "lib/naming.jsx"
#include "lib/layer-utils.jsx"
#include "lib/apply-change.jsx"
#include "lib/render.jsx"
#include "lib/collect.jsx"
#include "lib/project.jsx"

// ── CEP: read specific layers by timeline index (no selection required) ───────
// cfg: { compName, layers: [{index, layerType}] }

function readLayerValuesJSON(configJSON) {
    try {
        var cfg  = JSON.parse(configJSON);
        var comp = null;
        for (var ci = 1; ci <= app.project.numItems; ci++) {
            var it = app.project.item(ci);
            if ((it instanceof CompItem) && it.name === cfg.compName) { comp = it; break; }
        }
        if (!comp) return JSON.stringify({ error: "Comp not found: " + cfg.compName });

        var results = [];
        for (var li = 0; li < cfg.layers.length; li++) {
            var lc    = cfg.layers[li];
            var layer = comp.layer(lc.index);
            if (!layer) { results.push(null); continue; }

            var info = { type: lc.layerType };
            if (lc.layerType === "shape") {
                var fills = collectFills(layer.property("Contents"), "Contents");
                info.fills = fills;
                info.color = fills.length ? fills[0].color : null;
            } else if (lc.layerType === "text") {
                var td     = layer.property("Source Text").value;
                info.color = td.fillColor;
                info.font  = td.font;
            }
            results.push(info);
        }

        return JSON.stringify({ success: true, layers: results });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}

// ── Per-layer apply helpers ───────────────────────────────────────────────────

// val = { color: [r,g,b] | null, font: "str" | null }
// Returns array of log strings.
function applyLayerValue(layer, lc, val) {
    var log = [];
    if (lc.layerType === "shape") {
        var ok = applyChange(layer, { changeType: "shapeColor", fillPath: lc.fillPath, value: val.color });
        log.push("→ shapeColor: " + (ok ? "OK" : "FAILED"));
    } else if (lc.layerType === "text") {
        if (val.color) {
            var okC = applyChange(layer, { changeType: "textColor", value: val.color });
            log.push("→ textColor: " + (okC ? "OK" : "FAILED"));
        }
        if (val.font) {
            var okF = applyChange(layer, { changeType: "textFont", value: val.font });
            log.push("→ textFont: " + (okF ? "OK" : "FAILED"));
        }
        if (!val.color && !val.font) log.push("→ nothing to apply (no color, no font)");
    } else {
        log.push("→ skipped (unsupported type: " + lc.layerType + ")");
    }
    return log;
}

// Same as applyLayerValue but returns an error string on failure, or null on success.
function applyLayerValueStrict(layer, lc, val, iterNum) {
    if (lc.layerType === "shape") {
        var ok = applyChange(layer, { changeType: "shapeColor", fillPath: lc.fillPath, value: val.color });
        if (!ok) return "Iter " + iterNum + ": shapeColor failed — layer " + lc.index + "  fillPath=" + lc.fillPath;
    } else if (lc.layerType === "text") {
        if (val.color) {
            var okC = applyChange(layer, { changeType: "textColor", value: val.color });
            if (!okC) return "Iter " + iterNum + ": textColor failed — layer " + lc.index;
        }
        if (val.font) {
            var okF = applyChange(layer, { changeType: "textFont", value: val.font });
            if (!okF) return "Iter " + iterNum + ": textFont failed — layer " + lc.index;
        }
    }
    return null;
}

// ── CEP: read ALL selected layers ─────────────────────────────────────────────

function getLayerInfoJSON() {
    try {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) return JSON.stringify({ error: "No active composition" });
        var sel = comp.selectedLayers;
        if (sel.length === 0) return JSON.stringify({ error: "No layer selected" });

        var layers = [];
        for (var i = 0; i < sel.length; i++) {
            var layer = sel[i];
            var type  = getLayerType(layer);
            var info  = { name: layer.name, index: layer.index, type: type };
            if (type === "shape") {
                info.fills = collectFills(layer.property("Contents"), "Contents");
            } else if (type === "text") {
                var td     = layer.property("Source Text").value;
                info.color = td.fillColor;
                info.font  = td.font;
            }
            layers.push(info);
        }

        return JSON.stringify({ compName: comp.name, layers: layers });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}

// ── CEP: debug — apply only, no render/collect ────────────────────────────────
// cfg: { compName, layers:[{index, fillPath, layerType}], value:[{color,font},...] }

function debugApplyChangeJSON(configJSON) {
    try {
        var cfg = JSON.parse(configJSON);
        var log = [];

        // Show which ITR comps are in the project
        var itrComps  = findItrComps();
        var itrFound  = [];
        for (var s = 0; s < ITR_SUFFIXES.length; s++) {
            if (itrComps[ITR_SUFFIXES[s]]) itrFound.push(itrComps[ITR_SUFFIXES[s]].name);
        }
        log.push("ITR comps: " + (itrFound.length ? itrFound.join(", ") : "NONE FOUND — check comp names"));

        var comp = null;
        for (var ci = 1; ci <= app.project.numItems; ci++) {
            var it = app.project.item(ci);
            if ((it instanceof CompItem) && it.name === cfg.compName) { comp = it; break; }
        }
        if (!comp) return JSON.stringify({ error: "Comp not found: " + cfg.compName });
        log.push("Target comp: " + comp.name);

        app.beginSuppressDialogs();
        app.beginUndoGroup("Debug Apply");
        for (var li = 0; li < cfg.layers.length; li++) {
            var lc    = cfg.layers[li];
            var layer = comp.layer(lc.index);
            if (!layer) { log.push("Layer " + lc.index + ": NOT FOUND"); continue; }
            log.push("Layer " + lc.index + ": " + layer.name + "  [" + lc.layerType + "]  fillPath=" + lc.fillPath);
            var val = cfg.value[li]; // { color, font }
            var results = applyLayerValue(layer, lc, val);
            for (var ri = 0; ri < results.length; ri++) log.push("  " + results[ri]);
        }
        app.endUndoGroup();
        app.endSuppressDialogs(false);

        return JSON.stringify({ success: true, log: log });
    } catch (e) {
        try { app.endSuppressDialogs(false); } catch (e2) {}
        return JSON.stringify({ error: e.message });
    }
}

// ── CEP: run all 5 iterations ─────────────────────────────────────────────────
// cfg: { compName, layers:[{index, fillPath, layerType}], values:[[{color,font},...] × 5] }

function runIterationsJSON(configJSON) {
    try {
        var cfg = JSON.parse(configJSON);

        var projectFile = app.project.file;
        if (!projectFile) return JSON.stringify({ error: "Project not saved. Save it first." });

        var currentFile     = projectFile;
        var currentCompName = cfg.compName;
        var warnings        = [];

        app.beginSuppressDialogs();

        for (var iter = 0; iter < 5; iter++) {

            var comp = null;
            for (var ci = 1; ci <= app.project.numItems; ci++) {
                var it = app.project.item(ci);
                if ((it instanceof CompItem) && it.name === currentCompName) { comp = it; break; }
            }
            if (!comp) {
                app.endSuppressDialogs(false);
                return JSON.stringify({ error: "Iter " + (iter + 1) + ": comp not found: " + currentCompName });
            }

            // Apply to every selected layer
            app.beginUndoGroup("Iteration " + (iter + 1));
            for (var li = 0; li < cfg.layers.length; li++) {
                var lc    = cfg.layers[li];
                var layer = comp.layer(lc.index);
                if (!layer) { warnings.push("Iter " + (iter + 1) + ": layer " + lc.index + " not found"); continue; }
                var val = cfg.values[iter][li]; // { color, font }
                var err = applyLayerValueStrict(layer, lc, val, iter + 1);
                if (err) {
                    app.endUndoGroup();
                    app.endSuppressDialogs(false);
                    return JSON.stringify({ error: err });
                }
            }
            app.endUndoGroup();

            app.project.save(currentFile);

            var baseName        = currentFile.name.replace(/\.[^.]+$/, "");
            var gdFolder        = new Folder(currentFile.parent.fsName + "/GD");
            if (!gdFolder.exists) gdFolder.create();
            var deliveryFolder  = new Folder(gdFolder.fsName + "/" + baseName);
            if (!deliveryFolder.exists) deliveryFolder.create();
            var collectFolder   = new Folder(deliveryFolder.fsName + "/" + baseName + " folder");
            if (!collectFolder.exists) collectFolder.create();

            var itrComps = findItrComps();
            try { renderPNGs(itrComps, deliveryFolder); }   catch (e) { warnings.push("Iter " + (iter + 1) + " PNG: " + e.message); }
            try { renderVideos(itrComps, deliveryFolder); } catch (e) { warnings.push("Iter " + (iter + 1) + " video: " + e.message); }
            try { performCollect(currentFile, collectFolder); } catch (e) { warnings.push("Iter " + (iter + 1) + " collect: " + e.message); }

            if (iter < 4) {
                var copied = copyProject(currentFile);
                app.open(copied.file);
                renameComps(copied.oldId, copied.newId);

                var cp = currentCompName.split("_");
                cp[1] = copied.newId;
                currentCompName = cp.join("_");
                currentFile = copied.file;
            }
        }

        app.endSuppressDialogs(false);
        return JSON.stringify({ success: true, warnings: warnings });

    } catch (e) {
        try { app.endSuppressDialogs(false); } catch (e2) {}
        return JSON.stringify({ error: e.message });
    }
}
