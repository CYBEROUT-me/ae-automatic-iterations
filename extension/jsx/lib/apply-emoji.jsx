// lib/apply-emoji.jsx — import an emoji footage and add it as a looping layer
//
// Each added layer is named AEITER_EMOJI so it can be found and removed on
// the next iteration (the ITR workflow copies the project, so without removal
// every copy would inherit the previous iteration's emoji layer).

var EMOJI_LAYER_NAME = "AEITER_EMOJI";

// Remove any previously placed emoji layers from the comp.
function removeEmojiFromComp(comp) {
    for (var i = comp.numLayers; i >= 1; i--) {
        try {
            if (comp.layer(i).name === EMOJI_LAYER_NAME) comp.layer(i).remove();
        } catch (e) {}
    }
}

// comp:        CompItem to add the emoji into
// emojiPath:   absolute path to the emoji file
// x, y:        position in comp pixels
// targetIndex: 1-based layer position from top (1 = topmost)
function addEmojiToComp(comp, emojiPath, x, y, targetIndex) {
    // Remove any emoji left over from a previous iteration
    removeEmojiFromComp(comp);

    var file = new File(emojiPath);
    if (!file.exists) throw new Error("Emoji file not found: " + emojiPath);

    var footage = app.project.importFile(new ImportOptions(file));
    if (!footage) throw new Error("importFile returned null for emoji");

    // Add at index 1 (top of stack)
    var layer = comp.layers.add(footage);
    layer.name = EMOJI_LAYER_NAME;

    // Span the full comp
    layer.inPoint  = 0;
    layer.outPoint = comp.duration;

    // Position and scale
    layer.transform.position.setValue([x, y]);
    layer.transform.scale.setValue([100, 100]);

    // Time remapping so loopOut works regardless of source duration
    layer.timeRemapEnabled = true;
    layer.timeRemap.expression = 'loopOut("cycle")';

    // Move to target index.
    // After layers.add() our layer is at 1; original layers shifted to 2..N+1.
    // moveAfter(comp.layer(P)) places our layer at index P. ✓
    if (targetIndex > 1) {
        if (targetIndex >= comp.numLayers) {
            layer.moveToEnd();
        } else {
            layer.moveAfter(comp.layer(targetIndex));
        }
    }
}
