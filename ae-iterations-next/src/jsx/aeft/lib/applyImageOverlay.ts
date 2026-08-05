// lib/applyImageOverlay.ts — generic add/remove for a looping, time-remapped
// image overlay layer, identified by a caller-supplied sentinel name.
// Extracted from applyEmoji.ts's addEmojiToComp/removeEmojiFromComp (which
// were 100% generic except for the hardcoded EMOJI_LAYER_NAME) so Logo
// overlay (lib/applyLogo.ts) can reuse the exact same mechanics instead of
// duplicating them. applyEmoji.ts now wraps this with EMOJI_LAYER_NAME —
// same calls, same order, no behavior change for the shipped ITR feature.

// Remove any previously placed overlay layer matching layerName from the comp.
export function removeImageOverlayFromComp(comp: CompItem, layerName: string): void {
  for (let i = comp.numLayers; i >= 1; i--) {
    try {
      if (comp.layer(i).name === layerName) comp.layer(i).remove();
    } catch (e) {}
  }
}

// Resolves "attach to layer" (Logo's optional layerIndex, mirroring
// EmojiConfig.layerIndex exactly) to a 1-based stacking target: unset/0/an
// out-of-range index falls back to the top of the stack. Stacking-only --
// an earlier revision also matched the attached layer's inPoint/outPoint
// (to exclude the overlay from e.g. a packshot section), but real usage
// showed that coupling was more confusing than useful (the overlay kept
// coming out unexpectedly short even once the cause was understood), so
// badge/logo both always span the full comp duration again, unconditionally.
export function resolveOverlayAttachment(comp: CompItem, layerIndex: number | undefined): { targetIndex: number } {
  if (!layerIndex || layerIndex < 1) return { targetIndex: 1 };
  try {
    comp.layer(layerIndex);
    return { targetIndex: layerIndex };
  } catch (e) {
    return { targetIndex: 1 };
  }
}

// comp:        CompItem to add the overlay into
// footage:     already-imported overlay FootageItem (shared across comps by caller)
// layerName:   sentinel name so this exact overlay can be found/removed later
// x, y:        position in comp pixels
// targetIndex: 1-based layer position from top (1 = topmost)
// size:        uniform scale percentage
export function addImageOverlayToComp(
  comp: CompItem,
  footage: FootageItem,
  layerName: string,
  x: number,
  y: number,
  targetIndex: number,
  size: number
): void {
  // Remove any overlay left over from a previous iteration
  removeImageOverlayFromComp(comp, layerName);

  // Add at index 1 (top of stack)
  const layer = comp.layers.add(footage);
  layer.name = layerName;

  // Span the full comp
  layer.inPoint = 0;
  layer.outPoint = comp.duration;

  // Position and scale
  layer.transform.position.setValue([x, y]);
  const sz = size || 100;
  layer.transform.scale.setValue([sz, sz]);

  // Time remapping so loopOut works regardless of source duration -- but
  // only when the source actually supports it. Emoji's source is always an
  // animated GIF (real duration, loopOut makes sense); Logo's source is
  // typically a static PNG/JPG (zero duration, nothing to remap), and AE
  // throws "Can not set timeRemapEnabled" for those -- canSetTimeRemapEnabled
  // is exactly the check AE's own error message points at.
  if (layer.canSetTimeRemapEnabled) {
    layer.timeRemapEnabled = true;
    layer.timeRemap.expression = 'loopOut("cycle")';
  }

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
