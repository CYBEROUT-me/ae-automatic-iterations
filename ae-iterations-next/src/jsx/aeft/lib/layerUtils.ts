import type { FillInfo, StrokeInfo, LayerType, VideoState } from "../../../shared/types";

export function getLayerType(layer: Layer): LayerType {
  if (layer instanceof ShapeLayer) return "shape";
  if (layer instanceof TextLayer) return "text";
  if (layer instanceof AVLayer) return "video";
  return "unknown";
}

// Ported from extension/jsx/lib/layer-utils.jsx:12-34. Note: the brief's sample
// used `layer.Effects`, but the real types-for-adobe/22.0 AVLayer exposes the
// Effect Parade shortcut as the lowercase `effect: PropertyGroup` (the AE
// object model's official alias for property("ADBE Effect Parade")) — behaviorally
// identical, so it's used here in place of `Effects`. Individual effect property
// access (`.property("Master Hue")` etc.) is still dynamic string-path traversal,
// hence `any`.
export function readVideoLayerState(layer: AVLayer): VideoState {
  const state: VideoState = { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 };
  try {
    const sv = layer.transform.scale.value as [number, number];
    state.flip = sv[0] < 0;
    for (let i = 1; i <= layer.effect.numProperties; i++) {
      const eff = layer.effect.property(i) as any;
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
