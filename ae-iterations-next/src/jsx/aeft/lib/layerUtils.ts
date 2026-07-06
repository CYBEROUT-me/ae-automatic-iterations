import type { FillInfo, StrokeInfo, LayerType } from "../../../shared/types";

export function getLayerType(layer: Layer): LayerType {
  if (layer instanceof ShapeLayer) return "shape";
  if (layer instanceof TextLayer) return "text";
  if (layer instanceof AVLayer) return "video";
  return "unknown";
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
