import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { toCfgLayers } from "../state/rowLayers";
import { evalTS } from "../../lib/utils/bolt";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue, RunResult } from "../../../shared/types";

type StatusKind = "idle" | "running" | "done" | "warning" | "error";

export function RunButton({ effectiveValue }: { effectiveValue: (row: RowLayer, iter: number) => LayerValue | undefined }) {
  const { compName, rowLayers, count, mode, varNames } = useAppStore(
    useShallow((s) => ({ compName: s.compName, rowLayers: s.rowLayers, count: s.count, mode: s.mode, varNames: s.varNames }))
  );
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");

  const handleResult = (res: RunResult, noun: string) => {
    if (res.warnings.length) {
      setStatus(`Done with warnings: ${res.warnings.join(" | ")}`);
      setStatusKind("warning");
    } else {
      setStatus(`Done — ${count} ${noun} complete.`);
      setStatusKind("done");
    }
  };
  const handleError = (err: unknown) => {
    setStatus("Error: " + String(err));
    setStatusKind("error");
  };

  const run = () => {
    if (!compName) {
      setStatus("Refresh a layer first.");
      setStatusKind("error");
      return;
    }
    const layers = toCfgLayers(rowLayers);
    const values = Array.from({ length: count }, (_, iter) => rowLayers.map((r) => effectiveValue(r, iter) ?? {}));

    if (mode === "var") {
      setStatus("Running VAR…");
      setStatusKind("running");
      const names = Array.from({ length: count }, (_, i) => varNames[i] || `VAR${i + 1}`);
      evalTS("runVarIterations", { compName, layers, values, count, varNames: names })
        .then((res) => handleResult(res, "variants"))
        .catch(handleError);
    } else {
      setStatus("Running…");
      setStatusKind("running");
      evalTS("runIterations", { compName, layers, values, count })
        .then((res) => handleResult(res, "iterations"))
        .catch(handleError);
    }
  };

  return (
    <div id="run-section">
      <button id="btn-run" onClick={run} disabled={!compName}>
        {mode === "var" ? "Run VAR" : "Run Iterations"}
      </button>
      {status && <div id="status" className={`status-${statusKind}`}>{status}</div>}
    </div>
  );
}
