// lib/applyEmoji.ts — add/remove the emoji overlay layer. Thin wrapper
// around lib/applyImageOverlay.ts's generic mechanics (extracted here since
// Logo overlay, lib/applyLogo.ts, needs the exact same behavior).

import { addImageOverlayToComp, removeImageOverlayFromComp } from "./applyImageOverlay";

export const EMOJI_LAYER_NAME = "AEITER_EMOJI";

export function removeEmojiFromComp(comp: CompItem): void {
  removeImageOverlayFromComp(comp, EMOJI_LAYER_NAME);
}

export function addEmojiToComp(
  comp: CompItem,
  footage: FootageItem,
  x: number,
  y: number,
  targetIndex: number,
  size: number
): void {
  const layer = addImageOverlayToComp(comp, footage, EMOJI_LAYER_NAME, x, y, size);

  // Move to target index, resolved AFTER insertion -- this predates (and is
  // deliberately kept separate from) applyImageOverlay.ts's moveAfterLayer
  // mechanism, which Logo now uses to resolve its target BEFORE any of an
  // iteration's own overlay layers are inserted (see
  // resolveOverlayAttachment's header for why that matters there). Emoji is
  // the only overlay in ITR mode, so there's no equivalent "another overlay
  // already shifted the indices" hazard here -- preserving this exact
  // original, shipped timing rather than switching to the new mechanism.
  //
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
