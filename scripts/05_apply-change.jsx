// 05_apply-change.jsx
// Auto-detects the selected layer type (shape or text) and applies the change.
//
// ── CONFIG — edit these values, then select your layer and run ────────────
var FILL_PATH   = "Contents/Fill 1"; // shape layers only — from 04_read-layers.jsx
var COLOR_VALUE = [1, 0, 0];         // [r, g, b] normalized 0–1  (used for shape & text color)
var FONT_VALUE  = "";                // PostScript font name, e.g. "Arial-BoldMT"
                                     // Leave empty → change color. Set font name → change font.
// ─────────────────────────────────────────────────────────────────────────────

(function main() {

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Відкрий та активуй композицію.");
        return;
    }

    var selected = comp.selectedLayers;
    if (selected.length === 0) {
        alert("Виділи шар: клікни на рядок шару в таймлайні (не на трикутник розгортання).");
        return;
    }

    var layer = selected[0];

    // Detect type BEFORE alert() — alert can invalidate live property refs.
    var isShape = !!layer.property("Contents");
    var isText  = !!layer.property("Source Text");

    alert("Цільовий шар: «" + layer.name + "»  [" + (isShape ? "shape" : isText ? "text" : "?") + "]\n\nЯкщо не той — закрий, виділи правильний і запусти знову.");

    app.beginUndoGroup("Apply Iteration Change");

    var ok = false;
    if (isShape) {
        ok = applyShapeColor(layer, FILL_PATH, COLOR_VALUE);
    } else if (isText) {
        ok = FONT_VALUE ? applyTextFont(layer, FONT_VALUE) : applyTextColor(layer, COLOR_VALUE);
    } else {
        alert("Непідтримуваний тип шару: " + layer.name);
    }

    app.endUndoGroup();

    if (ok) alert("✅ Зміну застосовано до шару «" + layer.name + "».");

})();

// ── Core functions (reused by host.jsx) ─────────────────────────────────────

function applyChange(layer, cfg) {
    if (cfg.changeType === "shapeColor") return applyShapeColor(layer, cfg.fillPath, cfg.value);
    if (cfg.changeType === "textColor")  return applyTextColor(layer, cfg.value);
    if (cfg.changeType === "textFont")   return applyTextFont(layer, cfg.value);
    alert("Невідомий changeType: " + cfg.changeType);
    return false;
}

function applyShapeColor(layer, fillPath, colorRGB) {
    var parts   = fillPath.split("/");
    var current = layer;
    try {
        for (var i = 0; i < parts.length; i++) {
            current = current.property(parts[i]);
            if (!current) throw new Error("null at «" + parts[i] + "»");
        }
        current.property("Color").setValue(colorRGB);
        return true;
    } catch (e) {
        alert("Помилка при зміні кольору shape:\n" + e.message + "\n\nШлях: " + fillPath);
        return false;
    }
}

function applyTextColor(layer, colorRGB) {
    try {
        var textProp = layer.property("Source Text");
        var textDoc  = textProp.value;
        textDoc.applyFill = true;
        textDoc.fillColor = colorRGB;
        textProp.setValue(textDoc);
        return true;
    } catch (e) {
        alert("Помилка при зміні кольору тексту:\n" + e.message);
        return false;
    }
}

function applyTextFont(layer, postScriptFontName) {
    try {
        var textProp = layer.property("Source Text");
        var textDoc  = textProp.value;
        textDoc.font = postScriptFontName;
        textProp.setValue(textDoc);
        return true;
    } catch (e) {
        alert("Помилка при зміні шрифту:\n" + e.message +
              "\nПостскрипт-назва: " + postScriptFontName);
        return false;
    }
}
