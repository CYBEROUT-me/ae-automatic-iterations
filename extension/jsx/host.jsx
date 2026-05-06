// host.jsx — CEP entry point.  All logic lives in lib/*.jsx.

#include "lib/naming.jsx"
#include "lib/layer-utils.jsx"
#include "lib/apply-change.jsx"
#include "lib/render.jsx"
#include "lib/collect.jsx"
#include "lib/project.jsx"

// ── CEP: read selected layer ──────────────────────────────────────────────────

function getLayerInfoJSON() {
    try {
        var comp = app.project.activeItem;
        if (!(comp instanceof CompItem)) return JSON.stringify({ error: "No active composition" });
        var sel = comp.selectedLayers;
        if (sel.length === 0) return JSON.stringify({ error: "No layer selected" });

        var layer = sel[0];
        var type  = getLayerType(layer);
        var info  = { name: layer.name, index: layer.index, compName: comp.name, type: type };

        if (type === "shape") {
            info.fills = collectFills(layer.property("Contents"), "Contents");
        } else if (type === "text") {
            var td     = layer.property("Source Text").value;
            info.color = td.fillColor;
            info.font  = td.font;
        }

        return JSON.stringify(info);
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}

// ── CEP: debug — apply only, no render/collect ────────────────────────────────
// cfg: { layerIndex, compName, changeType, fillPath, value }
// Returns detailed log so the panel can show exactly what happened.

function debugApplyChangeJSON(configJSON) {
    try {
        var cfg = JSON.parse(configJSON);
        var log = [];

        var comp = null;
        for (var ci = 1; ci <= app.project.numItems; ci++) {
            var it = app.project.item(ci);
            if ((it instanceof CompItem) && it.name === cfg.compName) { comp = it; break; }
        }
        if (!comp) return JSON.stringify({ error: "Comp not found: " + cfg.compName });
        log.push("Comp: " + comp.name);

        var layer = comp.layer(cfg.layerIndex);
        if (!layer) return JSON.stringify({ error: "No layer at index " + cfg.layerIndex });
        log.push("Layer: " + layer.name + "  index=" + layer.index);

        var type = getLayerType(layer);
        log.push("Type: " + type);

        if (type === "shape") {
            var fills = collectFills(layer.property("Contents"), "Contents");
            log.push("Fills found: " + fills.length);
            for (var f = 0; f < fills.length; f++) log.push("  " + fills[f].path);
            log.push("fillPath used: " + cfg.fillPath);
        }

        app.beginUndoGroup("Debug Apply");
        var ok = applyChange(layer, { changeType: cfg.changeType, fillPath: cfg.fillPath, value: cfg.value });
        app.endUndoGroup();

        log.push("applyChange: " + (ok ? "OK" : "FAILED"));

        if (!ok) return JSON.stringify({ error: "applyChange returned false — wrong path or type mismatch", log: log });
        return JSON.stringify({ success: true, log: log });

    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}

// ── CEP: run all 5 iterations ─────────────────────────────────────────────────
// cfg: { layerIndex, compName, changeType, fillPath, values[5] }

function runIterationsJSON(configJSON) {
    try {
        var cfg = JSON.parse(configJSON);

        var projectFile = app.project.file;
        if (!projectFile) return JSON.stringify({ error: "Project not saved. Save it first." });

        var currentFile     = projectFile;
        var currentCompName = cfg.compName;
        var warnings        = [];

        for (var iter = 0; iter < 5; iter++) {

            var comp = null;
            for (var ci = 1; ci <= app.project.numItems; ci++) {
                var it = app.project.item(ci);
                if ((it instanceof CompItem) && it.name === currentCompName) { comp = it; break; }
            }
            if (!comp) return JSON.stringify({ error: "Iter " + (iter + 1) + ": comp not found: " + currentCompName });

            var layer = comp.layer(cfg.layerIndex);
            if (!layer) return JSON.stringify({ error: "Iter " + (iter + 1) + ": no layer at index " + cfg.layerIndex });

            app.beginUndoGroup("Iteration " + (iter + 1));
            var ok = applyChange(layer, { changeType: cfg.changeType, fillPath: cfg.fillPath, value: cfg.values[iter] });
            app.endUndoGroup();

            if (!ok) return JSON.stringify({ error: "Iter " + (iter + 1) + ": applyChange failed. changeType=" + cfg.changeType + "  fillPath=" + cfg.fillPath });

            app.project.save(currentFile);

            var baseName      = currentFile.name.replace(/\.[^.]+$/, "");
            var collectFolder = new Folder(currentFile.parent.fsName + "/" + baseName + " folder");
            if (!collectFolder.exists) collectFolder.create();

            var itrComps = findItrComps();
            try { renderPNGs(itrComps, collectFolder); }    catch (e) { warnings.push("Iter " + (iter + 1) + " PNG: " + e.message); }
            try { renderVideos(itrComps, collectFolder); }  catch (e) { warnings.push("Iter " + (iter + 1) + " video: " + e.message); }
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

        return JSON.stringify({ success: true, warnings: warnings });

    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}
