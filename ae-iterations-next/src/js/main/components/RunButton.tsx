import { useRef, useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { toCfgLayers } from "../state/rowLayers";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";
import { Play, X } from "lucide-react";
import { readRunProgress } from "../lib/runProgress";
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
  const [running, setRunning] = useState(false);
  // A ref, not state: the run loop reads this between every variant, and a
  // state value captured in that closure would never see the update.
  const cancelRef = useRef(false);

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

  // Drives the VAR run one variant at a time instead of handing the whole
  // batch to a single evalTS call. Three things fall out of that:
  //   * AE gets control back between variants instead of being pinned for
  //     the entire job;
  //   * each variant's warnings arrive as it finishes, not all at the end;
  //   * Cancel is possible at all — it just stops the loop.
  // Within a variant AE is still blocked (ExtendScript holds the main
  // thread), which is what the polled progress file is for: the panel is a
  // separate process, so it can keep reporting what that variant is doing.
  const runVarChunked = async (cfg: Record<string, unknown>) => {
    cancelRef.current = false;
    setRunning(true);
    setStatus("Preparing…");
    setStatusKind("running");

    const warnings: string[] = [];
    let poll: ReturnType<typeof setInterval> | null = null;
    let completed = 0;
    let total = 0;

    try {
      const begun = await evalTS("varRunBegin", cfg as never);
      total = begun.total;
      poll = setInterval(() => {
        const line = readRunProgress(begun.progressPath);
        if (line) setStatus(line);
      }, 300);

      for (let iter = 0; iter < total; iter++) {
        if (cancelRef.current) {
          warnings.push(`Cancelled after ${completed} of ${total} variants — the rest were not started.`);
          break;
        }
        const res = await evalTS("varRunStep", iter);
        for (const w of res.warnings) warnings.push(w);
        completed++;
      }
    } catch (err) {
      warnings.push("Run stopped: " + evalTSErrorMessage(err));
    } finally {
      if (poll) clearInterval(poll);
      // Always unwind, on every path — otherwise the temp project copy is
      // left behind and AE stays open on a variant rather than the
      // project the user started from.
      try {
        await evalTS("varRunEnd");
      } catch (e) {
        warnings.push("Cleanup after run failed: " + evalTSErrorMessage(e));
      }
      setRunning(false);
    }

    if (warnings.length) {
      setStatus(`Finished ${completed}/${total} — ${warnings.join(" | ")}`);
      setStatusKind("warning");
    } else {
      setStatus(`Done — ${completed} variant${completed === 1 ? "" : "s"} complete.`);
      setStatusKind("done");
    }
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
      runVarChunked({ compName: compName || "", layers, values, count, varNames: names, badge, logo });
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
      <div className="run-actions">
        <button id="btn-run" onClick={run} disabled={running || (!compName && !emojiOnly && !overlayOnly)}>
          <Play />
          {running ? "Running…" : mode === "var" ? "Run VAR" : "Run Iterations"}
        </button>
        {running && mode === "var" && (
          <button
            id="btn-cancel"
            title="Stop after the current variant finishes"
            onClick={() => {
              cancelRef.current = true;
              setStatus("Cancelling — finishing the current variant first…");
            }}
          >
            <X /> Cancel
          </button>
        )}
      </div>
      {status && <div id="status" className={`status-${statusKind}`}>{status}</div>}
    </div>
  );
}
