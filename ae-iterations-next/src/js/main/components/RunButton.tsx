import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { toCfgLayers } from "../state/rowLayers";
import { evalTS } from "../../lib/utils/bolt";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue } from "../../../shared/types";

type StatusKind = "idle" | "running" | "done" | "warning" | "error";

export function RunButton({ effectiveValue }: { effectiveValue: (row: RowLayer, iter: number) => LayerValue | undefined }) {
  const { compName, rowLayers, count } = useAppStore(
    useShallow((s) => ({ compName: s.compName, rowLayers: s.rowLayers, count: s.count }))
  );
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");

  const run = () => {
    if (!compName) {
      setStatus("Refresh a layer first.");
      setStatusKind("error");
      return;
    }
    const layers = toCfgLayers(rowLayers);
    const values = Array.from({ length: count }, (_, iter) => rowLayers.map((r) => effectiveValue(r, iter) ?? {}));
    setStatus("Running…");
    setStatusKind("running");
    evalTS("runIterations", { compName, layers, values, count })
      .then((res) => {
        if (res.warnings.length) {
          setStatus(`Done with warnings: ${res.warnings.join(" | ")}`);
          setStatusKind("warning");
        } else {
          setStatus(`Done — ${count} iterations complete.`);
          setStatusKind("done");
        }
      })
      .catch((err) => {
        setStatus("Error: " + String(err));
        setStatusKind("error");
      });
  };

  return (
    <div id="run-section">
      <button id="btn-run" onClick={run} disabled={!compName}>Run Iterations</button>
      {status && <div id="status" className={`status-${statusKind}`}>{status}</div>}
    </div>
  );
}
