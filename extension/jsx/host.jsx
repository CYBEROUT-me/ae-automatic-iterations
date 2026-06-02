// host.jsx — CEP entry point.
// NOTE: install.sh concatenates lib/*.jsx + this file (minus #include lines)
//       into the deployed host.jsx, so #include is only used for direct dev loading.

#include "lib/naming.jsx"
#include "lib/layer-utils.jsx"
#include "lib/apply-change.jsx"
#include "lib/apply-video.jsx"
#include "lib/apply-media.jsx"
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
                info.text  = td.text;
            } else if (lc.layerType === "stroke") {
                try {
                    var sp = lc.fillPath.split("/"), sc = layer;
                    for (var pi = 0; pi < sp.length; pi++) sc = sc.property(sp[pi]);
                    info.color = sc.property("Color").value;
                } catch (e) { info.color = null; }
            } else if (lc.layerType === "video") {
                info.videoState = readVideoLayerState(layer);
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
    } else if (lc.layerType === "stroke") {
        var ok = applyChange(layer, { changeType: "strokeColor", fillPath: lc.fillPath, value: val.color });
        log.push("→ strokeColor: " + (ok ? "OK" : "FAILED"));
    } else if (lc.layerType === "video") {
        var ok = applyVideoLayer(layer, val);
        log.push("→ videoEffects: " + (ok ? "OK" : "FAILED"));
    } else if (lc.layerType === "text") {
        if (val.content) {
            var okT = applyChange(layer, { changeType: "textContent", value: val.content });
            log.push("→ textContent: " + (okT ? "OK" : "FAILED"));
        }
        if (val.color) {
            var okC = applyChange(layer, { changeType: "textColor", value: val.color });
            log.push("→ textColor: " + (okC ? "OK" : "FAILED"));
        }
        if (val.font) {
            var okF = applyChange(layer, { changeType: "textFont", value: val.font });
            log.push("→ textFont: " + (okF ? "OK" : "FAILED"));
        }
        if (!val.content && !val.color && !val.font) log.push("→ nothing to apply (no content, no color, no font)");
    } else if (lc.layerType === "media") {
        if (val.mediaPath) {
            var ok = applyMediaLayer(layer, val.mediaPath);
            log.push("→ media: " + (ok ? "OK" : "FAILED"));
        } else {
            log.push("→ media: no path");
        }
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
    } else if (lc.layerType === "stroke") {
        var ok = applyChange(layer, { changeType: "strokeColor", fillPath: lc.fillPath, value: val.color });
        if (!ok) return "Iter " + iterNum + ": strokeColor failed — layer " + lc.index + "  path=" + lc.fillPath;
    } else if (lc.layerType === "video") {
        var ok = applyVideoLayer(layer, val);
        if (!ok) return "Iter " + iterNum + ": video effects failed — layer " + lc.index;
    } else if (lc.layerType === "text") {
        if (val.content) {
            var okT = applyChange(layer, { changeType: "textContent", value: val.content });
            if (!okT) return "Iter " + iterNum + ": textContent failed — layer " + lc.index;
        }
        if (val.color) {
            var okC = applyChange(layer, { changeType: "textColor", value: val.color });
            if (!okC) return "Iter " + iterNum + ": textColor failed — layer " + lc.index;
        }
        if (val.font) {
            var okF = applyChange(layer, { changeType: "textFont", value: val.font });
            if (!okF) return "Iter " + iterNum + ": textFont failed — layer " + lc.index;
        }
    } else if (lc.layerType === "media") {
        if (val.mediaPath) {
            var ok = applyMediaLayer(layer, val.mediaPath);
            if (!ok) return iterNum + ": media replace failed — layer " + lc.index;
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
                info.fills   = collectFills(layer.property("Contents"), "Contents");
                info.strokes = collectStrokes(layer.property("Contents"), "Contents");
            } else if (type === "text") {
                var td     = layer.property("Source Text").value;
                info.color = td.fillColor;
                info.font  = td.font;
                info.text  = td.text;
            } else if (type === "video") {
                info.videoState = readVideoLayerState(layer);
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

            // Apply layer changes (skipped when running emoji-only with no layer selected)
            if (currentCompName && cfg.layers && cfg.layers.length > 0) {
                var comp = null;
                for (var ci = 1; ci <= app.project.numItems; ci++) {
                    var it = app.project.item(ci);
                    if ((it instanceof CompItem) && it.name === currentCompName) { comp = it; break; }
                }
                if (!comp) {
                    app.endSuppressDialogs(false);
                    return JSON.stringify({ error: "Iter " + (iter + 1) + ": comp not found: " + currentCompName });
                }

                app.beginUndoGroup("Iteration " + (iter + 1));
                for (var li = 0; li < cfg.layers.length; li++) {
                    var lc    = cfg.layers[li];
                    var layer = comp.layer(lc.index);
                    if (!layer) { warnings.push("Iter " + (iter + 1) + ": layer " + lc.index + " not found"); continue; }
                    var val = cfg.values[iter][li];
                    var err = applyLayerValueStrict(layer, lc, val, iter + 1);
                    if (err) {
                        app.endUndoGroup();
                        app.endSuppressDialogs(false);
                        return JSON.stringify({ error: err });
                    }
                }
                app.endUndoGroup();
            }

            // Add emoji to all 3 ITR aspect-ratio comps.
            // Import the footage ONCE and share the single FootageItem across all comps
            // so cleanProject's consolidateFootage() doesn't break layer references.
            var emojiFootageItem = null;
            var emojiFootageName = null;  // saved before close so reference stays valid
            if (cfg.emoji && cfg.emoji.enabled) {
                var emojiPath = cfg.emoji.perIteration
                    ? cfg.emoji.perIteration[iter]
                    : cfg.emoji.path;
                if (emojiPath) {
                    var emojiEx = cfg.emoji.x  !== undefined ? cfg.emoji.x  : 540;
                    var emojiEy = cfg.emoji.y  !== undefined ? cfg.emoji.y  : 1347;
                    var emojiEi = cfg.emoji.layerIndex || 1;
                    // Import once (suppress must be OFF for importFile to work)
                    app.endSuppressDialogs(false);
                    try {
                        var emojiFile = new File(emojiPath);
                        if (emojiFile.exists) emojiFootageItem = app.project.importFile(new ImportOptions(emojiFile));
                        else warnings.push("Iter " + (iter + 1) + " emoji: file not found");
                    } catch (eie) { warnings.push("Iter " + (iter + 1) + " emoji import: " + eie.message); }
                    app.beginSuppressDialogs();

                    if (emojiFootageItem) {
                        emojiFootageName = emojiFootageItem.name; // save before close invalidates it
                        var emojiItrComps = findItrComps();
                        for (var es = 0; es < ITR_SUFFIXES.length; es++) {
                            var emojiComp = emojiItrComps[ITR_SUFFIXES[es]];
                            if (!emojiComp) continue;
                            // Remove previous emoji layer from this comp
                            removeEmojiFromComp(emojiComp);
                            try {
                                var eLayer = emojiComp.layers.add(emojiFootageItem);
                                eLayer.name = EMOJI_LAYER_NAME;
                                eLayer.inPoint  = 0;
                                eLayer.outPoint = emojiComp.duration;
                                eLayer.transform.position.setValue([emojiEx, emojiEy]);
                                eLayer.transform.scale.setValue([100, 100]);
                                eLayer.timeRemapEnabled = true;
                                eLayer.timeRemap.expression = 'loopOut("cycle")';
                                if (emojiEi > 1) {
                                    if (emojiEi >= emojiComp.numLayers) eLayer.moveToEnd();
                                    else eLayer.moveAfter(emojiComp.layer(emojiEi));
                                }
                            } catch (ee) { warnings.push("Iter " + (iter + 1) + " emoji [" + ITR_SUFFIXES[es] + "]: " + ee.message); }
                        }
                    }
                }
            }

            // Save, then close+reopen so time-remap expressions (loopOut) evaluate
            // correctly during the render queue pass.
            app.project.save(currentFile);
            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
            app.open(currentFile);

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

            // Clean project panel before collect.
            // Protect: the 3 ITR render comps + the emoji footage item (if any).
            var cleanItrComps = findItrComps();
            var cleanItrProtected = [];
            for (var cis = 0; cis < ITR_SUFFIXES.length; cis++) {
                if (cleanItrComps[ITR_SUFFIXES[cis]]) cleanItrProtected.push(cleanItrComps[ITR_SUFFIXES[cis]].name);
            }
            if (emojiFootageName) cleanItrProtected.push(emojiFootageName);
            try { cleanProject(cleanItrProtected); } catch (ce) { warnings.push("Iter " + (iter + 1) + " clean: " + ce.message); }

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

// ── CEP: run 5 VAR variants ───────────────────────────────────────────────────
// cfg: { compName, layers, values (5×N), varNames (5 names) }

function runVarIterationsJSON(configJSON) {
    try {
        var cfg = JSON.parse(configJSON);
        var projectFile = app.project.file;
        if (!projectFile) return JSON.stringify({ error: "Project not saved. Save it first." });
        var warnings = [];
        var log = [];

        log.push("=== VAR Run started ===");
        log.push("Project: " + projectFile.name);

        // Save base project (no suppression needed — no dialogs expected here)
        app.project.save(projectFile);

        // Clean temp copy: always copy FROM here so we never corrupt the original
        var tempFile = new File(projectFile.parent.fsName + "/__aeiter_tmp__.aep");
        if (tempFile.exists) { try { tempFile.remove(); } catch (re) {} }
        if (!projectFile.copy(tempFile.fsName)) {
            return JSON.stringify({ error: "Could not create temp copy of base project." });
        }

        // The base comp name (e.g. "TL_11352_..._VAR") is the project filename
        // without extension and without the trailing aspect suffix. We use this to
        // rename only the exact render comps, not any nested comp that also happens
        // to end with _9x16 / _1x1 / _16x9.
        var originalBase = stripAspectSuffix(projectFile.name.replace(/\.[^.]+$/, ""));

        for (var iter = 0; iter < 5; iter++) {
            var varName = (cfg.varNames[iter] || ("VAR" + (iter + 1))).replace(/\.aep$/i, "");
            var safeName = varName.replace(/[\/\\:*?"<>|]/g, "_");
            var varProjectName = safeName;
            var varBase        = stripAspectSuffix(varProjectName);
            log.push("");
            log.push("--- Iteration " + (iter + 1) + ": " + varName + " ---");

            var varFile = new File(projectFile.parent.fsName + "/" + varProjectName + ".aep");
            // File.copy() does not overwrite — remove any existing copy first
            if (varFile.exists) { try { varFile.remove(); } catch (re) {} }
            if (!tempFile.copy(varFile.fsName)) {
                warnings.push("VAR " + varName + ": could not copy base project, skipping.");
                continue;
            }

            // Suppress before open to silence the fonts-missing dialog
            app.beginSuppressDialogs();
            app.open(varFile);

            // Rename the 3 render comps and capture their references.
            // Exact match on originalBase prevents accidentally renaming nested comps.
            // We keep the references so rendering doesn't need a second project scan.
            var renderComps = {};  // ASPECT_SUFFIXES[s] -> CompItem
            for (var rs = 0; rs < ASPECT_SUFFIXES.length; rs++) {
                var origRenderName = originalBase + "_" + ASPECT_SUFFIXES[rs];
                for (var ri = 1; ri <= app.project.numItems; ri++) {
                    var ritem = app.project.item(ri);
                    if ((ritem instanceof CompItem) &&
                            (ritem.name === origRenderName || ritem.name === origRenderName + ".aep")) {
                        var prevCompName = ritem.name;
                        ritem.name = varBase + "_" + ASPECT_SUFFIXES[rs];
                        renderComps[ASPECT_SUFFIXES[rs]] = ritem;
                        log.push("[Setup] Renamed comp: " + prevCompName + " → " + ritem.name);
                        break;
                    }
                }
                if (!renderComps[ASPECT_SUFFIXES[rs]]) {
                    log.push("[Setup] WARNING: comp not found: " + origRenderName);
                }
            }

            // Lift suppression so importFile can show codec/alpha dialogs if needed.
            // importFile silently returns null when dialogs are suppressed.
            app.endSuppressDialogs(false);

            var preImportedMedia = {};  // layerIndex -> FootageItem
            for (var pli = 0; pli < cfg.layers.length; pli++) {
                var plc = cfg.layers[pli];
                if (plc.layerType !== "media") continue;
                var pval = cfg.values[iter][pli];
                if (!pval || !pval.mediaPath) continue;
                try {
                    var mf = new File(pval.mediaPath);
                    if (!mf.exists) {
                        var noMediaMsg = "VAR " + varName + " layer " + plc.index + ": media file not found";
                        warnings.push(noMediaMsg);
                        log.push("[Media] ERROR: " + noMediaMsg);
                        continue;
                    }
                    log.push("[Media] Importing: " + mf.name);
                    var fi = app.project.importFile(new ImportOptions(mf));
                    if (fi) { preImportedMedia[plc.index] = fi; log.push("[Media] Imported OK: " + mf.name); }
                    else { warnings.push("VAR " + varName + " layer " + plc.index + ": importFile returned null"); log.push("[Media] ERROR: importFile returned null for " + mf.name); }
                } catch (me) {
                    warnings.push("VAR " + varName + " layer " + plc.index + ": import error: " + me.message);
                    log.push("[Media] ERROR: " + me.message);
                }
            }

            // Restore suppression for apply / save / render / collect
            app.beginSuppressDialogs();

            // Find the comp where the user's layers live.
            // If cfg.compName ends with an aspect suffix it was one of the 3 render
            // comps and was renamed → look for varBase + that suffix.
            // If it has no aspect suffix it is a nested precomp and was NOT renamed
            // → look for it by its original name.
            // Strip ".aep" first — AE can store comp names with the file extension.
            var cfgCompBase = cfg.compName.replace(/\.aep$/i, "");
            var origAspect = "";
            for (var as = 0; as < ASPECT_SUFFIXES.length; as++) {
                var asSuffix = "_" + ASPECT_SUFFIXES[as];
                if (cfgCompBase.slice(-asSuffix.length) === asSuffix) {
                    origAspect = ASPECT_SUFFIXES[as]; break;
                }
            }
            var searchCompName = origAspect ? (varBase + "_" + origAspect) : cfgCompBase;
            var comp = null;
            for (var ci = 1; ci <= app.project.numItems; ci++) {
                var it = app.project.item(ci);
                if ((it instanceof CompItem) &&
                        (it.name === searchCompName || it.name === searchCompName + ".aep")) {
                    comp = it; break;
                }
            }
            if (!comp) {
                app.endSuppressDialogs(false);
                return JSON.stringify({ error: "VAR " + varName + ": comp not found: " + searchCompName, log: log });
            }

            // Apply per-layer values
            log.push("[Apply] Applying changes to " + cfg.layers.length + " layer(s)...");
            app.beginUndoGroup("VAR " + varName);
            for (var li = 0; li < cfg.layers.length; li++) {
                var lc    = cfg.layers[li];
                var layer = comp.layer(lc.index);
                if (!layer) { warnings.push("VAR " + varName + ": layer " + lc.index + " not found"); log.push("[Apply] WARNING: layer " + lc.index + " not found in " + comp.name); continue; }
                var val = cfg.values[iter][li];
                if (lc.layerType === "media") {
                    var fi2 = preImportedMedia[lc.index];
                    if (fi2) {
                        try {
                            layer.replaceSource(fi2, false);
                            log.push("[Apply] replaceSource OK: layer " + lc.index);
                            try {
                                layer.transform.scale.expression =
                                    "var rw = thisComp.width / source.width;\n" +
                                    "var rh = thisComp.height / source.height;\n" +
                                    "var r = Math.max(rw, rh) * 100;\n[r, r]";
                            } catch (ee) {}
                        } catch (re) {
                            warnings.push("VAR " + varName + ": replaceSource failed on layer " + lc.index + ": " + re.message);
                            log.push("[Apply] ERROR replaceSource: " + re.message);
                        }
                    }
                } else {
                    var err = applyLayerValueStrict(layer, lc, val, "VAR " + varName);
                    if (err) {
                        app.endUndoGroup();
                        app.endSuppressDialogs(false);
                        return JSON.stringify({ error: err, log: log });
                    }
                    log.push("[Apply] OK: layer " + lc.index + " (" + lc.layerType + ")");
                }
            }
            app.endUndoGroup();
            app.endSuppressDialogs(false);

            // Output folders
            var gdFolder = new Folder(projectFile.parent.fsName + "/GD");
            if (!gdFolder.exists) gdFolder.create();
            var deliveryFolder = new Folder(gdFolder.fsName + "/" + varProjectName);
            if (!deliveryFolder.exists) deliveryFolder.create();
            var collectFolder  = new Folder(deliveryFolder.fsName + "/" + varProjectName + " folder");
            if (!collectFolder.exists) collectFolder.create();

            // Render Videos via render queue (works in-memory, before save)
            try { renderVarVideos(renderComps, deliveryFolder, log); }
            catch (e) { warnings.push("VAR " + varName + " Video: " + e.message); log.push("[VID] FAILED: " + e.message); }

            // Save, then close+reopen so footage is loaded from disk
            log.push("[Save] Saving " + varFile.name + "...");
            app.project.save(varFile);
            log.push("[Save] Done.");

            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
            app.beginSuppressDialogs();
            app.open(varFile);
            app.endSuppressDialogs(false);

            // Organise project panel and remove unused items before rendering/collecting.
            // The 3 render comps are protected so they are never treated as "unused".
            var cleanProtected = [];
            for (var cps = 0; cps < ASPECT_SUFFIXES.length; cps++) {
                cleanProtected.push(varBase + "_" + ASPECT_SUFFIXES[cps]);
                cleanProtected.push(varBase + "_" + ASPECT_SUFFIXES[cps] + ".aep");
            }
            log.push("[Clean] Organising project panel...");
            try {
                var cleanRes = JSON.parse(cleanProject(cleanProtected));
                if (cleanRes.ok) log.push("[Clean] Done. " + cleanRes.removed + " unused item(s) removed.");
                else { warnings.push("VAR " + varName + " clean: " + cleanRes.error); log.push("[Clean] ERROR: " + cleanRes.error); }
            } catch (ce) {
                warnings.push("VAR " + varName + " clean: " + ce.message);
                log.push("[Clean] FAILED: " + ce.message);
            }

            // Render PNGs via saveFrameToPng — works after a clean project load
            // (saveFrameToPng fails on in-memory replaceSource footage but is fine here)
            log.push("[PNG] Rendering PNGs via saveFrameToPng after clean reload...");
            var pngErrors = [];
            for (var ps = 0; ps < ASPECT_SUFFIXES.length; ps++) {
                var pngCompName = varBase + "_" + ASPECT_SUFFIXES[ps];
                var pngComp = null;
                for (var pci = 1; pci <= app.project.numItems; pci++) {
                    var pIt = app.project.item(pci);
                    if ((pIt instanceof CompItem) &&
                            (pIt.name === pngCompName || pIt.name === pngCompName + ".aep")) {
                        pngComp = pIt; break;
                    }
                }
                if (!pngComp) {
                    pngErrors.push("Comp not found: " + pngCompName);
                    log.push("[PNG] ERROR: comp not found: " + pngCompName);
                    continue;
                }
                var prevPngRes = pngComp.resolutionFactor;
                if (prevPngRes[0] !== 1 || prevPngRes[1] !== 1) pngComp.resolutionFactor = [1, 1];
                var pngFile = new File(deliveryFolder.fsName + "/" + pngComp.name + ".png");
                try {
                    pngComp.saveFrameToPng(0, pngFile);
                    if (pngFile.exists) {
                        log.push("[PNG] OK: " + pngComp.name + ".png");
                    } else {
                        pngErrors.push(pngComp.name + ": saveFrameToPng did not create file");
                        log.push("[PNG] ERROR: file not created for " + pngComp.name);
                    }
                } catch (pe) {
                    pngErrors.push(pngComp.name + ": " + pe.message);
                    log.push("[PNG] ERROR: " + pe.message);
                }
                pngComp.resolutionFactor = prevPngRes;
            }
            if (pngErrors.length) warnings.push("VAR " + varName + " PNG: " + pngErrors.join(" | "));

            log.push("[Collect] Collecting " + varProjectName + "...");
            try { performCollect(varFile, collectFolder); log.push("[Collect] Done."); }
            catch (e) { warnings.push("VAR " + varName + " collect: " + e.message); log.push("[Collect] FAILED: " + e.message); }

            app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
        }

        log.push("");
        log.push("=== VAR Run complete. " + (warnings.length ? warnings.length + " warning(s)." : "No warnings.") + " ===");
        try { tempFile.remove(); } catch (te) {}
        app.beginSuppressDialogs();
        app.open(projectFile);
        app.endSuppressDialogs(false);
        return JSON.stringify({ success: true, warnings: warnings, log: log });
    } catch (e) {
        try { app.endSuppressDialogs(false); } catch (e2) {}
        return JSON.stringify({ error: e.message, log: log });
    }
}

// ── CEP: test which comps will be rendered in VAR mode ────────────────────────
// Read-only scan — does not open, modify, or render anything.
// cfg: { varNames: ["name1", ...] }

function testVarRenderCompsJSON(configJSON) {
    try {
        var cfg = JSON.parse(configJSON);
        var projectFile = app.project.file;
        if (!projectFile) return JSON.stringify({ error: "Project not saved. Save it first." });

        var log = [];
        var originalBase = stripAspectSuffix(projectFile.name.replace(/\.[^.]+$/, ""));
        log.push("Project: " + projectFile.name);
        log.push("Base name: " + originalBase);
        log.push("");
        log.push("Scanning for render comps in current project:");

        var foundCount = 0;
        for (var s = 0; s < ASPECT_SUFFIXES.length; s++) {
            var targetName = originalBase + "_" + ASPECT_SUFFIXES[s];
            var found = null;
            for (var i = 1; i <= app.project.numItems; i++) {
                var item = app.project.item(i);
                // Match with or without .aep suffix (AE can add .aep to imported comp names)
                if ((item instanceof CompItem) &&
                        (item.name === targetName || item.name === targetName + ".aep")) {
                    found = item; break;
                }
            }
            if (found) {
                foundCount++;
                log.push("  OK  " + found.name +
                    "  (" + found.width + "x" + found.height +
                    "  " + Math.round(found.duration * 100) / 100 + "s" +
                    "  " + found.numLayers + " layers" +
                    "  " + Math.round(found.frameRate * 10) / 10 + " fps)");
            } else {
                log.push("  MISSING  " + targetName);
            }
        }

        log.push("");
        log.push(foundCount + " / " + ASPECT_SUFFIXES.length + " render comps found.");

        // List all comps in the project for reference
        log.push("");
        log.push("All compositions in project:");
        for (var ac = 1; ac <= app.project.numItems; ac++) {
            var acItem = app.project.item(ac);
            if (acItem instanceof CompItem) {
                log.push("  " + acItem.name +
                    "  (" + acItem.width + "x" + acItem.height + ")");
            }
        }

        if (cfg && cfg.varNames && cfg.varNames.length) {
            log.push("");
            log.push("VAR names configured (after stripping .aep):");
            for (var vi = 0; vi < cfg.varNames.length; vi++) {
                var displayName = (cfg.varNames[vi] || "").replace(/\.aep$/i, "");
                log.push("  " + (vi + 1) + ". " + displayName);
            }
        }

        return JSON.stringify({ success: true, log: log });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}

// ── CEP: browse for a media file ──────────────────────────────────────────────

function browseForMedia() {
    try {
        var f = File.openDialog("Select media file");
        if (!f) return JSON.stringify({ path: null });
        return JSON.stringify({ path: f.fsName });
    } catch (e) {
        return JSON.stringify({ error: e.message });
    }
}
