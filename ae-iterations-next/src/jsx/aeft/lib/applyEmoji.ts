// lib/applyEmoji.ts — add/remove a looping, time-remapped emoji overlay layer.
// Ported from extension/jsx/lib/apply-emoji.jsx. Deliberate deviation: this
// takes an already-imported FootageItem, not a raw file path — see this
// plan's Task 2 header for why.

export const EMOJI_LAYER_NAME = "AEITER_EMOJI";

// Remove any previously placed emoji layer from the comp.
export function removeEmojiFromComp(comp: CompItem): void {
  for (let i = comp.numLayers; i >= 1; i--) {
    try {
      if (comp.layer(i).name === EMOJI_LAYER_NAME) comp.layer(i).remove();
    } catch (e) {}
  }
}

// comp:        CompItem to add the emoji into
// footage:     already-imported emoji FootageItem (shared across comps by caller)
// x, y:        position in comp pixels
// targetIndex: 1-based layer position from top (1 = topmost)
// size:        uniform scale percentage
export function addEmojiToComp(
  comp: CompItem,
  footage: FootageItem,
  x: number,
  y: number,
  targetIndex: number,
  size: number
): void {
  // Remove any emoji left over from a previous iteration
  removeEmojiFromComp(comp);

  // Add at index 1 (top of stack)
  const layer = comp.layers.add(footage);
  layer.name = EMOJI_LAYER_NAME;

  // Span the full comp
  layer.inPoint = 0;
  layer.outPoint = comp.duration;

  // Position and scale
  layer.transform.position.setValue([x, y]);
  const sz = size || 100;
  layer.transform.scale.setValue([sz, sz]);

  // Time remapping so loopOut works regardless of source duration
  layer.timeRemapEnabled = true;
  layer.timeRemap.expression = 'loopOut("cycle")';

  // Move to target index.
  // After layers.add() our layer is at 1; original layers shifted to 2..N+1.
  // moveAfter(comp.layer(P)) places our layer at index P.
  if (targetIndex > 1) {
    if (targetIndex >= comp.numLayers) {
      layer.moveToEnd();
    } else {
      layer.moveAfter(comp.layer(targetIndex));
    }
  }
}
