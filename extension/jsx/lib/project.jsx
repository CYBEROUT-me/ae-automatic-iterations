// lib/project.jsx — copy & rename project, rename comps

function copyProject(srcFile) {
    var baseName = srcFile.name.replace(/\.[^.]+$/, "");
    var ext      = (srcFile.name.match(/\.[^.]+$/) || [".aep"])[0];
    var parts    = baseName.split("_");
    var oldId    = parts[1];
    parts[1]     = String(parseInt(oldId, 10) + 1);
    var newFile  = new File(srcFile.parent.fsName + "/" + parts.join("_") + ext);
    if (newFile.exists) newFile.remove();
    var ok = srcFile.copy(newFile.fsName);
    if (!ok) throw new Error("File copy failed: " + newFile.name);
    return { file: newFile, oldId: oldId, newId: parts[1] };
}

function renameComps(oldId, newId) {
    var toRename = [];
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (!(item instanceof CompItem)) continue;
        var p = item.name.split("_");
        if (p.length >= 2 && p[1] === oldId) { p[1] = newId; toRename.push({ item: item, name: p.join("_") }); }
    }
    for (var r = 0; r < toRename.length; r++) toRename[r].item.name = toRename[r].name;
}
