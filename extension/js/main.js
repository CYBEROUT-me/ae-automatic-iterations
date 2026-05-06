(function () {
    "use strict";

    var cs = new CSInterface();

    // ── State ─────────────────────────────────────────────────────────────────

    var layerInfo  = null;   // result of last getLayerInfoJSON call
    var allFonts   = [];     // [{ postScript, family }] loaded once
    var activeFontInput = null;  // which font-input row is focused

    // ── DOM refs ──────────────────────────────────────────────────────────────

    var layerInfoEl  = document.getElementById("layer-info");
    var btnRefresh   = document.getElementById("btn-refresh");
    var changeType   = document.getElementById("change-type");
    var fontSection  = document.getElementById("font-search-section");
    var fontSearch   = document.getElementById("font-search");
    var fontDropdown = document.getElementById("font-dropdown");
    var colLabel     = document.getElementById("col-value-label");
    var btnRun       = document.getElementById("btn-run");
    var btnTest      = document.getElementById("btn-test");
    var statusEl     = document.getElementById("status");
    var debugLog     = document.getElementById("debug-log");

    var rows         = document.querySelectorAll(".iter-row");
    var colorCells   = document.querySelectorAll(".color-cell");
    var colorPicks   = document.querySelectorAll(".color-pick");
    var hexInputs    = document.querySelectorAll(".hex-input");
    var fontInputs   = document.querySelectorAll(".font-input");

    // ── Helper: hex ↔ [r,g,b] ────────────────────────────────────────────────

    function hexToRgb(hex) {
        var r = parseInt(hex.slice(1, 3), 16) / 255;
        var g = parseInt(hex.slice(3, 5), 16) / 255;
        var b = parseInt(hex.slice(5, 7), 16) / 255;
        return [r, g, b];
    }

    function rgbToHex(arr) {
        function c(v) {
            var s = Math.round(v * 255).toString(16);
            return s.length === 1 ? "0" + s : s;
        }
        return "#" + c(arr[0]) + c(arr[1]) + c(arr[2]);
    }

    function normaliseHex(raw) {
        var h = raw.trim();
        if (h[0] !== "#") h = "#" + h;
        if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toUpperCase();
        return null;
    }

    // ── Color-picker ↔ hex text sync ─────────────────────────────────────────

    for (var i = 0; i < 5; i++) {
        (function (idx) {
            colorPicks[idx].addEventListener("input", function () {
                hexInputs[idx].value = this.value.toUpperCase();
            });
            hexInputs[idx].addEventListener("change", function () {
                var h = normaliseHex(this.value);
                if (h) {
                    this.value        = h;
                    colorPicks[idx].value = h.toLowerCase();
                } else {
                    this.value = colorPicks[idx].value.toUpperCase();
                }
            });
        })(i);
    }

    // ── Change-type toggle ────────────────────────────────────────────────────

    function applyChangeType(type) {
        var isFont = type === "textFont";
        colLabel.textContent = isFont ? "Font" : "Color";
        fontSection.classList.toggle("hidden", !isFont);
        for (var j = 0; j < 5; j++) {
            colorCells[j].classList.toggle("hidden", isFont);
            fontInputs[j].classList.toggle("hidden", !isFont);
        }
    }

    changeType.addEventListener("change", function () {
        applyChangeType(this.value);
    });

    // ── Refresh layer ─────────────────────────────────────────────────────────

    btnRefresh.addEventListener("click", function () {
        setStatus("Reading layer…");
        cs.evalScript("getLayerInfoJSON()", function (result) {
            try {
                var info = JSON.parse(result);
                if (info.error) { setStatus(info.error, true); return; }
                layerInfo = info;
                renderLayerInfo(info);
                setStatus("");
                btnRun.disabled  = false;
                btnTest.disabled = false;
                debugLog.classList.add("hidden");
            } catch (e) {
                setStatus("Parse error: " + e.message, true);
            }
        });
    });

    function renderLayerInfo(info) {
        var label = info.name + "  [" + info.type + "]";
        if (info.type === "shape" && info.fills && info.fills.length) {
            label += "  · " + info.fills.length + " fill(s)";
        }
        layerInfoEl.textContent = label;
        layerInfoEl.classList.add("loaded");

        // Pre-fill color rows from current layer values
        if (info.type === "shape" && info.fills && info.fills.length) {
            var col = info.fills[0].color;
            var hex = rgbToHex(col).toUpperCase();
            for (var j = 0; j < 5; j++) {
                colorPicks[j].value  = hex.toLowerCase();
                hexInputs[j].value   = hex;
            }
        } else if (info.type === "text" && info.color) {
            var hex2 = rgbToHex(info.color).toUpperCase();
            for (var k = 0; k < 5; k++) {
                colorPicks[k].value = hex2.toLowerCase();
                hexInputs[k].value  = hex2;
            }
            if (info.font) {
                for (var m = 0; m < 5; m++) fontInputs[m].value = info.font;
                fontSearch.value = info.font;
            }
        }
    }

    // ── Test Apply (debug — no render, no collect) ────────────────────────────

    btnTest.addEventListener("click", function () {
        if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }

        var type = changeType.value;
        var value;
        if (type === "textFont") {
            value = fontInputs[0].value.trim();
            if (!value) { setStatus("Enter a font name in row 1.", true); return; }
        } else {
            var h = normaliseHex(hexInputs[0].value);
            if (!h) { setStatus("Row 1: invalid hex color.", true); return; }
            value = hexToRgb(h);
        }

        var fillPath = "";
        if (type === "shapeColor" && layerInfo.fills && layerInfo.fills.length) {
            fillPath = layerInfo.fills[0].path;
        }

        var cfg = {
            layerIndex: layerInfo.index,
            compName:   layerInfo.compName,
            changeType: type,
            fillPath:   fillPath,
            value:      value
        };

        btnTest.disabled    = true;
        btnRun.disabled     = true;
        btnRefresh.disabled = true;
        setStatus("Testing apply…");
        debugLog.classList.add("hidden");

        cs.evalScript(
            "debugApplyChangeJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")",
            function (result) {
                btnTest.disabled    = false;
                btnRun.disabled     = false;
                btnRefresh.disabled = false;
                try {
                    var res = JSON.parse(result);
                    var lines = res.log || [];
                    if (res.error) {
                        lines.push("ERROR: " + res.error);
                        setStatus("Test failed — see log below", true);
                    } else {
                        setStatus("Test OK — color/font applied (Ctrl+Z to undo)", false, true);
                    }
                    debugLog.textContent = lines.join("\n");
                    debugLog.classList.remove("hidden");
                } catch (e) {
                    setStatus("Unexpected: " + result, true);
                }
            }
        );
    });

    // ── Run iterations ────────────────────────────────────────────────────────

    btnRun.addEventListener("click", function () {
        if (!layerInfo) { setStatus("Refresh a layer first.", true); return; }

        var type = changeType.value;
        var values = [];

        if (type === "textFont") {
            for (var j = 0; j < 5; j++) {
                var v = fontInputs[j].value.trim();
                if (!v) { setStatus("Fill in all 5 font names.", true); return; }
                values.push(v);
            }
        } else {
            for (var k = 0; k < 5; k++) {
                var h = normaliseHex(hexInputs[k].value);
                if (!h) { setStatus("Row " + (k + 1) + ": invalid hex color.", true); return; }
                values.push(hexToRgb(h));
            }
        }

        var fillPath = "";
        if (type === "shapeColor" && layerInfo.fills && layerInfo.fills.length) {
            fillPath = layerInfo.fills[0].path;
        }

        var cfg = {
            layerIndex: layerInfo.index,
            compName:   layerInfo.compName,
            changeType: type,
            fillPath:   fillPath,
            values:     values
        };

        btnRun.disabled  = true;
        btnRefresh.disabled = true;
        setStatus("Running iteration 1 of 5…");

        cs.evalScript(
            "runIterationsJSON(" + JSON.stringify(JSON.stringify(cfg)) + ")",
            function (result) {
                btnRun.disabled     = false;
                btnTest.disabled    = false;
                btnRefresh.disabled = false;
                try {
                    var res = JSON.parse(result);
                    if (res.error) {
                        setStatus(res.error, true);
                    } else if (res.warnings && res.warnings.length) {
                        setStatus("Done with " + res.warnings.length + " warning(s): " + res.warnings[0], false, true);
                    } else {
                        setStatus("Done — 5 iterations complete.", false, true);
                    }
                } catch (e) {
                    setStatus("Unexpected response: " + result, true);
                }
            }
        );
    });

    // ── Status helper ─────────────────────────────────────────────────────────

    function setStatus(msg, isError, isOk) {
        statusEl.textContent = msg;
        statusEl.className   = isError ? "error" : isOk ? "ok" : "";
    }

    // ── Font list (macOS only) ────────────────────────────────────────────────

    function loadFonts() {
        try {
            var cp    = require("child_process");
            var raw   = cp.execSync("system_profiler SPFontsDataType -json", { timeout: 15000 }).toString();
            var data  = JSON.parse(raw);
            var items = data.SPFontsDataType || [];
            var seen  = {};
            allFonts  = [];
            for (var i = 0; i < items.length; i++) {
                var ps = items[i]._name || items[i].postscript_name || "";
                if (ps && !seen[ps]) { seen[ps] = true; allFonts.push(ps); }
            }
            allFonts.sort();
        } catch (e) {
            // Node not available or non-macOS — font list stays empty, manual input still works
            allFonts = [];
        }
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

    fontSearch.addEventListener("input", function () {
        showFontDropdown(this.value);
    });

    fontSearch.addEventListener("blur", function () {
        setTimeout(function () { fontDropdown.classList.add("hidden"); }, 150);
    });

    // Clicking a font input focuses the shared font search bar and copies its value back
    for (var fi = 0; fi < 5; fi++) {
        (function (idx) {
            fontInputs[idx].addEventListener("focus", function () {
                activeFontInput = fontInputs[idx];
                fontSearch.value = this.value;
                fontSearch.focus();
                fontSearch.select();
                if (allFonts.length) showFontDropdown(this.value);
            });
        })(fi);
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    applyChangeType("shapeColor");
    loadFonts();

})();
