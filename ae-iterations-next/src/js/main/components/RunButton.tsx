import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { toCfgLayers } from "../state/rowLayers";
import { evalTS } from "../../lib/utils/bolt";
import { Play } from "lucide-react";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue, RunResult } from "../../../shared/types";

type StatusKind = "idle" | "running" | "done" | "warning" | "error";

export function RunButton({ effectiveValue }: { effectiveValue: (row: RowLayer, iter: number) => LayerValue }) {
  const {
    compName, rowLayers, count, mode, varNames,
    emojiEnabled, emojiPaths, emojiX, emojiY, emojiSize, emojiLayerIndex,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, rowLayers: s.rowLayers, count: s.count, mode: s.mode, varNames: s.varNames,
      emojiEnabled: s.emojiEnabled, emojiPaths: s.emojiPaths, emojiX: s.emojiX, emojiY: s.emojiY,
      emojiSize: s.emojiSize, emojiLayerIndex: s.emojiLayerIndex,
    }))
  );
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");

  const emojiOnly = mode === "itr" && emojiEnabled;

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
    if (!compName && !emojiOnly) {
      setStatus("Refresh a layer first.");
      setStatusKind("error");
      return;
    }
    const layers = toCfgLayers(rowLayers);
    const values = Array.from({ length: count }, (_, iter) => rowLayers.map((r) => effectiveValue(r, iter)));

    if (mode === "var") {
      setStatus("Running VAR…");
      setStatusKind("running");
      const names = Array.from({ length: count }, (_, i) => varNames[i] || `VAR${i + 1}`);
      evalTS("runVarIterations", { compName: compName || "", layers, values, count, varNames: names })
        .then((res) => handleResult(res, "variants"))
        .catch(handleError);
    } else {
      setStatus("Running…");
      setStatusKind("running");
      const emoji = {
        enabled: emojiEnabled,
        perIteration: Array.from({ length: count }, (_, i) => emojiPaths[i] ?? null),
        x: emojiX,
        y: emojiY,
        size: emojiSize,
        layerIndex: emojiLayerIndex,
      };
      evalTS("runIterations", { compName: compName || "", layers, values, count, emoji })
        .then((res) => handleResult(res, "iterations"))
        .catch(handleError);
    }
  };

  return (
    <div id="run-section">
      <button id="btn-run" onClick={run} disabled={!compName && !emojiOnly}>
        <Play />
        {mode === "var" ? "Run VAR" : "Run Iterations"}
      </button>
      {status && <div id="status" className={`status-${statusKind}`}>{status}</div>}
    </div>
  );
}
