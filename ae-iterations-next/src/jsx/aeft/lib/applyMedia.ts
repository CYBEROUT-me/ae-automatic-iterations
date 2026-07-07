// lib/applyMedia.ts — replace footage source and apply a scale-to-fill
// expression, for VAR-mode media-replacement layers. Matches the committed
// extension/jsx/host.jsx's runVarIterationsJSON inline logic (lines 568-580),
// not the uncommitted apply-media.jsx, which remains out of scope for this
// rewrite per the Phase 1-2 spec's Global Constraints.

export function applyMediaLayer(layer: AVLayer, footage: FootageItem): boolean {
  try {
    layer.replaceSource(footage, false);
  } catch (e) {
    return false;
  }
  try {
    layer.transform.scale.expression =
      "var rw = thisComp.width / source.width;\n" +
      "var rh = thisComp.height / source.height;\n" +
      "var r = Math.max(rw, rh) * 100;\n[r, r]";
  } catch (e) {
    // Matches the original: a failed expression assignment is silently
    // ignored — replaceSource succeeding is what matters for the boolean
    // result; the scale expression is a best-effort convenience.
  }
  return true;
}
