// lib/apply-video.jsx — effects-based changes for video/footage layers

function getOrAddEffect(layer, matchName) {
    for (var i = 1; i <= layer.Effects.numProperties; i++) {
        if (layer.Effects.property(i).matchName === matchName)
            return layer.Effects.property(i);
    }
    return layer.Effects.addProperty(matchName);
}

function removeEffect(layer, matchName) {
    for (var i = layer.Effects.numProperties; i >= 1; i--) {
        if (layer.Effects.property(i).matchName === matchName) {
            layer.Effects.property(i).remove();
            return;
        }
    }
}

// val = { flip: bool, bw: bool, tint: [r,g,b]|null, hue: number }
function applyVideoLayer(layer, val) {
    // Flip horizontal via scale X sign
    var sc = layer.transform.scale;
    var sv = sc.value;
    sc.setValue([val.flip ? -Math.abs(sv[0]) : Math.abs(sv[0]), sv[1]]);

    // Hue/Saturation handles both B&W (sat = -100) and hue shift
    var needHS = val.bw || (val.hue !== 0);
    if (needHS) {
        var hs = getOrAddEffect(layer, "ADBE HUE SATURATION");
        hs.property("Master Hue").setValue(val.hue || 0);
        hs.property("Master Saturation").setValue(val.bw ? -100 : 0);
    } else {
        removeEffect(layer, "ADBE HUE SATURATION");
    }

    // Tint effect
    if (val.tint && val.tint.length >= 3) {
        var tint = getOrAddEffect(layer, "ADBE Tint");
        tint.property("Map Black To").setValue([val.tint[0], val.tint[1], val.tint[2], 1]);
        tint.property("Map White To").setValue([1, 1, 1, 1]);
        tint.property("Amount to Tint").setValue(val.tintAmount !== undefined ? val.tintAmount : 50);
    } else {
        removeEffect(layer, "ADBE Tint");
    }

    return true;
}
