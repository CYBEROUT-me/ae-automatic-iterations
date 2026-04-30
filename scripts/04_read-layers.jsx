// 04_read-layers.jsx
// Reads the currently selected layers from the active composition.
// Reports type, fill colors, and font for each selected layer.
// Used standalone for testing; the logic is reused in the CEP host.jsx.
// Run via File > Scripts > Run Script File… in After Effects.

(function main() {

    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Відкрий та активуй композицію.");
        return;
    }

    var selected = comp.selectedLayers;
    if (selected.length === 0) {
        alert("Виділи хоча б один шар у Composition.");
        return;
    }

    var results = [];
    for (var i = 0; i < selected.length; i++) {
        results.push(readLayer(selected[i]));
    }

    // Report
    var lines = [];
    for (var r = 0; r < results.length; r++) {
        var info = results[r];
        lines.push("─── " + info.name + " (індекс " + info.index + ") ───");
        lines.push("Тип: " + info.type);

        if (info.type === "shape") {
            if (info.fills.length === 0) {
                lines.push("Заливок не знайдено. Структура Contents:");
                try {
                    var contents = selected[r].property("Contents");
                    for (var d = 1; d <= contents.numProperties; d++) {
                        var dp = contents.property(d);
                        lines.push("  [" + d + "] " + dp.name + "  matchName=" + dp.matchName);
                    }
                } catch (e) { lines.push("  (не вдалося прочитати Contents)"); }
            } else {
                for (var f = 0; f < info.fills.length; f++) {
                    var c = info.fills[f].color;
                    lines.push("Заливка " + (f + 1) + ": rgb(" +
                        Math.round(c[0] * 255) + ", " +
                        Math.round(c[1] * 255) + ", " +
                        Math.round(c[2] * 255) + ")" +
                        "  шлях: " + info.fills[f].path
                    );
                }
            }
        } else if (info.type === "text") {
            var tc = info.textColor;
            lines.push("Колір тексту: rgb(" +
                Math.round(tc[0] * 255) + ", " +
                Math.round(tc[1] * 255) + ", " +
                Math.round(tc[2] * 255) + ")"
            );
            lines.push("Шрифт: " + info.font);
        } else {
            lines.push("Тип шару не підтримується (не shape та не text).");
        }
    }

    alert(lines.join("\n"));

    // ── Layer reading logic (also exported for host.jsx) ────────────────────

    function readLayer(layer) {
        var info = {
            name:  layer.name,
            index: layer.index,
            type:  getLayerType(layer)
        };

        if (info.type === "shape") {
            info.fills = collectFills(layer.property("Contents"), "Contents");
        } else if (info.type === "text") {
            var textDoc     = layer.property("Source Text").value;
            info.textColor  = textDoc.fillColor;   // [r, g, b] normalized 0–1
            info.font       = textDoc.font;         // PostScript name
        }

        return info;
    }

    function getLayerType(layer) {
        // Duck-type: check which root property exists rather than relying on matchName,
        // because matchName varies across AE versions.
        if (layer.property("Contents"))    return "shape";
        if (layer.property("Source Text")) return "text";
        return "unknown";
    }

    // Recursively walks a shape Contents group.
    // Returns array of { path: "Contents/Group 1/Fill 1", color: [r,g,b] }
    // Recurses into ANY PropertyGroup so it works regardless of nesting depth.
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
                try {
                    fills.push({ path: propPath, color: prop.property("Color").value });
                } catch (e) {}

            } else if (prop.propertyType !== PropertyType.PROPERTY) {
                // Recurse into any sub-group (Vectors Group, Transform, etc.)
                var sub = collectFills(prop, propPath);
                for (var s = 0; s < sub.length; s++) fills.push(sub[s]);
            }
        }
        return fills;
    }

})();
