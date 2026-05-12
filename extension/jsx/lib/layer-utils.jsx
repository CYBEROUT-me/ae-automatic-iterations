// lib/layer-utils.jsx — layer type detection, fill collection, ITR comp finder

var ITR_SUFFIXES = ["ITR_9x16", "ITR_1x1", "ITR_16x9"];

function getLayerType(layer) {
    if (layer instanceof ShapeLayer) return "shape";
    if (layer instanceof TextLayer)  return "text";
    return "unknown";
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
