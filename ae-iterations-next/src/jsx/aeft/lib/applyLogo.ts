// lib/applyLogo.ts — add/remove the logo overlay layer (VAR mode). Thin
// wrapper around lib/applyImageOverlay.ts's generic mechanics, same pattern
// as applyEmoji.ts. targetIndex defaults to "top of stack" when the caller
// omits it; a caller that resolved LogoConfig.layerIndex via
// resolveOverlayAttachment passes the real stacking target instead,
// mirroring EmojiConfig.layerIndex's stacking behavior exactly (duration
// always spans the full comp regardless -- see applyImageOverlay.ts).

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
  targetIndex: number = 1
): void {
  addImageOverlayToComp(comp, footage, LOGO_LAYER_NAME, x, y, targetIndex, size);
}
