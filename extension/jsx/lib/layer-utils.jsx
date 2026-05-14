// lib/layer-utils.jsx — layer type detection, fill collection, ITR comp finder

var ITR_SUFFIXES = ["ITR_9x16", "ITR_1x1", "ITR_16x9"];

function getLayerType(layer) {
    if (layer instanceof ShapeLayer) return "shape";
    if (layer instanceof TextLayer)  return "text";
    if (layer instanceof AVLayer)    return "video";
    return "unknown";
}

function readVideoLayerState(layer) {
    var state = { flip: false, bw: false, tint: null, hue: 0 };
    try {
        var sv = layer.transform.scale.value;
        state.flip = sv[0] < 0;
        for (var i = 1; i <= layer.Effects.numProperties; i++) {
            var eff = layer.Effects.property(i);
            if (eff.matchName === "ADBE HUE SATURATION") {
                state.hue = Math.round(eff.property("Master Hue").value);
                state.bw  = eff.property("Master Saturation").value <= -100;
            }
            if (eff.matchName === "ADBE Tint") {
                var amount = eff.property("Amount to Tint").value;
                if (amount > 0) {
                    var c = eff.property("Map Black To").value;
                    state.tint       = [c[0], c[1], c[2]];
                    state.tintAmount = Math.round(amount);
                }
            }
        }
    } catch (e) {}
    return state;
}

// Returns [{path: "Contents/Group 1/Contents/Fill 1", color: [r,g,b]}, ...]
function collectFills(propGroup, pathSoFar) {
    var fills = [];
    var count;
    try { count = propGroup.numProperties; } catch (e) { return fills; }
    for (var i = 1; i <= count; i++) {
        var prop;
        try { prop = propGroup.property(i); } catch (e) { continue; }
        var propPath = pathSoFar + "/" + prop.name;
        if (prop.matchName === "ADBE Vector Shape - Fill" ||
            prop.matchName === "ADBE Vector Graphic - Fill") {
            try { fills.push({ path: propPath, color: prop.property("Color").value }); } catch (e) {}
        } else if (prop.propertyType !== PropertyType.PROPERTY) {
            var sub = collectFills(prop, propPath);
            for (var s = 0; s < sub.length; s++) fills.push(sub[s]);
        }
    }
    return fills;
}

// Returns [{path: "Contents/Group 1/Contents/Stroke 1", color: [r,g,b]}, ...]
function collectStrokes(propGroup, pathSoFar) {
    var strokes = [];
    var count;
    try { count = propGroup.numProperties; } catch (e) { return strokes; }
    for (var i = 1; i <= count; i++) {
        var prop;
        try { prop = propGroup.property(i); } catch (e) { continue; }
        var propPath = pathSoFar + "/" + prop.name;
        if (prop.matchName === "ADBE Vector Shape - Stroke" ||
            prop.matchName === "ADBE Vector Graphic - Stroke") {
            try { strokes.push({ path: propPath, color: prop.property("Color").value }); } catch (e) {}
        } else if (prop.propertyType !== PropertyType.PROPERTY) {
            var sub = collectStrokes(prop, propPath);
            for (var s = 0; s < sub.length; s++) strokes.push(sub[s]);
        }
    }
    return strokes;
}

function findItrComps() {
    var found = {};
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (!(item instanceof CompItem)) continue;
        for (var s = 0; s < ITR_SUFFIXES.length; s++) {
            if (item.name.slice(-ITR_SUFFIXES[s].length) === ITR_SUFFIXES[s])
                found[ITR_SUFFIXES[s]] = item;
        }
    }
    return found;
}
