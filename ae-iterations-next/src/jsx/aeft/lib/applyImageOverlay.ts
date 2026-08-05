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
// EmojiConfig.layerIndex exactly) to the actual Layer object at that index,
// captured NOW -- before the caller does anything else to the comp.
//
// This must be called before ANY of this iteration's own overlay layers are
// inserted, badge included. A plain index is a moving target: if badge (2
// layers) is inserted first, every existing layer's index shifts by 2, so
// resolving Logo's "attach to layer 2" AFTER that would resolve against
// badge's own inserted layers, not the comp's real layer 2 -- landing Logo
// sandwiched between badge's own two layers, not where the user meant.
// A captured Layer *reference* stays valid as other layers are added around
// it (only its 1-based index changes, not the object itself), so resolving
// once, early, and passing the reference through fixes this regardless of
// how many overlay layers get inserted afterward.
//
// Stacking-only, unset/0/an out-of-range index falls back to null (top of
// stack) -- an earlier revision also matched the attached layer's
// inPoint/outPoint (to exclude the overlay from e.g. a packshot section),
// but real usage showed that coupling was more confusing than useful, so
// badge/logo both always span the full comp duration again, unconditionally.
export function resolveOverlayAttachment(comp: CompItem, layerIndex: number | undefined): Layer | null {
  if (!layerIndex || layerIndex < 1) return null;
  try {
    return comp.layer(layerIndex);
  } catch (e) {
    return null;
  }
}

// comp:            CompItem to add the overlay into
// footage:          already-imported overlay FootageItem (shared across comps by caller)
// layerName:        sentinel name so this exact overlay can be found/removed later
// x, y:             position in comp pixels
// size:             uniform scale percentage
// moveAfterLayer:   a Layer reference (see resolveOverlayAttachment) to stack
//                   this overlay directly below; null/omitted leaves it at
//                   the top of the stack (comp.layers.add's own default).
// Returns the newly-added layer, so a caller with its own reordering timing
// requirements (see applyEmoji.ts's addEmojiToComp) can handle that itself
// instead of using moveAfterLayer.
export function addImageOverlayToComp(
  comp: CompItem,
  footage: FootageItem,
  layerName: string,
  x: number,
  y: number,
  size: number,
  moveAfterLayer?: Layer | null
): AVLayer {
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

  if (moveAfterLayer) {
    try {
      layer.moveAfter(moveAfterLayer);
    } catch (e) {
      // moveAfterLayer was invalidated (e.g. removed) between being resolved
      // and used -- leave the overlay at the top rather than throwing.
    }
  }

  return layer;
}
