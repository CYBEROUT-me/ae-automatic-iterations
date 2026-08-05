// lib/applyLogo.ts — add/remove the logo overlay layer (VAR mode). Thin
// wrapper around lib/applyImageOverlay.ts's generic mechanics, same pattern
// as applyEmoji.ts. Logo has no configurable layer-index (unlike Emoji) —
// BadgeConfig/LogoConfig deliberately omit it, per the design spec — so this
// always targets index 1 (top of stack).

import { addImageOverlayToComp, removeImageOverlayFromComp } from "./applyImageOverlay";

export const LOGO_LAYER_NAME = "AEITER_LOGO";

export function removeLogoFromComp(comp: CompItem): void {
  removeImageOverlayFromComp(comp, LOGO_LAYER_NAME);
}

export function addLogoToComp(comp: CompItem, footage: FootageItem, x: number, y: number, size: number): void {
  addImageOverlayToComp(comp, footage, LOGO_LAYER_NAME, x, y, 1, size);
}
