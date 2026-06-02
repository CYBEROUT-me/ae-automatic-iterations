// lib/clean.jsx — project panel organisation (ported from Finish Him Clean Project)
// Reorganises items into canonical folders (Stuff / 01_Video / 02_Images / …)
// and removes unused items.
//
// All helpers are prefixed _cl_ to avoid collisions with other lib files.
// Public entry point: cleanProject(protectedNames)
//   protectedNames — optional array of item names to skip during removal
//                    (pass render comp names so they are never deleted).

var _CL_LANG_FOLDERS = [
    "AR", "CH", "DE", "EN", "ES", "FR", "HI",
    "IT", "JP", "KR", "PL", "PT", "RU", "TU"
];

function _clEnsureMainStuffFolder() {
    var root = app.project.rootFolder;
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof FolderItem && it.name === "Stuff") {
            if (it.parentFolder !== root) { try { it.parentFolder = root; } catch (e) {} }
            return it;
        }
    }
    var f = app.project.items.addFolder("Stuff");
    try { f.parentFolder = root; } catch (e) {}
    return f;
}

function _clEnsureSub(name, parent) {
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof FolderItem && it.name === name && it.parentFolder === parent) return it;
    }
    var f = app.project.items.addFolder(name);
    try { f.parentFolder = parent; } catch (e) {}
    return f;
}

function _clInMediaReplacement(item, mrf) {
    if (!mrf) return false;
    var p = item.parentFolder;
    while (p) { if (p === mrf) return true; p = p.parentFolder; }
    return false;
}

function _clLayerType(obj) {
    if (!obj.blendingMode && !obj.isTrackMatte && !obj.source) return "Camera/Light";
    if (obj instanceof ShapeLayer) return "Shape";
    if (obj instanceof TextLayer)  return "Text";
    if (!obj.source.file && obj.source.duration == 0) return "Solid";
    if (obj.source instanceof CompItem) return "Composition";
    if (obj.source.hasVideo === false && obj.source.hasAudio === true) return "Audio";
    if (obj.source.hasVideo === true  && obj.source.hasAudio === true  && obj.duration !== 0) return "Video";
    if (obj.source.hasVideo === true  && obj.source.hasAudio === false && obj.source.duration === 0) return "Picture";
    if (obj.source.hasVideo === true  && obj.duration !== 0 && obj.source.hasAudio === false) return "Video";
    return null;
}

function _clInLangFolder(parentName) {
    for (var i = 0; i < _CL_LANG_FOLDERS.length; i++) {
        if (parentName === _CL_LANG_FOLDERS[i]) return true;
    }
    return false;
}

function _clSinglePass(protectedNames) {
    var main  = _clEnsureMainStuffFolder();
    var vd    = _clEnsureSub("01_Video",      main);
    var img   = _clEnsureSub("02_Images",     main);
    var pcm   = _clEnsureSub("03_Pre-Comp",   main);
    var snd   = _clEnsureSub("04_Sound",      main);
    var oth   = _clEnsureSub("05_Other",      main);
    var sld   = _clEnsureSub("Solids",        oth);
    var txt   = _clEnsureSub("Texts",         main);
              _clEnsureSub("MOGRT Stuff",   main);
    var miss  = _clEnsureSub("Missing Files", main);

    var mrf = null;
    for (var i = 1; i <= app.project.numItems; i++) {
        var it = app.project.item(i);
        if (it instanceof FolderItem && it.name === "Media Replacement Comps") {
            mrf = it;
            try { it.parentFolder = main; } catch (e) {}
        }
    }

    // ── Organise ─────────────────────────────────────────────────────────────
    for (var s = app.project.numItems; s >= 1; s--) {
        var si = app.project.item(s);
        if (_clInMediaReplacement(si, mrf)) continue;
        var pn  = (si.parentFolder && si.parentFolder.name) || "";
        var sub = !_clInLangFolder(pn);
        var msf = pn.slice(0, 6) !== "Texts_";
        try {
            if (si.typeName === "Footage" && !si.file) { si.parentFolder = sld; }

            if (!si.selected && si.typeName === "Composition" && sub && msf) {
                // Don't move protected comps (render comps stay at their current location)
                var clProt = false;
                if (protectedNames) {
                    for (var pp = 0; pp < protectedNames.length; pp++) {
                        if (si.name === protectedNames[pp]) { clProt = true; break; }
                    }
                }
                if (!clProt) {
                    var hasText = false, hasOther = false;
                    for (var l = si.numLayers; l >= 1; l--) {
                        try {
                            var t = _clLayerType(si.layer(l));
                            if (t === "Text") hasText = true; else hasOther = true;
                        } catch (eL) { hasOther = true; }
                    }
                    si.parentFolder = (hasText && !hasOther) ? txt : pcm;
                }
            }

            if (si.typeName === "Folder" && si.name.slice(0, 6) === "Texts_") { si.parentFolder = txt; }
            if (si.file && si.hasVideo && si.hasAudio && si.duration !== 0)    { si.parentFolder = vd; }
            if (si.file && si.duration === 0)                                   { si.parentFolder = img; }
            if (si.file && si.duration !== 0 && !si.hasAudio)                  { si.parentFolder = vd; }
            if (si.file && !si.hasVideo && si.hasAudio)                         { si.parentFolder = snd; }
            if (si.footageMissing)                                               { si.parentFolder = miss; }
        } catch (e) {}
    }

    // ── Remove unused ─────────────────────────────────────────────────────────
    var removed = 0;
    for (var s2 = app.project.numItems; s2 >= 1; s2--) {
        var ri = app.project.item(s2);
        if (_clInMediaReplacement(ri, mrf)) continue;
        if (protectedNames) {
            var prot = false;
            for (var pi = 0; pi < protectedNames.length; pi++) {
                if (ri.name === protectedNames[pi]) { prot = true; break; }
            }
            if (prot) continue;
        }
        try {
            if (ri.usedIn == 0 && !ri.selected) { ri.remove(); removed++; }
        } catch (e) {}
    }

    try { app.project.removeUnusedFootage(); } catch (e) {}
    try { app.project.consolidateFootage();  } catch (e) {}
    return { removed: removed };
}

// protectedNames: array of item names that must survive the unused-removal pass.
function cleanProject(protectedNames) {
    try {
        app.beginUndoGroup("AE Iterations – Clean Project");
        var total = 0;
        for (var pass = 0; pass < 10; pass++) total += _clSinglePass(protectedNames).removed;
        try { app.endUndoGroup(); } catch (e) {}
        return JSON.stringify({ ok: true, removed: total });
    } catch (err) {
        try { app.endUndoGroup(); } catch (e) {}
        return JSON.stringify({ error: "cleanProject: " + (err && err.message ? err.message : String(err)) });
    }
}
