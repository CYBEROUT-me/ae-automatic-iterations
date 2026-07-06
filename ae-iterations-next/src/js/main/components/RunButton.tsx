import { useState } from "react";
import { useAppStore } from "../state/store";
import { toCfgLayers } from "../state/rowLayers";
import { evalTS } from "../../lib/utils/bolt";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue } from "../../../shared/types";

export function RunButton({ effectiveValue }: { effectiveValue: (row: RowLayer, iter: number) => LayerValue | undefined }) {
  const { compName, rowLayers, count } = useAppStore((s) => ({ compName: s.compName, rowLayers: s.rowLayers, count: s.count }));
  const [status, setStatus] = useState("");

  const run = () => {
    if (!compName) {
      setStatus("Refresh a layer first.");
      return;
    }
    const layers = toCfgLayers(rowLayers);
    const values = Array.from({ length: count }, (_, iter) => rowLayers.map((r) => effectiveValue(r, iter) ?? {}));
    setStatus("Running…");
    evalTS("runIterations", { compName, layers, values, count })
      .then((res) => setStatus(res.warnings.length ? `Done with warnings: ${res.warnings.join(" | ")}` : `Done — ${count} iterations complete.`))
      .catch((err) => setStatus("Error: " + String(err)));
  };

  return (
    <div id="run-section">
      <button id="btn-run" onClick={run} disabled={!compName}>Run Iterations</button>
      <div id="status">{status}</div>
    </div>
  );
}
