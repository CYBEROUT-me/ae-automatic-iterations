(function () {
    "use strict";

    var cs = new CSInterface();

    // ── State ─────────────────────────────────────────────────────────────────
    var layerInfo       = null;
    var allFonts        = [];
    var activeFontInput = null;
    var currentMode     = "itr"; // "itr" | "var"

    // ── DOM refs ──────────────────────────────────────────────────────────────
    var layerInfoEl        = document.getElementById("layer-info");
    var btnRefresh         = document.getElementById("btn-refresh");
    var fontSection        = document.getElementById("font-search-section");
    var fontSearch         = document.getElementById("font-search");
    var fontDropdown       = document.getElementById("font-dropdown");
    var colLabel           = document.getElementById("col-value-label");
    var btnRun             = document.getElementById("btn-run");
    var statusEl           = document.getElementById("status");
    var emojiSection       = document.getElementById("emoji-section");
    var emojiEnabled       = document.getElementById("emoji-enabled");
    var emojiConfig        = document.getElementById("emoji-config");
    var debugLog           = document.getElementById("debug-log");
    var sameAllSection     = document.getElementById("same-all-section");
    var sameForAllChk      = document.getElementById("same-for-all");
    var extraLayersSection = document.getElementById("extra-layers-section");
    var tabItr             = document.getElementById("tab-itr");
    var tabVar             = document.getElementById("tab-var");

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

    function getCount() {
        return Math.max(1, parseInt(document.getElementById("iter-count").value, 10) || 5);
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

    // ── Row builders ──────────────────────────────────────────────────────────

    var DEFAULT_COLORS = ["#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF"];

    function makeIterNum(iter) {
        var num = document.createElement("span");
        num.className    = "iter-num";
        num.textContent  = iter + 1;
        num.dataset.iter = iter;
        num.title        = "Preview iteration " + (iter + 1) + " in AE";
        if (_activePreviewNum === iter) num.classList.add("active");
        num.addEventListener("click", function () { previewIteration(iter); });
        return num;
    }

    function buildColorRow(iter, layerIdx, lInfo, showVarName) {
        var row = document.createElement("div");
        row.className = "iter-row";
        row.appendChild(makeIterNum(iter));

        if (showVarName) {
            var ni = document.createElement("input");
            ni.type        = "text";
            ni.className   = "var-name-input";
            ni.placeholder = "Name " + (iter + 1);
            ni.dataset.row = iter;
            row.appendChild(ni);
        }

        var cell = document.createElement("div");
        cell.className = "color-cell";

        var cp = document.createElement("input");
        cp.type          = "color";
        cp.className     = "color-pick";
        cp.dataset.layer = layerIdx;
        cp.dataset.row   = iter;

        var hi = document.createElement("input");
        hi.type          = "text";
        hi.className     = "hex-input";
        hi.maxLength     = 7;
        hi.dataset.layer = layerIdx;
        hi.dataset.row   = iter;

        var hex = DEFAULT_COLORS[iter];
        if (lInfo) {
            if (lInfo.type === "shape" && lInfo.fills && lInfo.fills.length)
                hex = rgbToHex(lInfo.fills[0].color).toUpperCase();
            else if ((lInfo.type === "text" || lInfo.type === "stroke") && lInfo.color)
                hex = rgbToHex(lInfo.color).toUpperCase();
        }
        cp.value = hex.toLowerCase();
        hi.value = hex.toUpperCase();
        syncColorPair(cp, hi);

        cell.appendChild(cp);
        cell.appendChild(hi);
        row.appendChild(cell);

        if (lInfo && lInfo.type === "text") {
            var fi = document.createElement("input");
            fi.type          = "text";
            fi.className     = "font-input";
            fi.placeholder   = "PostScript name";
            fi.dataset.layer = layerIdx;
            fi.dataset.row   = iter;
            if (lInfo.font) fi.value = lInfo.font;
            attachFontFocus(fi);
            row.appendChild(fi);

            var ci = document.createElement("input");
            ci.type          = "text";
            ci.className     = "content-input";
            ci.placeholder   = "Text content";
            ci.dataset.layer = layerIdx;
            ci.dataset.row   = iter;
            if (lInfo.text) ci.value = lInfo.text;
            row.appendChild(ci);
        }

        var pb = document.createElement("button");
        pb.className = "sample-btn";
        pb.title     = "Capture current AE values into this row";
        pb.innerHTML = "&#8592;";
        pb.dataset.layer = layerIdx;
        pb.dataset.row   = iter;
        (function (ri, li, el) {
            el.addEventListener("click", function () {
                if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }
                sampleRow(ri, li, el);
            });
        })(iter, layerIdx, pb);
        row.appendChild(pb);

        return row;
    }

    function buildVideoRow(iter, layerIdx, videoState, showVarName) {
        var row = document.createElement("div");
        row.className = "iter-row";
        row.appendChild(makeIterNum(iter));

        if (showVarName) {
            var ni = document.createElement("input");
            ni.type        = "text";
            ni.className   = "var-name-input";
            ni.placeholder = "Name " + (iter + 1);
            ni.dataset.row = iter;
            row.appendChild(ni);
        }

        // Flip toggle
        var flipBtn = document.createElement("button");
        flipBtn.className    = "video-toggle" + (videoState && videoState.flip ? " active" : "");
        flipBtn.title        = "Flip Horizontal";
        flipBtn.textContent  = "↔";
        flipBtn.dataset.prop  = "flip";
        flipBtn.dataset.layer = layerIdx;
        flipBtn.dataset.row   = iter;
        flipBtn.addEventListener("click", function () { this.classList.toggle("active"); });
        row.appendChild(flipBtn);

        // B&W toggle
        var bwBtn = document.createElement("button");
        bwBtn.className    = "video-toggle" + (videoState && videoState.bw ? " active" : "");
        bwBtn.title        = "Black & White";
        bwBtn.textContent  = "B&W";
        bwBtn.dataset.prop  = "bw";
        bwBtn.dataset.layer = layerIdx;
        bwBtn.dataset.row   = iter;
        bwBtn.addEventListener("click", function () { this.classList.toggle("active"); });
        row.appendChild(bwBtn);

        // Tint checkbox + color
        var tintCell = document.createElement("div");
        tintCell.className = "tint-cell";

        var tintChk = document.createElement("input");
        tintChk.type          = "checkbox";
        tintChk.className     = "tint-check";
        tintChk.dataset.layer = layerIdx;
        tintChk.dataset.row   = iter;
        var hasTint = videoState && videoState.tint;
        tintChk.checked = !!hasTint;

        var tintClr = document.createElement("input");
        tintClr.type          = "color";
        tintClr.className     = "tint-pick";
        tintClr.dataset.layer = layerIdx;
        tintClr.dataset.row   = iter;
        tintClr.value = hasTint ? rgbToHex(videoState.tint).toLowerCase() : "#ff6b35";
        tintClr.disabled = !tintChk.checked;

        var tintAmt = document.createElement("input");
        tintAmt.type          = "number";
        tintAmt.className     = "tint-amount";
        tintAmt.min           = 0;
        tintAmt.max           = 100;
        tintAmt.value         = videoState && videoState.tintAmount !== undefined ? videoState.tintAmount : 50;
        tintAmt.dataset.layer = layerIdx;
        tintAmt.dataset.row   = iter;
        tintAmt.title         = "Tint amount (%)";
        tintAmt.disabled      = !tintChk.checked;

        tintChk.addEventListener("change", function () {
            tintClr.disabled = !this.checked;
            tintAmt.disabled = !this.checked;
        });

        tintCell.appendChild(tintChk);
        tintCell.appendChild(tintClr);
        tintCell.appendChild(tintAmt);
        row.appendChild(tintCell);

        // Hue input
        var hueInp = document.createElement("input");
        hueInp.type          = "number";
        hueInp.className     = "hue-input";
        hueInp.min           = -180;
        hueInp.max           = 180;
        hueInp.value         = videoState ? (videoState.hue || 0) : 0;
        hueInp.dataset.layer = layerIdx;
        hueInp.dataset.row   = iter;
        hueInp.title         = "Hue shift (degrees)";
        row.appendChild(hueInp);

        // Sample button
        var pb = document.createElement("button");
        pb.className = "sample-btn";
        pb.title     = "Capture current AE values into this row";
        pb.innerHTML = "&#8592;";
        pb.dataset.layer = layerIdx;
        pb.dataset.row   = iter;
        (function (ri, li, el) {
            el.addEventListener("click", function () {
                if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }
                sampleRow(ri, li, el);
            });
        })(iter, layerIdx, pb);
        row.appendChild(pb);

        return row;
    }

    function buildMediaRow(iter, layerIdx, showVarName) {
        var row = document.createElement("div");
        row.className = "iter-row";
        row.appendChild(makeIterNum(iter));

        if (showVarName) {
            var ni = document.createElement("input");
            ni.type        = "text";
            ni.className   = "var-name-input";
            ni.placeholder = "Name " + (iter + 1);
            ni.dataset.row = iter;
            row.appendChild(ni);
        }

        var browseBtn = document.createElement("button");
        browseBtn.className     = "media-browse-btn";
        browseBtn.textContent   = "Browse…";
        browseBtn.dataset.layer = layerIdx;
        browseBtn.dataset.row   = iter;

        var fileLabel = document.createElement("span");
        fileLabel.className     = "media-file-label";
        fileLabel.textContent   = "No file";
        fileLabel.dataset.layer = layerIdx;
        fileLabel.dataset.row   = iter;

        (function (fl) {
            browseBtn.addEventListener("click", function () {
                cs.evalScript("browseForMedia()", function (result) {
                    try {
                        var res = JSON.parse(result);
                        if (res.path) {
                            fl.dataset.mediaPath = res.path;
                            fl.textContent = res.path.split("/").pop();
                        }
                    } catch (e) {}
                });
            });
        })(fileLabel);

        row.appendChild(browseBtn);
        row.appendChild(fileLabel);
        return row;
    }

    function buildRowForLayer(iter, layerIdx, lInfo, showVarName) {
        if (lInfo && lInfo.type === "video") {
            if (showVarName) {
                return buildMediaRow(iter, layerIdx, showVarName);
            }
            return buildVideoRow(iter, layerIdx, lInfo.videoState, showVarName);
        }
        return buildColorRow(iter, layerIdx, lInfo, showVarName);
    }

    function rebuildMainRows() {
        var mainRows = document.getElementById("main-rows");
        mainRows.innerHTML = "";
        var lInfo = layerInfo ? layerInfo.layers[0] : null;
        for (var i = 0; i < getCount(); i++) {
            mainRows.appendChild(buildRowForLayer(i, 0, lInfo, currentMode === "var"));
        }
        var isVideo = lInfo && lInfo.type === "video";
        if (colLabel) colLabel.textContent = isVideo ? "Effects" : "Color";
    }

    // Build default color rows on load
    rebuildMainRows();

    // Emoji section is visible by default (ITR is default mode)
    emojiSection.classList.remove("hidden");

    // ── Mode switching ────────────────────────────────────────────────────────

    function switchMode(mode) {
        currentMode = mode;
        tabItr.classList.toggle("active", mode === "itr");
        tabVar.classList.toggle("active", mode === "var");
        sameAllSection.classList.toggle("hidden", mode === "var" || !layerInfo || layerInfo.layers.length <= 1);
        document.getElementById("preset-section").classList.toggle("hidden", mode === "var");
        btnRun.textContent = mode === "var" ? "Run VAR" : "Run Iterations";
        emojiSection.classList.toggle("hidden", mode !== "itr");
        applyLayerTypes(layerInfo ? layerInfo.layers : []);
        rebuildMainRows();
        rebuildExtraLayers();
    }

    tabItr.addEventListener("click", function () { switchMode("itr"); });
    tabVar.addEventListener("click", function () { switchMode("var"); });

    // ── Layer-type-aware UI ───────────────────────────────────────────────────
    // Shows/hides font inputs based on whether any selected layer is a text layer.

    function applyLayerTypes(layers) {
        var hasText  = false;
        var hasVideo = layers.length > 0 && layers[0].type === "video";
        for (var i = 0; i < layers.length; i++) {
            if (layers[i].type === "text") { hasText = true; break; }
        }
        fontSection.classList.toggle("hidden", !hasText || hasVideo);
        if (!hasVideo && colLabel) colLabel.textContent = hasText ? "Color & Font" : "Color";
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
        sameAllSection.classList.toggle("hidden", !multi || currentMode === "var");
        if (!multi) sameForAllChk.checked = true;

        rebuildMainRows();
        applyLayerTypes(info.layers);
        rebuildExtraLayers();

    }

    // ── "Same for all" checkbox ───────────────────────────────────────────────

    sameForAllChk.addEventListener("change", function () { rebuildExtraLayers(); });

    // ── Row builder helper ────────────────────────────────────────────────────

    function buildIterRows(lInfo, li, showFont) {
        var rows = [];
        for (var iter = 0; iter < getCount(); iter++) {
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

                var ci = document.createElement("input");
                ci.type          = "text";
                ci.className     = "content-input";
                ci.placeholder   = "Text content";
                ci.dataset.layer = li;
                ci.dataset.row   = iter;
                if (lInfo.text) ci.value = lInfo.text;
                row.appendChild(ci);
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

        for (var r = 0; r < getCount(); r++) sec.appendChild(buildRowForLayer(r, li, lInfo));
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

            for (var r2 = 0; r2 < getCount(); r2++) group.appendChild(buildRowForLayer(r2, li2, lInfo2, false));

            extraLayersSection.appendChild(group);
            containers[lInfo2.index] = group;
        }
    }

    // ── Per-iteration preview ─────────────────────────────────────────────────

    var _activePreviewNum = null;

    function previewIteration(iter) {
        if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }

        var numLayers  = layerInfo.layers.length;
        var sameForAll = numLayers === 1 || sameForAllChk.checked;

        var v0 = readRowValue(0, iter);
        if (!v0) return;

        var value = [v0];
        if (!sameForAll) {
            for (var li = 1; li < numLayers; li++) {
                var vli = readRowValue(li, iter);
                if (!vli) return;
                value.push(vli);
            }
        } else {
            for (var li2 = 1; li2 < numLayers; li2++) {
                var layer2 = layerInfo.layers[li2];
                if (layer2.type === "stroke" || layer2.type === "video") {
                    var vOwn = readRowValue(li2, iter);
                    if (!vOwn) return;
                    value.push(vOwn);
                } else {
                    value.push({ color: v0.color, font: layer2.type === "text" ? v0.font : null });
                }
            }
        }

        var cfg = { compName: layerInfo.compName, layers: buildLayers(), value: value };

        // Highlight the active iteration number across all groups
        document.querySelectorAll(".iter-num").forEach(function (el) {
            el.classList.toggle("active", parseInt(el.dataset.iter, 10) === iter);
        });
        _activePreviewNum = iter;

        btnRun.disabled = btnRefresh.disabled = true;
        setStatus("Previewing iteration " + (iter + 1) + "…");
        debugLog.classList.add("hidden");

        cs.evalScript(
            "debugApplyChangeJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")",
            function (result) {
                btnRun.disabled = btnRefresh.disabled = false;
                try {
                    var res = JSON.parse(result);
                    if (res.error) { setStatus("Preview failed: " + res.error, true); }
                    else           { setStatus("Iteration " + (iter + 1) + " previewed — Ctrl+Z to undo", false, true); }
                } catch (e) { setStatus("Unexpected: " + result, true); }
            }
        );
    }

    // ── Unified value reading ─────────────────────────────────────────────────

    function readVideoRowValue(layerIdx, iter) {
        var q = function (sel) { return document.querySelector(sel + '[data-layer="' + layerIdx + '"][data-row="' + iter + '"]'); };
        var flipBtn = q('.video-toggle[data-prop="flip"]');
        var bwBtn   = q('.video-toggle[data-prop="bw"]');
        var tintChk = q('.tint-check');
        var tintClr = q('.tint-pick');
        var tintAmt = q('.tint-amount');
        var hueInp  = q('.hue-input');
        var hasTint = tintChk && tintChk.checked && tintClr;
        return {
            flip:       flipBtn ? flipBtn.classList.contains("active") : false,
            bw:         bwBtn   ? bwBtn.classList.contains("active")   : false,
            tint:       hasTint ? hexToRgb(tintClr.value) : null,
            tintAmount: hasTint && tintAmt ? (parseInt(tintAmt.value, 10) || 50) : 50,
            hue:        hueInp  ? (parseInt(hueInp.value, 10) || 0)   : 0
        };
    }

    function readColorRowValue(layerIdx, iter, lInfo) {
        var hiEl = document.querySelector('.hex-input[data-layer="' + layerIdx + '"][data-row="' + iter + '"]');
        var hex  = hiEl ? normaliseHex(hiEl.value) : null;
        if (!hex) { setStatus("Layer " + (layerIdx + 1) + " row " + (iter + 1) + ": invalid hex.", true); return null; }
        var font = null;
        var content = null;
        if (lInfo && lInfo.type === "text") {
            var fiEl = document.querySelector('.font-input[data-layer="' + layerIdx + '"][data-row="' + iter + '"]');
            font = fiEl ? fiEl.value.trim() || null : null;
            var ciEl = document.querySelector('.content-input[data-layer="' + layerIdx + '"][data-row="' + iter + '"]');
            content = ciEl ? ciEl.value.trim() || null : null;
        }
        return { color: hexToRgb(hex), font: font, content: content };
    }

    function readMediaRowValue(layerIdx, iter) {
        var fl = document.querySelector('.media-file-label[data-layer="' + layerIdx + '"][data-row="' + iter + '"]');
        return { mediaPath: fl && fl.dataset.mediaPath ? fl.dataset.mediaPath : null };
    }

    function readRowValue(layerIdx, iter) {
        var lInfo = layerInfo.layers[layerIdx];
        if (lInfo.type === "video") {
            if (currentMode === "var") return readMediaRowValue(layerIdx, iter);
            return readVideoRowValue(layerIdx, iter);
        }
        return readColorRowValue(layerIdx, iter, lInfo);
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
            var layerType = li.type;
            if (li.type === "video" && currentMode === "var") layerType = "media";
            cfgLayers.push({ index: li.index, name: li.name, fillPath: fillPath, layerType: layerType });
        }
        return cfgLayers;
    }

    // ── Build cfg.values ──────────────────────────────────────────────────────

    function buildValues() {
        var numLayers  = layerInfo.layers.length;
        var sameForAll = numLayers === 1 || sameForAllChk.checked;
        var result     = [];

        for (var iter = 0; iter < getCount(); iter++) {
            var v0 = readRowValue(0, iter);
            if (!v0) return null;

            var iterVals = [v0];

            if (!sameForAll) {
                for (var li = 1; li < numLayers; li++) {
                    var vli = readRowValue(li, iter);
                    if (!vli) return null;
                    iterVals.push(vli);
                }
            } else {
                for (var li2 = 1; li2 < numLayers; li2++) {
                    var layer2 = layerInfo.layers[li2];
                    // Strokes and video layers always use their own row values
                    if (layer2.type === "stroke" || layer2.type === "video") {
                        var vOwn = readRowValue(li2, iter);
                        if (!vOwn) return null;
                        iterVals.push(vOwn);
                    } else {
                        iterVals.push({
                            color: v0.color,
                            font:  layer2.type === "text" ? v0.font : null
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

    function fillRowFromSample(iter, layerIdx, fresh) {
        var q = function (sel) {
            return document.querySelector(sel + '[data-layer="' + layerIdx + '"][data-row="' + iter + '"]');
        };

        if (fresh.videoState) {
            var vs = fresh.videoState;
            var flipBtn = q('.video-toggle[data-prop="flip"]');
            var bwBtn   = q('.video-toggle[data-prop="bw"]');
            var tintChk = q('.tint-check');
            var tintClr = q('.tint-pick');
            var hueInp  = q('.hue-input');
            if (flipBtn) flipBtn.classList.toggle("active", !!vs.flip);
            if (bwBtn)   bwBtn.classList.toggle("active",   !!vs.bw);
            var tintAmt2 = q('.tint-amount');
            if (tintChk)  { tintChk.checked = !!vs.tint; }
            if (tintClr)  { tintClr.disabled = !vs.tint; if (vs.tint) tintClr.value = rgbToHex(vs.tint).toLowerCase(); }
            if (tintAmt2) { tintAmt2.disabled = !vs.tint; if (vs.tintAmount !== undefined) tintAmt2.value = vs.tintAmount; }
            if (hueInp)   hueInp.value = vs.hue || 0;
        } else {
            var hex;
            if (fresh.fills && fresh.fills.length) hex = rgbToHex(fresh.fills[0].color).toUpperCase();
            else if (fresh.color)                  hex = rgbToHex(fresh.color).toUpperCase();
            if (hex) {
                var cp = q(".color-pick"), hi = q(".hex-input");
                if (cp) cp.value = hex.toLowerCase();
                if (hi) hi.value = hex;
            }
            if (fresh.font) {
                var fi = q(".font-input");
                if (fi) fi.value = fresh.font;
            }
            if (fresh.text !== undefined) {
                var ci2 = q(".content-input");
                if (ci2) ci2.value = fresh.text;
            }
        }
    }

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
                    if (fresh.color)      target.color      = fresh.color;
                    if (fresh.font)       target.font       = fresh.font;
                    if (fresh.fills)      target.fills      = fresh.fills;
                    if (fresh.videoState) target.videoState = fresh.videoState;
                    fillRowFromSample(iter, layerIdx, fresh);
                    setStatus("Row " + (iter + 1) + " captured from AE", false, true);
                } catch (e) { setStatus("Parse error: " + e.message, true); }
            }
        );
    }

    // ── Run iterations ────────────────────────────────────────────────────────

    function readVarNames() {
        var names = [];
        for (var i = 0; i < getCount(); i++) {
            var inp = document.querySelector('.var-name-input[data-row="' + i + '"]');
            names.push(inp ? inp.value.trim() || ("VAR" + (i + 1)) : ("VAR" + (i + 1)));
        }
        return names;
    }

    btnRun.addEventListener("click", function () {
        var emojiOnlyMode = currentMode === "itr" && emojiEnabled.checked;
        if (!layerInfo && !emojiOnlyMode) { setStatus("Refresh a layer first.", true); return; }
        if (currentMode === "var") {
            runVar();
        } else {
            runItr();
        }
    });

    // ── Emoji section — per-iteration pickers ────────────────────────────────

    var _emojiGridLoaded = false;
    var _activeEmojiIter = null;   // which row's picker is open

    emojiEnabled.addEventListener("change", function () {
        var on = this.checked;
        emojiConfig.classList.toggle("hidden", !on);
        if (on && !layerInfo) btnRun.disabled = false;
        if (!on && !layerInfo) btnRun.disabled = true;
    });

    // Load emoji file list once, populate the shared grid
    function _loadEmojiGrid() {
        if (_emojiGridLoaded) return;
        _emojiGridLoaded = true;
        var grid = document.getElementById("emoji-picker-grid");
        grid.innerHTML = "";
        try {
            var fs      = require("fs");
            var extPath = cs.getSystemPath(SystemPath.EXTENSION);
            var dir     = extPath + "/emojis";
            var files   = fs.readdirSync(dir).sort();
            var imgExts = [".gif", ".png", ".jpg", ".jpeg", ".webp"];
            var found   = 0;
            files.forEach(function (filename) {
                var ext = filename.toLowerCase().slice(filename.lastIndexOf("."));
                if (imgExts.indexOf(ext) === -1) return;
                found++;
                var fullPath = dir + "/" + filename;
                var item = document.createElement("div");
                item.className    = "emoji-grid-item";
                item.title        = filename.replace(/\.[^.]+$/, "");
                item.dataset.path = fullPath;
                item.dataset.name = filename;
                var img = document.createElement("img");
                img.src = "file://" + fullPath;
                item.appendChild(img);
                item.addEventListener("click", function () {
                    // Highlight in grid
                    var prev = grid.querySelector(".emoji-grid-item.selected");
                    if (prev) prev.classList.remove("selected");
                    this.classList.add("selected");
                    // Update the active row
                    if (_activeEmojiIter !== null) {
                        _setRowEmoji(_activeEmojiIter, fullPath, filename);
                    }
                    grid.classList.add("hidden");
                    _activeEmojiIter = null;
                });
                grid.appendChild(item);
            });
            if (!found) {
                var msg = document.createElement("div");
                msg.className   = "emoji-empty";
                msg.textContent = "No emoji files found in extension/emojis/";
                grid.appendChild(msg);
            }
        } catch (e) {
            var msg2 = document.createElement("div");
            msg2.className   = "emoji-empty";
            msg2.textContent = "emojis/ folder not found.";
            grid.appendChild(msg2);
        }
    }

    function _setRowEmoji(iterIdx, path, filename) {
        var row   = document.querySelector(".emoji-iter-row[data-iter='" + iterIdx + "']");
        if (!row) return;
        row.dataset.emojiPath = path;
        var thumb = row.querySelector(".emoji-iter-thumb");
        var name  = row.querySelector(".emoji-iter-name");
        if (thumb) {
            thumb.innerHTML = "";
            thumb.classList.add("has-emoji");
            var img = document.createElement("img");
            img.src = "file://" + path;
            thumb.appendChild(img);
        }
        if (name) name.textContent = filename.replace(/\.[^.]+$/, "");
    }

    function _buildEmojiIterRows() {
        var container = document.getElementById("emoji-iter-rows");
        if (!container) return;
        container.innerHTML = "";
        var grid = document.getElementById("emoji-picker-grid");

        for (var i = 0; i < getCount(); i++) {
            var row   = document.createElement("div");
            row.className    = "emoji-iter-row";
            row.dataset.iter = i;

            var num = document.createElement("span");
            num.className   = "emoji-iter-num";
            num.textContent = i + 1;

            var thumb = document.createElement("div");
            thumb.className = "emoji-iter-thumb";
            thumb.innerHTML = "+";

            var nameEl = document.createElement("span");
            nameEl.className   = "emoji-iter-name";
            nameEl.textContent = "No emoji";

            (function (rowEl, thumbEl, iterIdx) {
                thumbEl.addEventListener("click", function () {
                    _loadEmojiGrid();
                    var isOpen = !grid.classList.contains("hidden") && _activeEmojiIter === iterIdx;
                    // Close picker
                    grid.classList.add("hidden");
                    if (!isOpen) {
                        _activeEmojiIter = iterIdx;
                        // Insert grid right after this row
                        rowEl.parentNode.insertBefore(grid, rowEl.nextSibling);
                        // Sync selection state
                        var curPath = rowEl.dataset.emojiPath || "";
                        document.querySelectorAll(".emoji-grid-item").forEach(function (el) {
                            el.classList.toggle("selected", el.dataset.path === curPath);
                        });
                        grid.classList.remove("hidden");
                    } else {
                        _activeEmojiIter = null;
                    }
                });
            })(row, thumb, i);

            row.appendChild(num);
            row.appendChild(thumb);
            row.appendChild(nameEl);
            container.appendChild(row);
        }
    }

    _buildEmojiIterRows();

    document.getElementById("btn-emoji-preview").addEventListener("click", function () {
        var firstPath = "";
        for (var i = 0; i < getCount(); i++) {
            var row = document.querySelector(".emoji-iter-row[data-iter='" + i + "']");
            if (row && row.dataset.emojiPath) { firstPath = row.dataset.emojiPath; break; }
        }
        if (!firstPath) { setStatus("Select an emoji first.", true); return; }
        var cfg = {
            emojiPath:  firstPath,
            x:          parseInt(document.getElementById("emoji-x").value,           10) || 540,
            y:          parseInt(document.getElementById("emoji-y").value,           10) || 1347,
            size:       parseInt(document.getElementById("emoji-size").value,        10) || 100,
            layerIndex: parseInt(document.getElementById("emoji-layer-index").value, 10) || 1
        };
        btnRun.disabled = true;
        setStatus("Previewing emoji…");
        cs.evalScript("previewEmojiJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")", function (result) {
            btnRun.disabled = false;
            try {
                var res = JSON.parse(result);
                if (res.error) { setStatus("Preview failed: " + res.error, true); }
                else           { setStatus("Emoji previewed in " + res.compName + " — Ctrl+Z to undo", false, true); }
            } catch (e) { setStatus("Unexpected: " + result, true); }
        });
    });

    function buildEmojiCfg() {
        if (!emojiEnabled.checked) return { enabled: false };
        var paths = [];
        for (var i = 0; i < getCount(); i++) {
            var row = document.querySelector(".emoji-iter-row[data-iter='" + i + "']");
            paths.push(row && row.dataset.emojiPath ? row.dataset.emojiPath : "");
        }
        return {
            enabled:      true,
            perIteration: paths,
            x:          parseInt(document.getElementById("emoji-x").value,           10) || 540,
            y:          parseInt(document.getElementById("emoji-y").value,           10) || 1347,
            size:       parseInt(document.getElementById("emoji-size").value,        10) || 100,
            layerIndex: parseInt(document.getElementById("emoji-layer-index").value, 10) || 1
        };
    }

    function runItr() {
        // Emoji-only mode: no layer selected, just add emojis
        var values = layerInfo ? buildValues() : [[], [], [], [], []];
        if (layerInfo && !values) return;
        var cfg = {
            compName: layerInfo ? layerInfo.compName : "",
            layers:   layerInfo ? buildLayers() : [],
            values:   values,
            emoji:    buildEmojiCfg(),
            count:    getCount()
        };
        btnRun.disabled = btnRefresh.disabled = true;
        setStatus("Running…");
        debugLog.classList.add("hidden");
        cs.evalScript("runIterationsJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")", function (result) {
            btnRun.disabled = btnRefresh.disabled = false;
            try {
                var res = JSON.parse(result);
                if (res.error) { setStatus(res.error, true); showDebugLog([res.error]); }
                else if (res.warnings && res.warnings.length) { setStatus("Done with warnings — see log below", false, true); showDebugLog(res.warnings); }
                else { setStatus("Done — " + getCount() + " iterations complete.", false, true); }
            } catch (e) { setStatus("Unexpected response", true); showDebugLog([result]); }
        });
    }

    function runVar() {
        var values = buildValues();
        if (!values) return;
        var varNames = readVarNames();
        var cfg = { compName: layerInfo.compName, layers: buildLayers(), values: values, varNames: varNames, count: getCount() };
        btnRun.disabled = btnRefresh.disabled = true;
        setStatus("Running VAR…");
        debugLog.classList.add("hidden");
        cs.evalScript("runVarIterationsJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")", function (result) {
            btnRun.disabled = btnRefresh.disabled = false;
            try {
                var res = JSON.parse(result);
                var logLines = res.log || [];
                if (res.error) {
                    setStatus(res.error, true);
                    showDebugLog([res.error].concat(logLines));
                } else if (res.warnings && res.warnings.length) {
                    setStatus("Done with warnings — see log below", false, true);
                    showDebugLog(logLines.concat(["", "--- Warnings ---"].concat(res.warnings)));
                } else {
                    setStatus("Done — " + getCount() + " VAR variants complete.", false, true);
                    showDebugLog(logLines);
                }
            } catch (e) { setStatus("Unexpected response", true); showDebugLog([result]); }
        });
    }

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

    function copyDirSync(src, dest) {
        var fs   = require("fs");
        var path = require("path");
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(function (entry) {
            var s = path.join(src, entry);
            var d = path.join(dest, entry);
            var stat = fs.lstatSync(s);
            if (stat.isSymbolicLink()) return;
            if (stat.isDirectory()) copyDirSync(s, d);
            else fs.copyFileSync(s, d);
        });
    }

    function installUpdate(release) {
        var asset = null;
        for (var i = 0; i < release.assets.length; i++) {
            if (release.assets[i].name === "AE-Iterations.zip") { asset = release.assets[i]; break; }
        }
        if (!asset) { setStatus("Update asset not found in release.", true); return; }

        document.getElementById("update-banner").classList.add("hidden");
        setStatus("Downloading " + release.tag_name + "…");

        var os   = require("os");
        var path = require("path");
        var tmpZip = path.join(os.tmpdir(), "AE-Iterations-update.zip");
        var tmpDir = path.join(os.tmpdir(), "ae-iterations-update");

        downloadFile(asset.browser_download_url, tmpZip, function (err) {
            if (err) { setStatus("Download failed: " + err, true); return; }
            setStatus("Installing…");
            try {
                var cp = require("child_process");
                var fs = require("fs");

                // Remove previous extraction dir if present
                if (fs.existsSync(tmpDir)) {
                    cp.execSync(
                        process.platform === "win32"
                            ? "rmdir /s /q \"" + tmpDir + "\""
                            : "rm -rf '" + tmpDir + "'"
                    );
                }

                // Extract zip — platform-aware
                if (process.platform === "win32") {
                    cp.execFileSync("powershell", [
                        "-NoProfile", "-NonInteractive", "-Command",
                        "Expand-Archive -LiteralPath '" + tmpZip.replace(/'/g, "''") + "' -DestinationPath '" + tmpDir.replace(/'/g, "''") + "' -Force"
                    ]);
                } else {
                    cp.execSync("unzip -o '" + tmpZip + "' -d '" + tmpDir + "'");
                }
            } catch (e) { setStatus("Extraction failed: " + e.message, true); return; }

            try {
                var cepDest = process.platform === "win32"
                    ? path.join(process.env.APPDATA, "Adobe", "CEP", "extensions", "com.aeiter.iteration")
                    : path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions", "com.aeiter.iteration");

                var srcExtension = path.join(tmpDir, "extension");
                copyDirSync(srcExtension, cepDest);
                setStatus("Updated to " + release.tag_name + " — restart After Effects.", false, true);
            } catch (e) { setStatus("Copy failed — restart AE and try again: " + e.message, true); }
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

    function isVideoMode() {
        return layerInfo && layerInfo.layers[0] && layerInfo.layers[0].type === "video";
    }

    function applyColorPreset(colors) {
        for (var i = 0; i < Math.min(getCount(), colors.length); i++) {
            var hex = normaliseHex(colors[i]);
            if (!hex) continue;
            var cp = document.querySelector('.color-pick[data-layer="0"][data-row="' + i + '"]');
            var hi = document.querySelector('.hex-input[data-layer="0"][data-row="' + i + '"]');
            if (cp) cp.value = hex.toLowerCase();
            if (hi) hi.value = hex.toUpperCase();
        }
    }

    function applyVideoPreset(iterations) {
        for (var i = 0; i < Math.min(getCount(), iterations.length); i++) {
            var it  = iterations[i] || {};
            var q   = function (sel, row) { return document.querySelector(sel + '[data-layer="0"][data-row="' + row + '"]'); };
            var fb  = q('.video-toggle[data-prop="flip"]', i);
            var bb  = q('.video-toggle[data-prop="bw"]',   i);
            var tc  = q('.tint-check', i);
            var tp  = q('.tint-pick',  i);
            var hi2 = q('.hue-input',  i);
            if (fb)  fb.classList.toggle("active", !!it.flip);
            if (bb)  bb.classList.toggle("active", !!it.bw);
            var ta  = q('.tint-amount', i);
            if (tc)  tc.checked = !!it.tint;
            if (tp)  { tp.disabled = !it.tint; if (it.tint) tp.value = it.tint.toLowerCase(); }
            if (ta)  { ta.disabled = !it.tint; ta.value = it.tintAmount !== undefined ? it.tintAmount : 50; }
            if (hi2) hi2.value = it.hue || 0;
        }
    }

    function applyPreset(preset) {
        if (preset.type === "video") applyVideoPreset(preset.iterations);
        else applyColorPreset(preset.colors);
    }

    function buildColorSwatches(colors) {
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

    function buildVideoSwatches(iterations) {
        var wrap = document.createElement("div");
        wrap.className = "preset-swatches";
        iterations.forEach(function (it) {
            var s = document.createElement("div");
            s.className = "preset-swatch";
            s.style.background = it.tint || (it.bw ? "#555" : "#333");
            s.title = [it.flip?"↔":"", it.bw?"B&W":"", it.tint?"tint":"", it.hue?"hue":""].filter(Boolean).join(" ") || "normal";
            wrap.appendChild(s);
        });
        return wrap;
    }

    function getCurrentPreset() {
        if (isVideoMode()) {
            var iters = [];
            for (var i = 0; i < getCount(); i++) iters.push(readVideoRowValue(0, i));
            return { type: "video", iterations: iters.map(function(v) {
                return { flip: v.flip, bw: v.bw, tint: v.tint ? rgbToHex(v.tint) : null, hue: v.hue };
            })};
        }
        var colors = [];
        for (var j = 0; j < getCount(); j++) {
            var hi = document.querySelector('.hex-input[data-layer="0"][data-row="' + j + '"]');
            colors.push(hi ? hi.value : "#FF0000");
        }
        return { colors: colors };
    }

    function renderPresetList() {
        var list = document.getElementById("preset-list");
        list.innerHTML = "";
        var video      = isVideoMode();
        var userPresets = loadUserPresets().filter(function (p) {
            return video ? p.type === "video" : p.type !== "video";
        });

        var libPresets = getLibraryPresets().filter(function (p) {
            return video ? p.type === "video" : p.type !== "video";
        });

        function makeItem(preset, isUser, idx) {
            var item = document.createElement("div");
            item.className = "preset-item";

            item.appendChild(preset.type === "video"
                ? buildVideoSwatches(preset.iterations)
                : buildColorSwatches(preset.colors));

            var name = document.createElement("span");
            name.className   = "preset-name";
            name.textContent = preset.name;
            item.appendChild(name);

            var applyBtn = document.createElement("button");
            applyBtn.className   = "preset-apply";
            applyBtn.textContent = "Apply";
            applyBtn.addEventListener("click", function () { applyPreset(preset); });
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
        libPresets.forEach(function (p) { list.appendChild(makeItem(p, false, -1)); });
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
        var preset   = getCurrentPreset();
        preset.name  = name;
        var up = loadUserPresets();
        up.unshift(preset);
        saveUserPresets(up);
        presetNameIn.value = "";
        renderPresetList();
    });

    // ── Changelog ─────────────────────────────────────────────────────────────

    var btnChangelog    = document.getElementById("btn-changelog");
    var changelogSection = document.getElementById("changelog-section");
    var changelogList   = document.getElementById("changelog-list");

    function loadChangelog() {
        try {
            var fs      = require("fs");
            var path    = require("path");
            var extPath = cs.getSystemPath(SystemPath.EXTENSION);
            var clPath  = path.join(extPath, "changelog.json");
            return JSON.parse(fs.readFileSync(clPath, "utf8"));
        } catch (e) { return []; }
    }

    function renderChangelog() {
        changelogList.innerHTML = "";
        var entries = loadChangelog();
        entries.forEach(function (entry) {
            var div = document.createElement("div");
            div.className = "cl-entry";

            var header = document.createElement("div");
            header.className = "cl-header";

            var ver = document.createElement("span");
            ver.className   = "cl-version";
            ver.textContent = "v" + entry.version;

            var date = document.createElement("span");
            date.className   = "cl-date";
            date.textContent = entry.date;

            header.appendChild(ver);
            header.appendChild(date);
            div.appendChild(header);

            var ul = document.createElement("ul");
            ul.className = "cl-changes";
            (entry.changes || []).forEach(function (c) {
                var li = document.createElement("li");
                li.textContent = c;
                ul.appendChild(li);
            });
            div.appendChild(ul);
            changelogList.appendChild(div);
        });
    }

    btnChangelog.addEventListener("click", function () {
        var open = changelogSection.classList.toggle("hidden");
        btnChangelog.classList.toggle("open", !open);
        if (!open) renderChangelog();
    });

    // ── Init ──────────────────────────────────────────────────────────────────

    document.getElementById("iter-count").addEventListener("change", function () {
        rebuildMainRows();
        rebuildExtraLayers();
        // Preserve existing emoji assignments across the rebuild
        var savedEmoji = {};
        document.querySelectorAll(".emoji-iter-row").forEach(function (row) {
            if (row.dataset.emojiPath) savedEmoji[row.dataset.iter] = {
                path: row.dataset.emojiPath,
                name: (row.dataset.emojiPath.split("/").pop() || "").replace(/\.[^.]+$/, "")
            };
        });
        _emojiGridLoaded = false;
        _buildEmojiIterRows();
        Object.keys(savedEmoji).forEach(function (idx) {
            var e = savedEmoji[idx];
            _setRowEmoji(parseInt(idx, 10), e.path, e.name);
        });
    });

    applyLayerTypes([]); // default: shape-only view (no font inputs)
    loadFonts();
    checkForUpdates();

})();
