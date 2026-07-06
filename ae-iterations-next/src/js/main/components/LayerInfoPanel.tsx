import { useAppStore } from "../state/store";
import { evalTS } from "../../lib/utils/bolt";
import { IterationRow } from "./IterationRow";

export function LayerInfoPanel() {
  const { compName, rowLayers, count, setLayerInfo } = useAppStore((s) => ({
    compName: s.compName,
    rowLayers: s.rowLayers,
    count: s.count,
    setLayerInfo: s.setLayerInfo,
  }));

  const refresh = () => {
    evalTS("getLayerInfo")
      .then((res) => setLayerInfo(res.compName, res.layers))
      .catch((err) => alert("Refresh failed: " + String(err)));
  };

  return (
    <div id="layer-section">
      <div id="layer-info">{compName ? `${compName} — ${rowLayers.length} row(s)` : "No layer selected"}</div>
      <button onClick={refresh}>Refresh Layer</button>
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
