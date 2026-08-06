// lib/applyBadge.ts — add/remove a from-scratch circle+text "badge" overlay
// (VAR mode). Unlike every other overlay in this codebase (Emoji, Logo,
// Media), there is no existing asset to import here — the circle (a shape
// layer) and the text (a text layer) are synthesized directly via AE's
// vector-shape and text-layer scripting APIs. Both layers are sized as a
// percentage of a fixed base diameter/font size, matching
// EmojiConfig/LogoConfig's scale-percentage convention (size: 100 = no
// scaling).

export const BADGE_CIRCLE_LAYER_NAME = "AEITER_BADGE_CIRCLE";
export const BADGE_TEXT_LAYER_NAME = "AEITER_BADGE_TEXT";

const BASE_DIAMETER = 100; // comp pixels, before the `size` percentage scale
const BASE_FONT_SIZE = 40; // comp pixels, before the `size` percentage scale

export function removeBadgeFromComp(comp: CompItem): void {
  for (let i = comp.numLayers; i >= 1; i--) {
    try {
      const name = comp.layer(i).name;
      if (name === BADGE_CIRCLE_LAYER_NAME || name === BADGE_TEXT_LAYER_NAME) comp.layer(i).remove();
    } catch (e) {}
  }
}

// Badge always spans the full comp duration regardless of moveAfterLayer --
// an earlier revision let "attach to layer" also shrink the badge's
// timespan to match that layer's, but real usage showed that coupling was
// more confusing than useful (the badge kept coming out unexpectedly short
// even once the cause was understood), so duration-matching was removed
// unconditionally. Stacking position is a separate, independently useful
// concern (e.g. keeping badge below a "packshot" layer that should cover
// it) -- moveAfterLayer restores just that half, mirroring Logo/Emoji's
// layerIndex mechanism exactly (see applyImageOverlay.ts's
// resolveOverlayAttachment for why callers must resolve this to a Layer
// reference BEFORE either overlay inserts anything).
export function addBadgeToComp(
  comp: CompItem,
  text: string,
  x: number,
  y: number,
  size: number,
  circleColor: [number, number, number],
  textColor: [number, number, number],
  moveAfterLayer?: Layer | null
): void {
  removeBadgeFromComp(comp);
  const sz = size || 100;

  // Circle: a shape layer with one ellipse + one fill, centered on its own
  // anchor point so the layer's Position IS the circle's visual center.
  const circleLayer = comp.layers.addShape();
  circleLayer.name = BADGE_CIRCLE_LAYER_NAME;
  circleLayer.inPoint = 0;
  circleLayer.outPoint = comp.duration;

  const contents = circleLayer.property("Contents") as any;
  const group = contents.addProperty("ADBE Vector Group");
  const groupContents = group.property("Contents") as any;
  const ellipse = groupContents.addProperty("ADBE Vector Shape - Ellipse");
  ellipse.property("ADBE Vector Ellipse Size").setValue([BASE_DIAMETER, BASE_DIAMETER]);
  const fill = groupContents.addProperty("ADBE Vector Graphic - Fill");
  fill.property("ADBE Vector Fill Color").setValue(circleColor);
  // Ellipse is drawn centered on the group's own transform origin, which
  // defaults to [0, 0] -- explicit here so a future AE version's default
  // can't silently shift it.
  group.property("ADBE Vector Transform Group").property("ADBE Vector Position").setValue([0, 0]);

  circleLayer.transform.anchorPoint.setValue([0, 0]);
  circleLayer.transform.position.setValue([x, y]);
  circleLayer.transform.scale.setValue([sz, sz]);

  // Text: added AFTER the circle, so it lands on top of it in the layer
  // stack (comp.layers.addText() always inserts at index 1 -- the circle,
  // added first, is now at index 2, directly below). No explicit reordering
  // needed for text-over-circle.
  const textLayer = comp.layers.addText(text);
  textLayer.name = BADGE_TEXT_LAYER_NAME;
  textLayer.inPoint = 0;
  textLayer.outPoint = comp.duration;

  const textProp = textLayer.property("Source Text") as any;
  const textDoc = textProp.value;
  // Explicit, near-universally-available font -- a fresh text layer
  // otherwise inherits whatever AE's own default/last-used font is, which
  // is a plausible trigger for a missing-font substitution dialog on
  // save+reopen (this project reopens every VAR variant mid-run). A dialog
  // there would block scripted execution silently, matching a real report
  // of only the 9x16 PNG rendering while 1x1/16x9/4x5 didn't (videos,
  // rendered before reopen, were unaffected).
  textDoc.font = "ArialMT";
  textDoc.fontSize = BASE_FONT_SIZE;
  textDoc.fillColor = textColor;
  textDoc.justification = ParagraphJustification.CENTER_JUSTIFY;
  textProp.setValue(textDoc);

  // A fresh text layer's anchor point is at its baseline origin, not its
  // visual center -- sourceRectAtTime + anchorPoint is the standard AE
  // scripting technique for centering a text layer on an arbitrary point.
  const rect = textLayer.sourceRectAtTime(0, false);
  textLayer.transform.anchorPoint.setValue([rect.left + rect.width / 2, rect.top + rect.height / 2]);
  textLayer.transform.position.setValue([x, y]);
  textLayer.transform.scale.setValue([sz, sz]);

  // Move both layers together, preserving text-above-circle. moveAfter
  // anchored on the SAME target twice, circle first then text, lands text
  // immediately after the target and circle immediately after text --
  // i.e. target, text, circle -- regardless of where either started.
  if (moveAfterLayer) {
    try {
      circleLayer.moveAfter(moveAfterLayer);
      textLayer.moveAfter(moveAfterLayer);
    } catch (e) {
      // moveAfterLayer was invalidated (e.g. removed) between being
      // resolved and used -- leave the badge at the top rather than throwing.
    }
  }
}
