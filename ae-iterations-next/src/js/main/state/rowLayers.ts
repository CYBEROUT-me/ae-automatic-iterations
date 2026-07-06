import type { CfgLayer, LayerInfo, LayerType } from "../../../shared/types";

export interface RowLayer {
  layerIndex: number;
  rowKey: string;
  type: LayerType;
  name: string;
  fillPath: string;
}

// Flattens LayerInfo[] into a UI row list, splitting each shape layer's
// strokes into their own synthetic rows (same AE layer index, different
// property path) — mirrors main.js's renderLayerInfo virtual-entry injection.
export function buildRowLayers(layers: LayerInfo[]): RowLayer[] {
  const rows: RowLayer[] = [];
  for (const layer of layers) {
    if (layer.type === "shape") {
      const fillPath = layer.fills && layer.fills.length ? layer.fills[0].path : "";
      rows.push({ layerIndex: layer.index, rowKey: String(layer.index), type: "shape", name: layer.name, fillPath });
      (layer.strokes || []).forEach((stroke, i) => {
        rows.push({
          layerIndex: layer.index,
          rowKey: `${layer.index}:stroke:${i}`,
          type: "stroke",
          name: `Stroke — ${layer.name}`,
          fillPath: stroke.path,
        });
      });
    } else {
      rows.push({ layerIndex: layer.index, rowKey: String(layer.index), type: layer.type, name: layer.name, fillPath: "" });
    }
  }
  return rows;
}

// Builds the CfgLayer[] the host's previewApply/run commands expect, in the
// same order as `rows` (and thus the same order the caller must zip its
// per-iteration values array against).
export function toCfgLayers(rows: RowLayer[]): CfgLayer[] {
  return rows.map((r) => ({ index: r.layerIndex, name: r.name, fillPath: r.fillPath, layerType: r.type }));
}
