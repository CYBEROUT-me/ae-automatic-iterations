// lib/applyLogo.ts — add/remove the logo overlay layer (VAR mode). Thin
// wrapper around lib/applyImageOverlay.ts's generic mechanics, same pattern
// as applyEmoji.ts. targetIndex/inPoint/outPoint default to "top of stack,
// full comp duration" (matching the original design) when the caller omits
// them; a caller that resolved LogoConfig.layerIndex via
// resolveOverlayAttachment passes real values through instead, mirroring
// EmojiConfig.layerIndex's dual stacking+duration behavior exactly.

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
  targetIndex: number = 1,
  inPoint?: number,
  outPoint?: number
): void {
  addImageOverlayToComp(comp, footage, LOGO_LAYER_NAME, x, y, targetIndex, size, inPoint, outPoint);
}
