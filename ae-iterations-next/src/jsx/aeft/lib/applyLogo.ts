// lib/applyLogo.ts — add/remove the logo overlay layer (VAR mode). Thin
// wrapper around lib/applyImageOverlay.ts's generic mechanics, same pattern
// as applyEmoji.ts. moveAfterLayer defaults to "top of stack" when the
// caller omits it; a caller that resolved LogoConfig.layerIndex via
// resolveOverlayAttachment (BEFORE any of this iteration's own overlay
// layers were inserted -- see that function's header) passes the captured
// Layer reference instead, mirroring EmojiConfig.layerIndex's stacking
// behavior (duration always spans the full comp regardless -- see
// applyImageOverlay.ts).

import { addImageOverlayToComp, removeImageOverlayFromComp } from "./applyImageOverlay";

export const LOGO_LAYER_NAME = "AEITER_LOGO";

export function removeLogoFromComp(comp: CompItem): void {
  removeImageOverlayFromComp(comp, LOGO_LAYER_NAME);
}

export function addLogoToComp(
  comp: CompItem,
  footage: FootageItem,
  x: number,
  y: number,
  size: number,
  moveAfterLayer?: Layer | null
): void {
  addImageOverlayToComp(comp, footage, LOGO_LAYER_NAME, x, y, size, moveAfterLayer);
}
