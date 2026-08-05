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

// Resolves what "attach to layer" (badge/logo's optional layerIndex, mirroring
// EmojiConfig.layerIndex) means for a given comp: unset/0/an out-of-range
// index falls back to today's default (top of stack, no duration override);
// a valid index reports that layer's own inPoint/outPoint so the caller can
// make the overlay match that layer's timespan instead of the full comp --
// this is what actually excludes an overlay from e.g. a packshot section,
// since attaching by stacking position alone does not.
export function resolveOverlayAttachment(
  comp: CompItem,
  layerIndex: number | undefined
): { targetIndex: number; inPoint?: number; outPoint?: number } {
  if (!layerIndex || layerIndex < 1) return { targetIndex: 1 };
  try {
    const target = comp.layer(layerIndex);
    return { targetIndex: layerIndex, inPoint: target.inPoint, outPoint: target.outPoint };
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
// inPoint/outPoint: optional overrides (see resolveOverlayAttachment); default
//   to the full comp duration when omitted, matching every existing caller's
//   behavior exactly (Emoji passes neither, so its behavior is unchanged).
export function addImageOverlayToComp(
  comp: CompItem,
  footage: FootageItem,
  layerName: string,
  x: number,
  y: number,
  targetIndex: number,
  size: number,
  inPoint?: number,
  outPoint?: number
): void {
  // Remove any overlay left over from a previous iteration
  removeImageOverlayFromComp(comp, layerName);

  // Add at index 1 (top of stack)
  const layer = comp.layers.add(footage);
  layer.name = layerName;

  // Span the full comp, unless a specific attachment timespan was given.
  layer.inPoint = inPoint ?? 0;
  layer.outPoint = outPoint ?? comp.duration;

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
