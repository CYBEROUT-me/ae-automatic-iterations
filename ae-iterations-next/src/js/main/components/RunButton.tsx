import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { toCfgLayers } from "../state/rowLayers";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";
import { Play } from "lucide-react";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue, RunResult } from "../../../shared/types";

type StatusKind = "idle" | "running" | "done" | "warning" | "error";

export function RunButton({ effectiveValue }: { effectiveValue: (row: RowLayer, iter: number) => LayerValue }) {
  const {
    compName, rowLayers, count, mode, varNames,
    emojiEnabled, emojiPaths, emojiX, emojiY, emojiSize, emojiLayerIndex,
    badgeEnabled, badgeTexts, badgeX, badgeY, badgeSize, badgeCircleColor, badgeTextColor, badgeLayerIndex,
    badgeEnabledPerIteration,
    logoEnabled, logoPath, logoX, logoY, logoSize, logoLayerIndex, logoPerIteration,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, rowLayers: s.rowLayers, count: s.count, mode: s.mode, varNames: s.varNames,
      emojiEnabled: s.emojiEnabled, emojiPaths: s.emojiPaths, emojiX: s.emojiX, emojiY: s.emojiY,
      emojiSize: s.emojiSize, emojiLayerIndex: s.emojiLayerIndex,
      badgeEnabled: s.badgeEnabled, badgeTexts: s.badgeTexts, badgeX: s.badgeX, badgeY: s.badgeY,
      badgeSize: s.badgeSize, badgeCircleColor: s.badgeCircleColor, badgeTextColor: s.badgeTextColor,
      badgeLayerIndex: s.badgeLayerIndex, badgeEnabledPerIteration: s.badgeEnabledPerIteration,
      logoEnabled: s.logoEnabled, logoPath: s.logoPath, logoX: s.logoX, logoY: s.logoY, logoSize: s.logoSize,
      logoLayerIndex: s.logoLayerIndex, logoPerIteration: s.logoPerIteration,
    }))
  );
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>("idle");

  const emojiOnly = mode === "itr" && emojiEnabled;
  // VAR mode's badge/logo overlays are independent of cfg.layers (they apply
  // to the 9x16 render comp directly), so a run with badge/logo enabled but
  // no layer ever selected/refreshed is a legitimate, supported workflow --
  // same reasoning as ITR's emojiOnly bypass above.
  const overlayOnly = mode === "var" && (badgeEnabled || logoEnabled);

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
    setStatus("Error: " + evalTSErrorMessage(err));
    setStatusKind("error");
  };

  const run = () => {
    if (!compName && !emojiOnly && !overlayOnly) {
      setStatus("Refresh a layer first.");
      setStatusKind("error");
      return;
    }
    const layers = toCfgLayers(rowLayers);
    const values = Array.from({ length: count }, (_, iter) => rowLayers.map((r) => effectiveValue(r, iter)));

    if (mode === "var") {
      const names = Array.from({ length: count }, (_, i) => varNames[i] || `VAR${i + 1}`);
      // Two variants sharing a name would silently overwrite each other's
      // project file and delivery folder within this single run (the host
      // side has no way to tell them apart) -- catch it here, before
      // anything runs, rather than after the damage is done.
      const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
      if (dupes.length) {
        setStatus(`Duplicate variant name${dupes.length > 1 ? "s" : ""}: ${dupes.join(", ")} — each variant needs a unique name.`);
        setStatusKind("error");
        return;
      }
      setStatus("Running VAR…");
      setStatusKind("running");
      const badge = {
        enabled: badgeEnabled,
        perIteration: Array.from({ length: count }, (_, i) => badgeTexts[i] ?? null),
        x: badgeX,
        y: badgeY,
        size: badgeSize,
        circleColor: badgeCircleColor,
        textColor: badgeTextColor,
        layerIndex: badgeLayerIndex,
        enabledPerIteration: Array.from({ length: count }, (_, i) => badgeEnabledPerIteration[i] ?? true),
      };
      const logo = {
        enabled: logoEnabled,
        path: logoPath,
        x: logoX,
        y: logoY,
        size: logoSize,
        layerIndex: logoLayerIndex,
        perIteration: Array.from({ length: count }, (_, i) => logoPerIteration[i] ?? true),
      };
      evalTS("runVarIterations", { compName: compName || "", layers, values, count, varNames: names, badge, logo })
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
      <button id="btn-run" onClick={run} disabled={!compName && !emojiOnly && !overlayOnly}>
        <Play />
        {mode === "var" ? "Run VAR" : "Run Iterations"}
      </button>
      {status && <div id="status" className={`status-${statusKind}`}>{status}</div>}
    </div>
  );
}
