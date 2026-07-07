import type { LayerValue } from "../../../shared/types";
import type { Mode, RowLayer } from "./rowLayers";

// Effective value used for rendering/reading a non-first, non-stroke, non-video row
// when sameForAll is on — mirrors main.js's buildValues() sameForAll branch.
//
// VAR mode is an unconditional bypass, same tier as the stroke/video exclusion:
// the original extension hides the "same value for all layers" checkbox entirely
// in VAR mode (main.js's switchMode), so VAR mode never borrows across layers
// regardless of any stored sameForAll state.
export function effectiveValue(
  rowLayers: RowLayer[],
  values: Record<string, LayerValue[]>,
  sameForAll: boolean,
  row: RowLayer,
  iter: number,
  mode: Mode
): LayerValue | undefined {
  const own = values[row.rowKey]?.[iter];
  if (mode === "var" || !sameForAll || row.type === "stroke" || row.type === "video") return own;
  const first = rowLayers[0];
  if (!first || row.layerIndex === first.layerIndex) return own;
  const firstVal = values[first.rowKey]?.[iter];
  if (!firstVal) return own;
  return row.type === "text" ? { color: firstVal.color, font: firstVal.font } : { color: firstVal.color };
}
