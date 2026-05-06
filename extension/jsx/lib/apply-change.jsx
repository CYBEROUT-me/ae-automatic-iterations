// lib/apply-change.jsx — color and font application

function applyChange(layer, cfg) {
    if (cfg.changeType === "shapeColor") return applyShapeColor(layer, cfg.fillPath, cfg.value);
    if (cfg.changeType === "textColor")  return applyTextColor(layer, cfg.value);
    if (cfg.changeType === "textFont")   return applyTextFont(layer, cfg.value);
    return false;
}

function applyShapeColor(layer, fillPath, colorRGB) {
    var parts = fillPath.split("/"), current = layer;
    try {
        for (var i = 0; i < parts.length; i++) {
            current = current.property(parts[i]);
            if (!current) throw new Error("null at step " + i + " («" + parts[i] + "»)");
        }
        current.property("Color").setValue(colorRGB);
        return true;
    } catch (e) { return false; }
}

// Primary: TextStyle API (AE 2022+).
//   textDoc.createStyle().setFillColor(color).applyToAllKeyframes()
//   — works regardless of whether "Source Text" has keyframes, and never
//     triggers the "must select keyframes to export" dialog.
// Fallback: modify each keyframe directly, or setValue for static text.
function applyTextColor(layer, colorRGB) {
    var textProp = layer.property("Source Text");
    try {
        var textDoc = textProp.value;
        textDoc.createStyle().setFillColor(colorRGB).applyToAllKeyframes();
        return true;
    } catch (e) {}

    // Fallback
    try {
        if (textProp.numKeys > 0) {
            for (var k = 1; k <= textProp.numKeys; k++) {
                var kDoc = textProp.keyValue(k);
                kDoc.applyFill = true;
                kDoc.fillColor = colorRGB;
                textProp.setValueAtTime(textProp.keyTime(k), kDoc);
            }
        } else {
            var textDoc2 = textProp.value;
            textDoc2.applyFill = true;
            textDoc2.fillColor = colorRGB;
            textProp.setValue(textDoc2);
        }
        return true;
    } catch (e2) { return false; }
}

// Same pattern for font — setFont(postScriptName) on the TextStyle chain.
function applyTextFont(layer, fontName) {
    var textProp = layer.property("Source Text");
    try {
        var textDoc = textProp.value;
        textDoc.createStyle().setFont(fontName).applyToAllKeyframes();
        return true;
    } catch (e) {}

    // Fallback
    try {
        if (textProp.numKeys > 0) {
            for (var k = 1; k <= textProp.numKeys; k++) {
                var kDoc = textProp.keyValue(k);
                kDoc.font = fontName;
                textProp.setValueAtTime(textProp.keyTime(k), kDoc);
            }
        } else {
            var textDoc2 = textProp.value;
            textDoc2.font = fontName;
            textProp.setValue(textDoc2);
        }
        return true;
    } catch (e2) { return false; }
}
