import { useEffect, useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS } from "../../lib/utils/bolt";
import { IterationRow } from "./IterationRow";
import { toCfgLayers } from "../state/rowLayers";
import { RunButton } from "./RunButton";
import { VarNamesRow } from "./VarNamesRow";
import { EmojiSection } from "./EmojiSection";
import { ChangelogButton } from "./ChangelogButton";
import { effectiveValue as effectiveValueImpl } from "../state/effectiveValue";
import { loadFonts } from "../lib/fonts";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue } from "../../../shared/types";

export function LayerInfoPanel() {
  const { compName, rowLayers, count, setCount, values, sameForAll, setSameForAll, setLayerInfo, mode } = useAppStore(
    useShallow((s) => ({
      compName: s.compName,
      rowLayers: s.rowLayers,
      count: s.count,
      setCount: s.setCount,
      values: s.values,
      sameForAll: s.sameForAll,
      setSameForAll: s.setSameForAll,
      setLayerInfo: s.setLayerInfo,
      mode: s.mode,
    }))
  );

  const [testLog, setTestLog] = useState<string[] | null>(null);

  // Kicks off the font scan as soon as the panel mounts, in the background,
  // regardless of whether a text layer is currently selected — matching the
  // original extension's one-time startup loadFonts() call, so the list is
  // very likely already cached by the time a user focuses a font field.
  useEffect(() => {
    loadFonts();
  }, []);

  const refresh = () => {
    evalTS("getLayerInfo")
      .then((res) => setLayerInfo(res.compName, res.layers))
      .catch((err) => alert("Refresh failed: " + String(err)));
  };

  const testVarComps = () => {
    evalTS("testVarRenderComps")
      .then((res) => setTestLog(res.log))
      .catch((err) => setTestLog(["Test failed: " + String(err)]));
  };

  // Effective value used for rendering/reading a non-first, non-stroke, non-video row
  // when sameForAll is on — mirrors main.js's buildValues() sameForAll branch.
  const effectiveValue = (row: RowLayer, iter: number): LayerValue | undefined =>
    effectiveValueImpl(rowLayers, values, sameForAll, row, iter, mode);

  // Applies one iteration's values live to the target comp, so the artist
  // can eyeball a column of values in AE before committing to a full run.
  const previewIteration = (iter: number) => {
    if (!compName) return;
    const layers = toCfgLayers(rowLayers);
    const iterValues = rowLayers.map((r) => effectiveValue(r, iter) ?? {});
    evalTS("previewApply", { compName, layers, values: iterValues })
      .then((res) => console.log(res.log.join("\n")))
      .catch((err) => alert("Preview failed: " + String(err)));
  };

  const showSameForAll = new Set(rowLayers.map((r) => r.layerIndex)).size > 1;

  return (
    <div id="layer-section">
      <div id="layer-info">{compName ? `${compName} — ${rowLayers.length} row(s)` : "No layer selected"}</div>
      <button onClick={refresh}>Refresh Layer</button>
      <label id="count-label">
        Count
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 5))}
        />
      </label>
      {mode === "itr" && showSameForAll && (
        <label id="same-all-section">
          <input type="checkbox" checked={sameForAll} onChange={(e) => setSameForAll(e.target.checked)} />
          Same value for all layers
        </label>
      )}
      {mode === "itr" && rowLayers.length > 0 && (
        <div id="preview-row">
          {Array.from({ length: count }, (_, iter) => (
            <button key={iter} className="preview-btn" onClick={() => previewIteration(iter)}>
              Preview {iter + 1}
            </button>
          ))}
        </div>
      )}
      {mode === "itr" && <EmojiSection />}
      {mode === "var" && (
        <>
          <VarNamesRow />
          <button onClick={testVarComps}>Test</button>
          {testLog && <pre id="var-test-log">{testLog.join("\n")}</pre>}
        </>
      )}
      {rowLayers.map((row) => (
        <div key={row.rowKey} className="extra-layer-group">
          <div className="layer-group-label">{row.name} [{row.type}]</div>
          {Array.from({ length: count }, (_, iter) => (
            <IterationRow key={iter} row={row} iter={iter} />
          ))}
        </div>
      ))}
      <RunButton effectiveValue={effectiveValue} />
      <ChangelogButton />
    </div>
  );
}
