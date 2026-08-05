// lib/applyEmoji.ts — add/remove the emoji overlay layer. Thin wrapper
// around lib/applyImageOverlay.ts's generic mechanics (extracted here since
// Logo overlay, lib/applyLogo.ts, needs the exact same behavior). No change
// in behavior from the original inline implementation — same calls, same
// order, just parameterized by EMOJI_LAYER_NAME through the shared helper.

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
  addImageOverlayToComp(comp, footage, EMOJI_LAYER_NAME, x, y, targetIndex, size);
}
