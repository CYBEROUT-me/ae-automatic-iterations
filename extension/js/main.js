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

    // ── Extra layer groups (layers 1..N-1) ────────────────────────────────────

    function rebuildExtraLayers() {
        extraLayersSection.innerHTML = "";
        if (!layerInfo) return;
        var numLayers = layerInfo.layers.length;
        if (numLayers <= 1 || sameForAllChk.checked) return;

        for (var li = 1; li < numLayers; li++) {
            var lInfo  = layerInfo.layers[li];
            var isText = lInfo.type === "text";

            var group = document.createElement("div");
            group.className = "extra-layer-group";

            var label = document.createElement("div");
            label.className   = "layer-group-label";
            label.textContent = lInfo.name + " [" + lInfo.type + "]";
            group.appendChild(label);

            for (var iter = 0; iter < 5; iter++) {
                var row = document.createElement("div");
                row.className = "iter-row";

                var num = document.createElement("span");
                num.className   = "iter-num";
                num.textContent = iter + 1;
                row.appendChild(num);

                // Color cell (always shown)
                var cell = document.createElement("div");
                cell.className = "color-cell";

                var cp = document.createElement("input");
                cp.type      = "color";
                cp.className = "color-pick";
                cp.dataset.layer = li;
                cp.dataset.row   = iter;

                var hi = document.createElement("input");
                hi.type      = "text";
                hi.className = "hex-input";
                hi.maxLength = 7;
                hi.dataset.layer = li;
                hi.dataset.row   = iter;

                var hex = "#FF0000";
                if (lInfo.type === "shape" && lInfo.fills && lInfo.fills.length) {
                    hex = rgbToHex(lInfo.fills[0].color).toUpperCase();
                } else if (lInfo.type === "text" && lInfo.color) {
                    hex = rgbToHex(lInfo.color).toUpperCase();
                }
                cp.value = hex.toLowerCase();
                hi.value = hex;
                syncColorPair(cp, hi);

                cell.appendChild(cp);
                cell.appendChild(hi);
                row.appendChild(cell);

                // Font input (text layers only)
                if (isText) {
                    var fi = document.createElement("input");
                    fi.type        = "text";
                    fi.className   = "font-input";
                    fi.placeholder = "PostScript name";
                    fi.dataset.layer = li;
                    fi.dataset.row   = iter;
                    if (lInfo.font) fi.value = lInfo.font;
                    attachFontFocus(fi);
                    row.appendChild(fi);
                }

                group.appendChild(row);
            }

            extraLayersSection.appendChild(group);
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
        var hiEl = extraLayersSection.querySelector(
            '.hex-input[data-layer="' + layerIdx + '"][data-row="' + iter + '"]'
        );
        var hex = hiEl ? normaliseHex(hiEl.value) : null;
        if (!hex) { setStatus("Layer " + (layerIdx + 1) + " row " + (iter + 1) + ": invalid hex.", true); return null; }

        var font = null;
        if (layerData.type === "text") {
            var fiEl = extraLayersSection.querySelector(
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
                // Same color for all; font applies only to text layers.
                for (var li2 = 1; li2 < numLayers; li2++) {
                    iterVals.push({
                        color: v0.color,
                        font: layerInfo.layers[li2].type === "text" ? v0.font : null
                    });
                }
            }

            result.push(iterVals);
        }

        return result;
    }

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
                value.push({
                    color: v0.color,
                    font: layerInfo.layers[li2].type === "text" ? v0.font : null
                });
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

    // ── Init ──────────────────────────────────────────────────────────────────

    // Hide the change-type dropdown — type is now auto-detected per layer
    if (changeTypeSection) changeTypeSection.classList.add("hidden");

    applyLayerTypes([]); // default: shape-only view (no font inputs)
    loadFonts();

})();
