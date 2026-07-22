import type { LayerValue } from "../../../shared/types";
import type { Mode, RowLayer } from "./rowLayers";

// Resolves a row's actual value for one iteration: the user's own edit if
// present, otherwise the layer's live AE state captured at the last
// Refresh (row.liveValue), otherwise an empty object. This fallback chain
// is what lets Preview/Run act correctly on a row the user has never
// touched — mirroring main.js's DOM inputs, which are always pre-filled
// with real values at render time and therefore never read as empty.
function ownOrDefault(row: RowLayer, values: Record<string, LayerValue[]>, iter: number): LayerValue {
  return values[row.rowKey]?.[iter] ?? row.liveValue ?? {};
}

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
): LayerValue {
  const own = ownOrDefault(row, values, iter);
  if (mode === "var" || !sameForAll || row.type === "stroke" || row.type === "video") return own;
  const first = rowLayers[0];
  if (!first || row.layerIndex === first.layerIndex) return own;
  const firstVal = ownOrDefault(first, values, iter);
  // If the row we'd borrow from has nothing real to lend (no stored edit AND
  // no live color), fall back to this row's own value instead of borrowing
  // an empty color — preserves the pre-existing "don't blank out a row over
  // an empty source" guard now that ownOrDefault almost never returns a bare
  // undefined.
  if (firstVal.color == null) return own;
  return row.type === "text" ? { color: firstVal.color, font: firstVal.font } : { color: firstVal.color };
}
