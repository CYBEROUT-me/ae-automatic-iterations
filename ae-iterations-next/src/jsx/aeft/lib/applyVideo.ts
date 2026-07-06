// Ported from extension/jsx/lib/apply-video.jsx — effects-based changes for
// video/footage/precomp layers.
//
// Uses `layer.Effects` (capital), matching the original source and the
// currently-shipping extension/jsx/lib/apply-video.jsx (lines 4-8, 11-17),
// which accesses `layer.Effects` with no try/catch at all and has shipped
// across 6+ releases (v1.0.6-v1.0.11) without incident — strong evidence
// `Effects` is the real live ExtendScript runtime property on AVLayer.
// types-for-adobe's AVLayer/22.0 ambient types only declare a lowercase
// `effect: PropertyGroup` shortcut and omit `Effects`, which appears to be
// an incomplete/incorrect community type definition rather than a
// documented alternate API — hence the `any` cast here to access it. See
// src/jsx/aeft/lib/layerUtils.ts (readVideoLayerState) and
// .superpowers/sdd/task-7-report.md for the prior, reviewed instance of
// this exact situation.

function getOrAddEffect(layer: AVLayer, matchName: string): any {
  const effects = (layer as any).Effects;
  for (let i = 1; i <= effects.numProperties; i++) {
    if ((effects.property(i) as any).matchName === matchName) return effects.property(i);
  }
  return effects.addProperty(matchName);
}

function removeEffect(layer: AVLayer, matchName: string): void {
  const effects = (layer as any).Effects;
  for (let i = effects.numProperties; i >= 1; i--) {
    if ((effects.property(i) as any).matchName === matchName) {
      effects.property(i).remove();
      return;
    }
  }
}

export function applyVideoLayer(
  layer: AVLayer,
  val: { flip: boolean; bw: boolean; tint: [number, number, number] | null; tintAmount?: number; hue: number }
): boolean {
  // Flip horizontal via scale X sign
  const sc = layer.transform.scale;
  const sv = sc.value as [number, number];
  sc.setValue([val.flip ? -Math.abs(sv[0]) : Math.abs(sv[0]), sv[1]]);

  // Hue/Saturation handles both B&W (sat = -100) and hue shift
  const needHS = val.bw || val.hue !== 0;
  if (needHS) {
    const hs = getOrAddEffect(layer, "ADBE HUE SATURATION");
    hs.property("Master Hue").setValue(val.hue || 0);
    hs.property("Master Saturation").setValue(val.bw ? -100 : 0);
  } else {
    removeEffect(layer, "ADBE HUE SATURATION");
  }

  // Tint effect
  if (val.tint && val.tint.length >= 3) {
    const tint = getOrAddEffect(layer, "ADBE Tint");
    tint.property("Map Black To").setValue([val.tint[0], val.tint[1], val.tint[2], 1]);
    tint.property("Map White To").setValue([1, 1, 1, 1]);
    tint.property("Amount to Tint").setValue(val.tintAmount !== undefined ? val.tintAmount : 50);
  } else {
    removeEffect(layer, "ADBE Tint");
  }

  return true;
}
