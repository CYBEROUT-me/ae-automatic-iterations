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

function applyTextColor(layer, colorRGB) {
    try {
        var textProp = layer.property("Source Text");
        var textDoc  = textProp.value;
        textDoc.applyFill = true;
        textDoc.fillColor = colorRGB;
        textProp.setValue(textDoc);
        return true;
    } catch (e) { return false; }
}

function applyTextFont(layer, fontName) {
    try {
        var textProp = layer.property("Source Text");
        var textDoc  = textProp.value;
        textDoc.font = fontName;
        textProp.setValue(textDoc);
        return true;
    } catch (e) { return false; }
}
