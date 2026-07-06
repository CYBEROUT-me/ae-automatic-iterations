// Ported from extension/jsx/host.jsx's applyLayerValue (lines 65-101) —
// per-layer-type dispatch that applies one iteration's value to one layer.
// The "media" branch from the original is out of scope for this plan (no
// media-layer feature yet), and the emoji-removal call that wrapped the
// original's call site is likewise out of scope.

import { applyShapeColor, applyShapeStrokeColor, applyTextColor, applyTextContent, applyTextFont } from "./applyChange";
import { applyVideoLayer } from "./applyVideo";
import type { CfgLayer, LayerValue } from "../../../shared/types";

export function applyLayerValue(layer: any, lc: CfgLayer, val: LayerValue): string[] {
  const log: string[] = [];
  if (lc.layerType === "shape") {
    const ok = applyShapeColor(layer, lc.fillPath, val.color as [number, number, number]);
    log.push("→ shapeColor: " + (ok ? "OK" : "FAILED"));
  } else if (lc.layerType === "stroke") {
    const ok = applyShapeStrokeColor(layer, lc.fillPath, val.color as [number, number, number]);
    log.push("→ strokeColor: " + (ok ? "OK" : "FAILED"));
  } else if (lc.layerType === "video") {
    const ok = applyVideoLayer(layer, {
      flip: !!val.flip, bw: !!val.bw, tint: val.tint ?? null, tintAmount: val.tintAmount, hue: val.hue ?? 0,
    });
    log.push("→ videoEffects: " + (ok ? "OK" : "FAILED"));
  } else if (lc.layerType === "text") {
    if (val.content) log.push("→ textContent: " + (applyTextContent(layer, val.content) ? "OK" : "FAILED"));
    if (val.color) log.push("→ textColor: " + (applyTextColor(layer, val.color as [number, number, number]) ? "OK" : "FAILED"));
    if (val.font) log.push("→ textFont: " + (applyTextFont(layer, val.font) ? "OK" : "FAILED"));
    if (!val.content && !val.color && !val.font) log.push("→ nothing to apply (no content, no color, no font)");
  } else {
    log.push("→ skipped (unsupported type: " + lc.layerType + ")");
  }
  return log;
}

// Pure helper: pulls the FAILED lines out of an applyLayerValue log so callers
// (e.g. runIterationBatch) can surface them as warnings instead of silently
// discarding the log. Kept separate from applyLayerValue so it's unit-testable
// without the After Effects object model.
export function applyLayerValueFailures(log: string[]): string[] {
  return log.filter((line) => /FAILED/.test(line));
}
