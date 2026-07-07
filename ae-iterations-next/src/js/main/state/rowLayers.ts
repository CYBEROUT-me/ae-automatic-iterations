import type { CfgLayer, LayerInfo, LayerType } from "../../../shared/types";

export type Mode = "itr" | "var";

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
//
// Under VAR mode, video/footage layers are relabeled "media" (matching the
// original extension's `if (li.type === "video" && currentMode === "var")
// layerType = "media"`); getLayerType itself still always reports "video" —
// this relabeling is purely a buildRowLayers/UI concern.
export function buildRowLayers(layers: LayerInfo[], mode: Mode): RowLayer[] {
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
      const effectiveType: LayerType = layer.type === "video" && mode === "var" ? "media" : layer.type;
      rows.push({ layerIndex: layer.index, rowKey: String(layer.index), type: effectiveType, name: layer.name, fillPath: "" });
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
