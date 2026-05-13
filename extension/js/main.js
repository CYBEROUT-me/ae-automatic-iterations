(function () {
    "use strict";

    var cs = new CSInterface();

    // ── State ─────────────────────────────────────────────────────────────────
    var layerInfo       = null;
    var allFonts        = [];
    var activeFontInput = null;

    // ── DOM refs ──────────────────────────────────────────────────────────────
    var layerInfoEl        = document.getElementById("layer-info");
    var btnRefresh         = document.getElementById("btn-refresh");
    var changeTypeSection  = document.getElementById("change-type-section");
    var fontSection        = document.getElementById("font-search-section");
    var fontSearch         = document.getElementById("font-search");
    var fontDropdown       = document.getElementById("font-dropdown");
    var colLabel           = document.getElementById("col-value-label");
    var btnRun             = document.getElementById("btn-run");
    var btnTest            = document.getElementById("btn-test");
    var statusEl           = document.getElementById("status");
    var debugLog           = document.getElementById("debug-log");
    var sameAllSection     = document.getElementById("same-all-section");
    var sameForAllChk      = document.getElementById("same-for-all");
    var extraLayersSection = document.getElementById("extra-layers-section");

    // ── Helpers ───────────────────────────────────────────────────────────────

    function hexToRgb(hex) {
        return [
            parseInt(hex.slice(1, 3), 16) / 255,
            parseInt(hex.slice(3, 5), 16) / 255,
            parseInt(hex.slice(5, 7), 16) / 255
        ];
    }

    function rgbToHex(arr) {
        function h(v) { var s = Math.round(v * 255).toString(16); return s.length === 1 ? "0" + s : s; }
        return "#" + h(arr[0]) + h(arr[1]) + h(arr[2]);
    }

    function normaliseHex(raw) {
        var s = raw.trim();
        if (s[0] !== "#") s = "#" + s;
        return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : null;
    }

    function setStatus(msg, isError, isOk) {
        statusEl.textContent = msg;
        statusEl.className   = isError ? "error" : isOk ? "ok" : "";
    }

    function showDebugLog(lines) {
        debugLog.textContent = Array.isArray(lines) ? lines.join("\n") : lines;
        debugLog.classList.remove("hidden");
    }

    function syncColorPair(cpEl, hiEl) {
        cpEl.addEventListener("input",  function () { hiEl.value = this.value.toUpperCase(); });
        hiEl.addEventListener("change", function () {
            var h = normaliseHex(this.value);
            if (h) { this.value = h; cpEl.value = h.toLowerCase(); }
            else   { this.value = cpEl.value.toUpperCase(); }
        });
    }

    // ── Main row color sync ───────────────────────────────────────────────────

    function attachMainSync() {
        var cps = document.querySelectorAll("#iterations-section .color-pick");
        var his = document.querySelectorAll("#iterations-section .hex-input");
        for (var i = 0; i < cps.length; i++) syncColorPair(cps[i], his[i]);
    }

    attachMainSync();

    // ── Layer-type-aware UI ───────────────────────────────────────────────────
    // Shows/hides font inputs based on whether any selected layer is a text layer.

    function applyLayerTypes(layers) {
        var hasText = false;
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].type === "text") { hasText = true; break; }
        }

        fontSection.classList.toggle("hidden", !hasText);

        var rows = document.querySelectorAll("#iterations-section .iter-row");
        for (var r = 0; r < rows.length; r++) {
            var fi = rows[r].querySelector(".font-input");
            if (fi) fi.classList.toggle("hidden", !hasText);
        }

        if (colLabel) colLabel.textContent = hasText ? "Color & Font" : "Color";
    }

    // ── Refresh layer ─────────────────────────────────────────────────────────

    btnRefresh.addEventListener("click", function () {
        setStatus("Reading layer…");
        debugLog.classList.add("hidden");
        cs.evalScript("getLayerInfoJSON()", function (result) {
            try {
                var info = JSON.parse(result);
                if (info.error) { setStatus(info.error, true); return; }
                layerInfo = info;
                renderLayerInfo(info);
                setStatus("");
                btnRun.disabled  = false;
                btnTest.disabled = false;
            } catch (e) {
                setStatus("Parse error: " + e.message, true);
            }
        });
    });

    function renderLayerInfo(info) {
        // Inject virtual stroke entries for each shape layer that has strokes
        var origLen = info.layers.length;
        for (var s = 0; s < origLen; s++) {
            var rl = info.layers[s];
            if (rl.type === "shape" && rl.strokes && rl.strokes.length) {
                for (var sk = 0; sk < rl.strokes.length; sk++) {
                    info.layers.push({
                        name:       "Stroke — " + rl.name,
                        index:      rl.index,
                        type:       "stroke",
                        strokePath: rl.strokes[sk].path,
                        color:      rl.strokes[sk].color
                    });
                }
            }
        }

        var names = info.layers.map(function (l) {
            var s = l.name + " [" + l.type + "]";
            if (l.type === "shape" && l.fills) s += " \xb7" + l.fills.length + "f";
            return s;
        });
        layerInfoEl.textContent = names.join("  |  ");
        layerInfoEl.classList.add("loaded");

        var multi = info.layers.length > 1;
        sameAllSection.classList.toggle("hidden", !multi);
        if (!multi) sameForAllChk.checked = true;

        prefillMainRows(info.layers[0]);
        applyLayerTypes(info.layers);
        rebuildExtraLayers();
    }

    function prefillMainRows(layer) {
        if (!layer) return;
        var hex;
        if (layer.type === "shape" && layer.fills && layer.fills.length) {
            hex = rgbToHex(layer.fills[0].color).toUpperCase();
        } else if (layer.type === "text" && layer.color) {
            hex = rgbToHex(layer.color).toUpperCase();
        }
        var cps = document.querySelectorAll("#iterations-section .color-pick");
        var his = document.querySelectorAll("#iterations-section .hex-input");
        var fis = document.querySelectorAll("#iterations-section .font-input");
        if (hex) {
            for (var j = 0; j < 5; j++) {
                if (cps[j]) cps[j].value = hex.toLowerCase();
                if (his[j]) his[j].value = hex;
            }
        }
        if (layer.font) {
            for (var m = 0; m < 5; m++) {
                if (fis[m]) fis[m].value = layer.font;
            }
            fontSearch.value = layer.font;
        }
    }

    // ── "Same for all" checkbox ───────────────────────────────────────────────

    sameForAllChk.addEventListener("change", function () { rebuildExtraLayers(); });

    // ── Row builder helper ────────────────────────────────────────────────────

    function buildIterRows(lInfo, li, showFont) {
        var rows = [];
        for (var iter = 0; iter < 5; iter++) {
            var row = document.createElement("div");
            row.className = "iter-row";

            var num = document.createElement("span");
            num.className   = "iter-num";
            num.textContent = iter + 1;
            row.appendChild(num);

            var cell = document.createElement("div");
            cell.className = "color-cell";

            var cp = document.createElement("input");
            cp.type          = "color";
            cp.className     = "color-pick";
            cp.dataset.layer = li;
            cp.dataset.row   = iter;

            var hi = document.createElement("input");
            hi.type          = "text";
            hi.className     = "hex-input";
            hi.maxLength     = 7;
            hi.dataset.layer = li;
            hi.dataset.row   = iter;

            var hex = "#FF0000";
            if (lInfo.type === "shape" && lInfo.fills && lInfo.fills.length) {
                hex = rgbToHex(lInfo.fills[0].color).toUpperCase();
            } else if ((lInfo.type === "text" || lInfo.type === "stroke") && lInfo.color) {
                hex = rgbToHex(lInfo.color).toUpperCase();
            }
            cp.value = hex.toLowerCase();
            hi.value = hex;
            syncColorPair(cp, hi);

            cell.appendChild(cp);
            cell.appendChild(hi);
            row.appendChild(cell);

            if (showFont) {
                var fi = document.createElement("input");
                fi.type          = "text";
                fi.className     = "font-input";
                fi.placeholder   = "PostScript name";
                fi.dataset.layer = li;
                fi.dataset.row   = iter;
                if (lInfo.font) fi.value = lInfo.font;
                attachFontFocus(fi);
                row.appendChild(fi);
            }

            var pb = document.createElement("button");
            pb.className = "sample-btn";
            pb.title     = "Capture current AE values into this row";
            pb.innerHTML = "&#8592;";
            pb.dataset.row = iter;
            (function (rowIdx, liIdx, pbEl) {
                pbEl.addEventListener("click", function () {
                    if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }
                    sampleRow(rowIdx, liIdx, pbEl);
                });
            })(iter, li, pb);
            row.appendChild(pb);

            rows.push(row);
        }
        return rows;
    }

    function attachStrokeSection(container, lInfo, li) {
        container.classList.add("has-attached-stroke");
        var sec = document.createElement("div");
        sec.className = "attached-stroke-section";

        var sub = document.createElement("div");
        sub.className   = "stroke-sublabel";
        sub.textContent = "Stroke";
        sec.appendChild(sub);

        var rows = buildIterRows(lInfo, li, false);
        for (var r = 0; r < rows.length; r++) sec.appendChild(rows[r]);
        container.appendChild(sec);
    }

    // ── Extra layer groups (layers 1..N-1) ────────────────────────────────────

    function rebuildExtraLayers() {
        extraLayersSection.innerHTML = "";

        // Remove any stroke sections previously appended inside #iterations-section or extra groups
        var iterSection = document.getElementById("iterations-section");
        var old = iterSection.querySelectorAll(".attached-stroke-section");
        for (var o = 0; o < old.length; o++) iterSection.removeChild(old[o]);
        iterSection.classList.remove("has-attached-stroke");

        if (!layerInfo) return;
        var numLayers = layerInfo.layers.length;
        if (numLayers <= 1) return;

        // Map AE layer index → owner DOM container (for attaching stroke sub-sections)
        var containers = {};
        containers[layerInfo.layers[0].index] = iterSection;

        // Layer 0 strokes: always show (even when sameForAllChk is on)
        for (var li = 1; li < numLayers; li++) {
            var lInfo = layerInfo.layers[li];
            if (lInfo.type === "stroke" && containers[lInfo.index] === iterSection) {
                attachStrokeSection(iterSection, lInfo, li);
            }
        }

        if (sameForAllChk.checked) return;

        // Extra layers 1+
        for (var li2 = 1; li2 < numLayers; li2++) {
            var lInfo2 = layerInfo.layers[li2];

            // Skip layer-0 strokes (already handled above)
            if (lInfo2.type === "stroke" && containers[lInfo2.index] === iterSection) continue;

            // Stroke belonging to an extra layer group
            if (lInfo2.type === "stroke" && containers[lInfo2.index]) {
                attachStrokeSection(containers[lInfo2.index], lInfo2, li2);
                continue;
            }

            // Normal extra layer
            var group = document.createElement("div");
            group.className = "extra-layer-group";

            var label = document.createElement("div");
            label.className   = "layer-group-label";
            label.textContent = lInfo2.name + " [" + lInfo2.type + "]";
            group.appendChild(label);

            var rows = buildIterRows(lInfo2, li2, lInfo2.type === "text");
            for (var r2 = 0; r2 < rows.length; r2++) group.appendChild(rows[r2]);

            extraLayersSection.appendChild(group);
            containers[lInfo2.index] = group;
        }
    }

    // ── Build cfg.layers ──────────────────────────────────────────────────────

    function buildLayers() {
        var cfgLayers = [];
        for (var i = 0; i < layerInfo.layers.length; i++) {
            var li       = layerInfo.layers[i];
            var fillPath = "";
            if (li.type === "shape" && li.fills && li.fills.length) {
                fillPath = li.fills[0].path;
            } else if (li.type === "stroke") {
                fillPath = li.strokePath;
            }
            cfgLayers.push({ index: li.index, fillPath: fillPath, layerType: li.type });
        }
        return cfgLayers;
    }

    // ── Build cfg.values ──────────────────────────────────────────────────────
    // values[iter][layerIdx] = { color: [r,g,b], font: "str"|null }
    // color is always set; font is null for shape layers or when font input is empty.

    function readMainRowValue(layerData, iter) {
        var his = document.querySelectorAll("#iterations-section .hex-input");
        var fis = document.querySelectorAll("#iterations-section .font-input");

        var hex = his[iter] ? normaliseHex(his[iter].value) : null;
        if (!hex) { setStatus("Row " + (iter + 1) + ": invalid hex color.", true); return null; }

        var font = null;
        if (layerData.type === "text") {
            font = fis[iter] ? fis[iter].value.trim() || null : null;
        }

        return { color: hexToRgb(hex), font: font };
    }

    function readExtraRowValue(layerData, layerIdx, iter) {
        var hiEl = document.querySelector(
            '.hex-input[data-layer="' + layerIdx + '"][data-row="' + iter + '"]'
        );
        var hex = hiEl ? normaliseHex(hiEl.value) : null;
        if (!hex) { setStatus("Layer " + (layerIdx + 1) + " row " + (iter + 1) + ": invalid hex.", true); return null; }

        var font = null;
        if (layerData.type === "text") {
            var fiEl = document.querySelector(
                '.font-input[data-layer="' + layerIdx + '"][data-row="' + iter + '"]'
            );
            font = fiEl ? fiEl.value.trim() || null : null;
        }

        return { color: hexToRgb(hex), font: font };
    }

    function buildValues() {
        var numLayers  = layerInfo.layers.length;
        var sameForAll = numLayers === 1 || sameForAllChk.checked;
        var result     = [];

        for (var iter = 0; iter < 5; iter++) {
            var v0 = readMainRowValue(layerInfo.layers[0], iter);
            if (!v0) return null;

            var iterVals = [v0];

            if (!sameForAll) {
                for (var li = 1; li < numLayers; li++) {
                    var vli = readExtraRowValue(layerInfo.layers[li], li, iter);
                    if (!vli) return null;
                    iterVals.push(vli);
                }
            } else {
                // Same color for all AE layers; strokes always read their own rows.
                for (var li2 = 1; li2 < numLayers; li2++) {
                    var layer2 = layerInfo.layers[li2];
                    if (layer2.type === "stroke") {
                        var vStroke = readExtraRowValue(layer2, li2, iter);
                        if (!vStroke) return null;
                        iterVals.push(vStroke);
                    } else {
                        iterVals.push({
                            color: v0.color,
                            font: layer2.type === "text" ? v0.font : null
                        });
                    }
                }
            }

            result.push(iterVals);
        }

        return result;
    }

    // ── Per-row sample (AE → extension) ──────────────────────────────────────
    // Reads current layer state from AE and populates the target row's inputs.

    function fillRowFromLayer(iter, layer, section) {
        var hex;
        if (layer.type === "shape" && layer.fills && layer.fills.length) {
            hex = rgbToHex(layer.fills[0].color).toUpperCase();
        } else if ((layer.type === "text" || layer.type === "stroke") && layer.color) {
            hex = rgbToHex(layer.color).toUpperCase();
        }
        if (hex) {
            var cp = section.querySelectorAll(".color-pick");
            var hi = section.querySelectorAll(".hex-input");
            if (cp[iter]) cp[iter].value = hex.toLowerCase();
            if (hi[iter]) hi[iter].value = hex;
        }
        if (layer.type === "text" && layer.font) {
            var fi = section.querySelectorAll(".font-input");
            if (fi[iter]) fi[iter].value = layer.font;
        }
    }

    function fillExtraRowFromLayer(iter, layerIdx, layer) {
        var hex;
        if (layer.type === "shape" && layer.fills && layer.fills.length) {
            hex = rgbToHex(layer.fills[0].color).toUpperCase();
        } else if ((layer.type === "text" || layer.type === "stroke") && layer.color) {
            hex = rgbToHex(layer.color).toUpperCase();
        }
        if (hex) {
            var cp = document.querySelector('.color-pick[data-layer="' + layerIdx + '"][data-row="' + iter + '"]');
            var hi = document.querySelector('.hex-input[data-layer="' + layerIdx + '"][data-row="' + iter + '"]');
            if (cp) cp.value = hex.toLowerCase();
            if (hi) hi.value = hex;
        }
        if (layer.type === "text" && layer.font) {
            var fi = document.querySelector('.font-input[data-layer="' + layerIdx + '"][data-row="' + iter + '"]');
            if (fi) fi.value = layer.font;
        }
    }

    // Reads a specific layer by its timeline index — no selection needed.
    function sampleRow(iter, layerIdx, btn) {
        if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }

        var target = layerInfo.layers[layerIdx];
        if (!target) { setStatus("Layer info missing — click Refresh first.", true); return; }

        var cfg = {
            compName: layerInfo.compName,
            layers: [{ index: target.index, layerType: target.type, fillPath: target.strokePath || "" }]
        };

        if (btn) btn.classList.add("sampling");
        setStatus("Reading from AE…");

        cs.evalScript(
            "readLayerValuesJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")",
            function (result) {
                if (btn) btn.classList.remove("sampling");
                try {
                    var res = JSON.parse(result);
                    if (res.error) { setStatus(res.error, true); return; }

                    var fresh = res.layers[0];
                    if (!fresh) { setStatus("Layer not found in comp.", true); return; }

                    // Merge fresh values back into stored layerInfo
                    if (fresh.color) target.color = fresh.color;
                    if (fresh.font)  target.font  = fresh.font;
                    if (fresh.fills) target.fills  = fresh.fills;

                    if (layerIdx === 0) {
                        fillRowFromLayer(iter, target, document.getElementById("iterations-section"));
                    } else {
                        fillExtraRowFromLayer(iter, layerIdx, target);
                    }

                    setStatus("Row " + (iter + 1) + " captured from AE", false, true);
                } catch (e) { setStatus("Parse error: " + e.message, true); }
            }
        );
    }

    // Wire static sample buttons — always layer 0 (main section)
    document.querySelectorAll("#iterations-section .sample-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }
            sampleRow(parseInt(this.dataset.row, 10), 0, this);
        });
    });

    // ── Test Apply ────────────────────────────────────────────────────────────

    btnTest.addEventListener("click", function () {
        if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }

        var numLayers  = layerInfo.layers.length;
        var sameForAll = numLayers === 1 || sameForAllChk.checked;

        var v0 = readMainRowValue(layerInfo.layers[0], 0);
        if (!v0) return;

        var value = [v0];

        if (!sameForAll) {
            for (var li = 1; li < numLayers; li++) {
                var vli = readExtraRowValue(layerInfo.layers[li], li, 0);
                if (!vli) return;
                value.push(vli);
            }
        } else {
            for (var li2 = 1; li2 < numLayers; li2++) {
                var layer2 = layerInfo.layers[li2];
                if (layer2.type === "stroke") {
                    var vStroke = readExtraRowValue(layer2, li2, 0);
                    if (!vStroke) return;
                    value.push(vStroke);
                } else {
                    value.push({
                        color: v0.color,
                        font: layer2.type === "text" ? v0.font : null
                    });
                }
            }
        }

        var cfg = {
            compName: layerInfo.compName,
            layers:   buildLayers(),
            value:    value
        };

        btnTest.disabled = btnRun.disabled = btnRefresh.disabled = true;
        setStatus("Testing…");
        debugLog.classList.add("hidden");

        cs.evalScript(
            "debugApplyChangeJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")",
            function (result) {
                btnTest.disabled = btnRun.disabled = btnRefresh.disabled = false;
                try {
                    var res   = JSON.parse(result);
                    var lines = res.log ? res.log.slice() : [];
                    if (res.error) { lines.push("ERROR: " + res.error); setStatus("Test failed — see log below", true); }
                    else           { setStatus("Test OK — applied (Ctrl+Z to undo)", false, true); }
                    showDebugLog(lines);
                } catch (e) { setStatus("Unexpected: " + result, true); }
            }
        );
    });

    // ── Run iterations ────────────────────────────────────────────────────────

    btnRun.addEventListener("click", function () {
        if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }

        var values = buildValues();
        if (!values) return;

        var cfg = {
            compName: layerInfo.compName,
            layers:   buildLayers(),
            values:   values
        };

        btnRun.disabled = btnTest.disabled = btnRefresh.disabled = true;
        setStatus("Running…");
        debugLog.classList.add("hidden");

        cs.evalScript(
            "runIterationsJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")",
            function (result) {
                btnRun.disabled = btnTest.disabled = btnRefresh.disabled = false;
                try {
                    var res = JSON.parse(result);
                    if (res.error) {
                        setStatus(res.error, true);
                        showDebugLog([res.error]);
                    } else if (res.warnings && res.warnings.length) {
                        setStatus("Done with warnings — see log below", false, true);
                        showDebugLog(res.warnings);
                    } else {
                        setStatus("Done — 5 iterations complete.", false, true);
                    }
                } catch (e) {
                    setStatus("Unexpected response", true);
                    showDebugLog([result]);
                }
            }
        );
    });

    // ── Font list (macOS only) ────────────────────────────────────────────────

    function loadFonts() {
        try {
            var cp   = require("child_process");
            var raw  = cp.execSync("system_profiler SPFontsDataType -json", { timeout: 15000 }).toString();
            var data = JSON.parse(raw);
            var items = data.SPFontsDataType || [];
            var seen  = {};
            allFonts  = [];
            for (var i = 0; i < items.length; i++) {
                var ps = items[i]._name || items[i].postscript_name || "";
                if (ps && !seen[ps]) { seen[ps] = true; allFonts.push(ps); }
            }
            allFonts.sort();
        } catch (e) { allFonts = []; }
    }

    function showFontDropdown(query) {
        query = query.toLowerCase();
        var matches = allFonts.filter(function (f) {
            return f.toLowerCase().indexOf(query) !== -1;
        }).slice(0, 30);
        fontDropdown.innerHTML = "";
        if (!matches.length) { fontDropdown.classList.add("hidden"); return; }
        matches.forEach(function (ps) {
            var div = document.createElement("div");
            div.className   = "font-option";
            div.textContent = ps;
            div.addEventListener("mousedown", function (e) {
                e.preventDefault();
                fontSearch.value = ps;
                if (activeFontInput) activeFontInput.value = ps;
                fontDropdown.classList.add("hidden");
            });
            fontDropdown.appendChild(div);
        });
        fontDropdown.classList.remove("hidden");
    }

    fontSearch.addEventListener("input", function () { showFontDropdown(this.value); });
    fontSearch.addEventListener("blur",  function () {
        setTimeout(function () { fontDropdown.classList.add("hidden"); }, 150);
    });

    function attachFontFocus(fiEl) {
        fiEl.addEventListener("focus", function () {
            activeFontInput  = fiEl;
            fontSearch.value = this.value;
            fontSearch.focus();
            fontSearch.select();
            if (allFonts.length) showFontDropdown(this.value);
        });
    }

    // Attach to static main rows
    var staticFontInputs = document.querySelectorAll("#iterations-section .font-input");
    for (var fi = 0; fi < staticFontInputs.length; fi++) {
        attachFontFocus(staticFontInputs[fi]);
    }

    // ── Auto-update ───────────────────────────────────────────────────────────

    var GITHUB_REPO = "CYBEROUT-me/ae-automatic-iterations";

    function checkForUpdates() {
        try {
            var localVersion = AE_ITERATIONS_VERSION;

            setStatus("Checking for updates (local: " + localVersion + ")…");

            var xhr = new XMLHttpRequest();
            xhr.open("GET", "https://api.github.com/repos/" + GITHUB_REPO + "/releases/latest");
            xhr.setRequestHeader("User-Agent", "AE-Iterations/" + localVersion);
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status !== 200) {
                    setStatus("Update check: HTTP " + xhr.status);
                    return;
                }
                try {
                    var release = JSON.parse(xhr.responseText);
                    if (!release.tag_name) { setStatus("Update check: no tag_name in response"); return; }
                    var remoteVersion = release.tag_name.replace(/^v/, "");
                    setStatus("Update check: local=" + localVersion + " remote=" + remoteVersion);
                    if (remoteVersion !== localVersion) showUpdateBanner(release);
                    else setStatus("");
                } catch (e) { setStatus("Update parse error: " + e.message); }
            };
            xhr.onerror = function () { setStatus("Update check: network error"); };
            xhr.send();
        } catch (e) { setStatus("Update check failed: " + e.message); }
    }

    function showUpdateBanner(release) {
        var banner    = document.getElementById("update-banner");
        var verLabel  = document.getElementById("update-version");
        var btnUpdate = document.getElementById("btn-update");
        if (verLabel) verLabel.textContent = release.tag_name;
        if (banner)   banner.classList.remove("hidden");
        if (btnUpdate) btnUpdate.onclick = function () { installUpdate(release); };
    }

    function installUpdate(release) {
        var asset = null;
        for (var i = 0; i < release.assets.length; i++) {
            if (release.assets[i].name === "AE-Iterations.zip") { asset = release.assets[i]; break; }
        }
        if (!asset) { setStatus("Update asset not found in release.", true); return; }

        document.getElementById("update-banner").classList.add("hidden");
        setStatus("Downloading " + release.tag_name + "…");

        var tmpZip = "/tmp/AE-Iterations-update.zip";
        var tmpDir = "/tmp/ae-iterations-update";

        downloadFile(asset.browser_download_url, tmpZip, function (err) {
            if (err) { setStatus("Download failed: " + err, true); return; }
            setStatus("Installing…");
            try {
                var cp = require("child_process");
                cp.execSync("rm -rf '" + tmpDir + "'");
                cp.execSync("unzip -o '" + tmpZip + "' -d '" + tmpDir + "'");
                cp.execSync("bash '" + tmpDir + "/install.sh'");
                setStatus("Updated to " + release.tag_name + " — restart After Effects.", false, true);
            } catch (e) { setStatus("Install failed: " + e.message, true); }
        });
    }

    function downloadFile(url, dest, cb) {
        var https = require("https");
        var http  = require("http");
        var fs    = require("fs");
        var mod   = url.indexOf("https") === 0 ? https : http;
        mod.get(url, function (res) {
            if (res.statusCode === 301 || res.statusCode === 302) {
                downloadFile(res.headers.location, dest, cb); return;
            }
            var file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on("finish", function () { file.close(function () { cb(null); }); });
            file.on("error",  function (e) { cb(e.message); });
        }).on("error", function (e) { cb(e.message); });
    }

    // ── Presets ───────────────────────────────────────────────────────────────

    var _libraryPresets  = null;
    var _userPresetsPath = null;

    function getLibraryPresets() {
        if (_libraryPresets) return _libraryPresets;
        try {
            var fs      = require("fs");
            var path    = require("path");
            var extPath = cs.getSystemPath(SystemPath.EXTENSION);
            var libPath = path.join(extPath, "presets", "library.json");
            _libraryPresets = JSON.parse(fs.readFileSync(libPath, "utf8"));
        } catch (e) { _libraryPresets = []; }
        return _libraryPresets;
    }

    function getUserPresetsPath() {
        if (_userPresetsPath) return _userPresetsPath;
        try {
            var os   = require("os");
            var path = require("path");
            var fs   = require("fs");
            var dir  = path.join(os.homedir(), "Library", "Application Support", "AE Iterations");
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            _userPresetsPath = path.join(dir, "user-presets.json");
        } catch (e) { _userPresetsPath = null; }
        return _userPresetsPath;
    }

    function loadUserPresets() {
        try {
            var p  = getUserPresetsPath();
            if (!p) return [];
            var fs = require("fs");
            if (!fs.existsSync(p)) return [];
            return JSON.parse(fs.readFileSync(p, "utf8"));
        } catch (e) { return []; }
    }

    function saveUserPresets(presets) {
        try {
            var p  = getUserPresetsPath();
            if (!p) return;
            var fs = require("fs");
            fs.writeFileSync(p, JSON.stringify(presets, null, 2), "utf8");
        } catch (e) { setStatus("Could not save preset: " + e.message, true); }
    }

    function getCurrentColors() {
        var his = document.querySelectorAll("#iterations-section .hex-input");
        var colors = [];
        for (var i = 0; i < his.length; i++) {
            var h = normaliseHex(his[i].value);
            colors.push(h || "#FF0000");
        }
        return colors;
    }

    function applyPreset(colors) {
        var cps = document.querySelectorAll("#iterations-section .color-pick");
        var his = document.querySelectorAll("#iterations-section .hex-input");
        for (var i = 0; i < 5; i++) {
            var hex = normaliseHex(colors[i]);
            if (!hex) continue;
            if (cps[i]) cps[i].value = hex.toLowerCase();
            if (his[i]) his[i].value = hex;
        }
    }

    function buildSwatches(colors) {
        var wrap = document.createElement("div");
        wrap.className = "preset-swatches";
        colors.forEach(function (c) {
            var s = document.createElement("div");
            s.className = "preset-swatch";
            s.style.background = c;
            wrap.appendChild(s);
        });
        return wrap;
    }

    function renderPresetList() {
        var list = document.getElementById("preset-list");
        list.innerHTML = "";
        var userPresets = loadUserPresets();

        function makeItem(preset, isUser, idx) {
            var item = document.createElement("div");
            item.className = "preset-item";

            item.appendChild(buildSwatches(preset.colors));

            var name = document.createElement("span");
            name.className   = "preset-name";
            name.textContent = preset.name;
            item.appendChild(name);

            var applyBtn = document.createElement("button");
            applyBtn.className   = "preset-apply";
            applyBtn.textContent = "Apply";
            applyBtn.addEventListener("click", function () { applyPreset(preset.colors); });
            item.appendChild(applyBtn);

            if (isUser) {
                var delBtn = document.createElement("button");
                delBtn.className   = "preset-delete";
                delBtn.innerHTML   = "&times;";
                delBtn.title       = "Delete preset";
                (function (i) {
                    delBtn.addEventListener("click", function () {
                        var up = loadUserPresets();
                        up.splice(i, 1);
                        saveUserPresets(up);
                        renderPresetList();
                    });
                })(idx);
                item.appendChild(delBtn);
            }

            return item;
        }

        if (userPresets.length) {
            var savedLabel = document.createElement("div");
            savedLabel.className   = "preset-group-label";
            savedLabel.textContent = "Saved";
            list.appendChild(savedLabel);
            userPresets.forEach(function (p, i) { list.appendChild(makeItem(p, true, i)); });
        }

        var libLabel = document.createElement("div");
        libLabel.className   = "preset-group-label";
        libLabel.textContent = "Library";
        list.appendChild(libLabel);
        getLibraryPresets().forEach(function (p) { list.appendChild(makeItem(p, false, -1)); });
    }

    var btnPresets    = document.getElementById("btn-presets");
    var presetPanel   = document.getElementById("preset-panel");
    var presetNameIn  = document.getElementById("preset-name-input");
    var btnSavePreset = document.getElementById("btn-save-preset");

    btnPresets.addEventListener("click", function () {
        var open = presetPanel.classList.toggle("hidden");
        btnPresets.classList.toggle("open", !open);
        if (!open) renderPresetList();
    });

    btnSavePreset.addEventListener("click", function () {
        var name = presetNameIn.value.trim();
        if (!name) { presetNameIn.focus(); return; }
        var colors = getCurrentColors();
        var up = loadUserPresets();
        up.unshift({ name: name, colors: colors });
        saveUserPresets(up);
        presetNameIn.value = "";
        renderPresetList();
    });

    // ── Init ──────────────────────────────────────────────────────────────────

    // Hide the change-type dropdown — type is now auto-detected per layer
    if (changeTypeSection) changeTypeSection.classList.add("hidden");

    applyLayerTypes([]); // default: shape-only view (no font inputs)
    loadFonts();
    checkForUpdates();

})();
