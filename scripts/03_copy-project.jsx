// 03_copy-project.jsx
// 1. Copies the current .aep with the iteration ID incremented by 1.
//    Example: LO_10794_...aep  →  LO_10795_...aep
// 2. Opens the copy and renames all comps whose second name segment
//    matches the old ID (e.g. "10794") to the new ID ("10795").
// 3. Saves the copy. You remain in the copied project when done.
// Run via File > Scripts > Run Script File… in After Effects.

(function main() {

    var projectFile = app.project.file;
    if (!projectFile) {
        alert("Збережи проєкт перед запуском.");
        return;
    }

    // ── Parse and increment the ID ───────────────────────────────────────────
    var baseName = projectFile.name.replace(/\.[^.]+$/, "");
    var ext      = (projectFile.name.match(/\.[^.]+$/) || [".aep"])[0];
    var parts    = baseName.split("_");

    if (parts.length < 2 || isNaN(parseInt(parts[1], 10))) {
        alert("Не вдалося розпізнати ID у назві проєкту:\n" + projectFile.name);
        return;
    }

    var oldId       = parts[1];                          // e.g. "10794"
    var newId       = String(parseInt(oldId, 10) + 1);  // e.g. "10795"
    var newParts    = parts.slice();
    newParts[1]     = newId;
    var newBaseName = newParts.join("_");
    var destFile    = new File(projectFile.parent.fsName + "/" + newBaseName + ext);

    if (destFile.exists) {
        var overwrite = confirm("Файл «" + destFile.name + "» вже існує.\nПерезаписати?");
        if (!overwrite) return;
        destFile.remove();
    }

    // ── Copy file ────────────────────────────────────────────────────────────
    app.project.save(projectFile); // ensure source is saved before copying

    var ok = projectFile.copy(destFile.fsName);
    if (!ok) {
        alert("Не вдалося скопіювати файл.");
        return;
    }

    // ── Open copy and rename comps ───────────────────────────────────────────
    app.open(destFile);  // closes the original; no save prompt since we just saved

    // Collect all matching comps first — renaming during iteration shifts AE's
    // internal sort order and causes some items to be skipped.
    var toRename = [];
    for (var i = 1; i <= app.project.numItems; i++) {
        var item = app.project.item(i);
        if (!(item instanceof CompItem)) continue;
        var compParts = item.name.split("_");
        if (compParts.length >= 2 && compParts[1] === oldId) {
            compParts[1] = newId;
            toRename.push({ item: item, newName: compParts.join("_") });
        }
    }
    // Rename in a second pass so the index loop above stays stable.
    var renamed = toRename.length;
    for (var r = 0; r < toRename.length; r++) {
        toRename[r].item.name = toRename[r].newName;
    }

    app.project.save(destFile);

    alert("✅ Копію створено і відкрито.\n\n" +
          "Файл: " + destFile.name + "\n" +
          "Перейменовано комп: " + renamed);

})();
