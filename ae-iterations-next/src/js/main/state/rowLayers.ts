import type { CfgLayer, LayerInfo, LayerType, LayerValue } from "../../../shared/types";

export type Mode = "itr" | "var";

export interface RowLayer {
  layerIndex: number;
  rowKey: string;
  type: LayerType;
  name: string;
  fillPath: string;
  // The layer's real current AE state at the time of the last Refresh —
  // color/font/text-content/video-effect values read straight off the
  // layer, not anything the user has typed. Used as the fallback default
  // everywhere a row has no stored per-iteration value yet, mirroring
  // main.js's buildColorRow/buildVideoRow, which pre-fill every DOM input
  // with the layer's live values at render time.
  liveValue?: LayerValue;
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
      rows.push({
        layerIndex: layer.index,
        rowKey: String(layer.index),
        type: "shape",
        name: layer.name,
        fillPath,
        liveValue: layer.fills && layer.fills.length ? { color: layer.fills[0].color } : undefined,
      });
      (layer.strokes || []).forEach((stroke, i) => {
        rows.push({
          layerIndex: layer.index,
          rowKey: `${layer.index}:stroke:${i}`,
          type: "stroke",
          name: `Stroke — ${layer.name}`,
          fillPath: stroke.path,
          liveValue: { color: stroke.color },
        });
      });
    } else {
      const effectiveType: LayerType = layer.type === "video" && mode === "var" ? "media" : layer.type;
      rows.push({
        layerIndex: layer.index,
        rowKey: String(layer.index),
        type: effectiveType,
        name: layer.name,
        fillPath: "",
        liveValue: buildLiveValue(layer, effectiveType),
      });
    }
  }
  return rows;
}

function buildLiveValue(layer: LayerInfo, effectiveType: LayerType): LayerValue | undefined {
  if (effectiveType === "text") {
    return { color: layer.color ?? null, font: layer.font ?? null, content: layer.text ?? null };
  }
  if (effectiveType === "video" && layer.videoState) {
    return {
      flip: layer.videoState.flip,
      bw: layer.videoState.bw,
      tint: layer.videoState.tint,
      tintAmount: layer.videoState.tintAmount,
      hue: layer.videoState.hue,
    };
  }
  return undefined;
}

// Builds the CfgLayer[] the host's previewApply/run commands expect, in the
// same order as `rows` (and thus the same order the caller must zip its
// per-iteration values array against).
export function toCfgLayers(rows: RowLayer[]): CfgLayer[] {
  return rows.map((r) => ({ index: r.layerIndex, name: r.name, fillPath: r.fillPath, layerType: r.type }));
}
