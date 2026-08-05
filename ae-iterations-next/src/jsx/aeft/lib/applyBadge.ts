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

// inPoint/outPoint: optional attachment-timespan override (see
// lib/applyImageOverlay.ts's resolveOverlayAttachment) -- default to the
// full comp duration when omitted, matching the original behavior exactly.
// Unlike Logo, badge's stacking position always stays at the top of the
// stack regardless of attachment -- a deliberate simplification, since
// reordering two layers (circle + text) together while preserving their
// relative front/back order for an arbitrary target isn't worth the
// complexity for what "attach to layer" is actually for here (excluding a
// packshot section via duration, not controlling stacking).
export function addBadgeToComp(
  comp: CompItem,
  text: string,
  x: number,
  y: number,
  size: number,
  circleColor: [number, number, number],
  textColor: [number, number, number],
  inPoint?: number,
  outPoint?: number
): void {
  removeBadgeFromComp(comp);
  const sz = size || 100;

  // Circle: a shape layer with one ellipse + one fill, centered on its own
  // anchor point so the layer's Position IS the circle's visual center.
  const circleLayer = comp.layers.addShape();
  circleLayer.name = BADGE_CIRCLE_LAYER_NAME;
  circleLayer.inPoint = inPoint ?? 0;
  circleLayer.outPoint = outPoint ?? comp.duration;

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
  textLayer.inPoint = inPoint ?? 0;
  textLayer.outPoint = outPoint ?? comp.duration;

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
}
