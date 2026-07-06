import { useAppStore } from "../state/store";
import { evalTS } from "../../lib/utils/bolt";
import { IterationRow } from "./IterationRow";
import { toCfgLayers } from "../state/rowLayers";

export function LayerInfoPanel() {
  const { compName, rowLayers, count, values, setLayerInfo } = useAppStore((s) => ({
    compName: s.compName,
    rowLayers: s.rowLayers,
    count: s.count,
    values: s.values,
    setLayerInfo: s.setLayerInfo,
  }));

  const refresh = () => {
    evalTS("getLayerInfo")
      .then((res) => setLayerInfo(res.compName, res.layers))
      .catch((err) => alert("Refresh failed: " + String(err)));
  };

  // Applies one iteration's values live to the target comp, so the artist
  // can eyeball a column of values in AE before committing to a full run.
  const previewIteration = (iter: number) => {
    if (!compName) return;
    const layers = toCfgLayers(rowLayers);
    const iterValues = rowLayers.map((r) => values[r.rowKey]?.[iter] ?? {});
    evalTS("previewApply", { compName, layers, values: iterValues })
      .then((res) => console.log(res.log.join("\n")))
      .catch((err) => alert("Preview failed: " + String(err)));
  };

  return (
    <div id="layer-section">
      <div id="layer-info">{compName ? `${compName} — ${rowLayers.length} row(s)` : "No layer selected"}</div>
      <button onClick={refresh}>Refresh Layer</button>
      {rowLayers.length > 0 && (
        <div id="preview-row">
          {Array.from({ length: count }, (_, iter) => (
            <button key={iter} className="preview-btn" onClick={() => previewIteration(iter)}>
              Preview {iter + 1}
            </button>
          ))}
        </div>
      )}
      {rowLayers.map((row) => (
        <div key={row.rowKey} className="extra-layer-group">
          <div className="layer-group-label">{row.name} [{row.type}]</div>
          {Array.from({ length: count }, (_, iter) => (
            <IterationRow key={iter} row={row} iter={iter} />
          ))}
        </div>
      ))}
    </div>
  );
}
