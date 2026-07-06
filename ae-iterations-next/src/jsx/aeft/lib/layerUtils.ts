import type { FillInfo, StrokeInfo, LayerType, VideoState } from "../../../shared/types";

export function getLayerType(layer: Layer): LayerType {
  if (layer instanceof ShapeLayer) return "shape";
  if (layer instanceof TextLayer) return "text";
  if (layer instanceof AVLayer) return "video";
  return "unknown";
}

// Ported from extension/jsx/lib/layer-utils.jsx:12-34. Uses `layer.Effects`
// (capital), matching the original source and the currently-shipping
// extension/jsx/lib/apply-video.jsx (lines 4-8, 11-17), which accesses
// `layer.Effects` with no try/catch at all and has shipped across 6+
// releases (v1.0.6-v1.0.11) without incident — strong evidence `Effects` is
// the real live ExtendScript runtime property on AVLayer. types-for-adobe's
// AVLayer/22.0 ambient types only declare a lowercase `effect: PropertyGroup`
// shortcut and omit `Effects`, which appears to be an incomplete/incorrect
// community type definition rather than a documented alternate API — hence
// the `any` cast here to access it. (This is inferred from shipping-code
// behavior, not independently confirmed against a live AE runtime in this
// task.)
export function readVideoLayerState(layer: AVLayer): VideoState {
  const state: VideoState = { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 };
  try {
    const sv = layer.transform.scale.value as [number, number];
    state.flip = sv[0] < 0;
    const effects = (layer as any).Effects;
    for (let i = 1; i <= effects.numProperties; i++) {
      const eff = effects.property(i) as any;
      if (eff.matchName === "ADBE HUE SATURATION") {
        state.hue = Math.round(eff.property("Master Hue").value);
        state.bw = eff.property("Master Saturation").value <= -100;
      }
      if (eff.matchName === "ADBE Tint") {
        const amount = eff.property("Amount to Tint").value;
        if (amount > 0) {
          const c = eff.property("Map Black To").value as number[];
          state.tint = [c[0], c[1], c[2]];
          state.tintAmount = Math.round(amount);
        }
      }
    }
  } catch (e) {}
  return state;
}

// propGroup is a dynamic ExtendScript PropertyGroup — traversal is by string
// path, which Types-for-Adobe can't fully type, hence the `any`.
export function collectFills(propGroup: any, pathSoFar: string): FillInfo[] {
  const fills: FillInfo[] = [];
  let count: number;
  try {
    count = propGroup.numProperties;
  } catch (e) {
    return fills;
  }
  for (let i = 1; i <= count; i++) {
    let prop: any;
    try {
      prop = propGroup.property(i);
    } catch (e) {
      continue;
    }
    const propPath = pathSoFar + "/" + prop.name;
    if (
      prop.matchName === "ADBE Vector Shape - Fill" ||
      prop.matchName === "ADBE Vector Graphic - Fill"
    ) {
      try {
        fills.push({ path: propPath, color: prop.property("Color").value });
      } catch (e) {}
    } else if (prop.propertyType !== PropertyType.PROPERTY) {
      const sub = collectFills(prop, propPath);
      for (let s = 0; s < sub.length; s++) fills.push(sub[s]);
    }
  }
  return fills;
}

export function collectStrokes(propGroup: any, pathSoFar: string): StrokeInfo[] {
  const strokes: StrokeInfo[] = [];
  let count: number;
  try {
    count = propGroup.numProperties;
  } catch (e) {
    return strokes;
  }
  for (let i = 1; i <= count; i++) {
    let prop: any;
    try {
      prop = propGroup.property(i);
    } catch (e) {
      continue;
    }
    const propPath = pathSoFar + "/" + prop.name;
    if (
      prop.matchName === "ADBE Vector Shape - Stroke" ||
      prop.matchName === "ADBE Vector Graphic - Stroke"
    ) {
      try {
        strokes.push({ path: propPath, color: prop.property("Color").value });
      } catch (e) {}
    } else if (prop.propertyType !== PropertyType.PROPERTY) {
      const sub = collectStrokes(prop, propPath);
      for (let s = 0; s < sub.length; s++) strokes.push(sub[s]);
    }
  }
  return strokes;
}
