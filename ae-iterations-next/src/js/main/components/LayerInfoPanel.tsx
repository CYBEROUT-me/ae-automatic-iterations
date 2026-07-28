import { useEffect, useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS } from "../../lib/utils/bolt";
import { IterationRow } from "./IterationRow";
import { toCfgLayers } from "../state/rowLayers";
import { RunButton } from "./RunButton";
import { VarNamesRow } from "./VarNamesRow";
import { EmojiSection } from "./EmojiSection";
import { PresetPanel } from "./PresetPanel";
import { ChangelogList } from "./ChangelogList";
import { effectiveValue as effectiveValueImpl } from "../state/effectiveValue";
import { loadFonts } from "../lib/fonts";
import type { RowLayer } from "../state/rowLayers";
import type { LayerValue } from "../../../shared/types";
import { RefreshCw, Plus, ChevronUp, ChevronDown, Smile, Star, ChevronRight, Info } from "lucide-react";

export function LayerInfoPanel() {
  const {
    compName, rowLayers, count, setCount, values, sameForAll, setSameForAll, setLayerInfo, addLayerInfo, mode,
    emojiEnabled, setEmojiEnabled,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName,
      rowLayers: s.rowLayers,
      count: s.count,
      setCount: s.setCount,
      values: s.values,
      sameForAll: s.sameForAll,
      setSameForAll: s.setSameForAll,
      setLayerInfo: s.setLayerInfo,
      addLayerInfo: s.addLayerInfo,
      mode: s.mode,
      emojiEnabled: s.emojiEnabled,
      setEmojiEnabled: s.setEmojiEnabled,
    }))
  );

  const [testLog, setTestLog] = useState<string[] | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

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

  // Appends the currently selected AE layer(s) to the existing set instead
  // of replacing it, so building a multi-layer iteration set is: select a
  // layer, Add Layer, select the next one, Add Layer again — without
  // losing the per-iteration values already entered for the earlier ones.
  const addLayer = () => {
    evalTS("getLayerInfo")
      .then((res) => {
        if (compName && res.compName !== compName) {
          alert(`Selected layer is in "${res.compName}", but the current set is from "${compName}". Refresh instead to switch comps.`);
          return;
        }
        addLayerInfo(res.compName, res.layers);
      })
      .catch((err) => alert("Add layer failed: " + String(err)));
  };

  const testVarComps = () => {
    evalTS("testVarRenderComps")
      .then((res) => setTestLog(res.log))
      .catch((err) => setTestLog(["Test failed: " + String(err)]));
  };

  // Effective value used for rendering/reading a non-first, non-stroke, non-video row
  // when sameForAll is on — mirrors main.js's buildValues() sameForAll branch.
  const effectiveValue = (row: RowLayer, iter: number): LayerValue =>
    effectiveValueImpl(rowLayers, values, sameForAll, row, iter, mode);

  // Applies one iteration's values live to the target comp, so the artist
  // can eyeball a column of values in AE before committing to a full run.
  // Any row's Play action for iteration N calls this same function — preview
  // has always applied the whole iteration column across every row at once,
  // not a single row in isolation.
  const previewIteration = (iter: number) => {
    if (!compName) return;
    const layers = toCfgLayers(rowLayers);
    const iterValues = rowLayers.map((r) => effectiveValue(r, iter));
    evalTS("previewApply", { compName, layers, values: iterValues })
      .then((res) => console.log(res.log.join("\n")))
      .catch((err) => alert("Preview failed: " + String(err)));
  };

  const showSameForAll = new Set(rowLayers.map((r) => r.layerIndex)).size > 1;

  return (
    <div id="layer-section">
      <div className="icon-toolbar">
        <button className="icon-btn" title="Refresh layer selection" onClick={refresh}>
          <RefreshCw />
        </button>
        <button className="icon-btn labeled" title="Add layer to current set" onClick={addLayer}>
          <Plus /> Add Layer
        </button>
        <div className="toolbar-layername">{compName ? `${compName} — ${rowLayers.length} row(s)` : "No layer selected"}</div>
        <div className="count-field">
          <span>Count</span>
          <div className="stepper">
            <input
              type="number"
              min={1}
              value={count}
              onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 5))}
            />
            <div className="stepper-btns">
              <button className="stepper-btn" title="Increase count" onClick={() => setCount(count + 1)}>
                <ChevronUp />
              </button>
              <button className="stepper-btn" title="Decrease count" onClick={() => setCount(Math.max(1, count - 1))}>
                <ChevronDown />
              </button>
            </div>
          </div>
        </div>
        <button
          className={"icon-btn" + (changelogOpen ? " active-state" : "")}
          title="What's new"
          onClick={() => setChangelogOpen(!changelogOpen)}
        >
          <Info />
        </button>
      </div>
      {mode === "itr" && (
        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-label">
              <Smile />
              Emoji overlay
            </div>
            <button
              className={"settings-switch" + (emojiEnabled ? " on" : "")}
              role="switch"
              aria-checked={emojiEnabled}
              title="Emoji overlay"
              onClick={() => setEmojiEnabled(!emojiEnabled)}
            />
          </div>
          {emojiEnabled && <EmojiSection />}
          {/* Presets applies to rowLayers[0] — with nothing refreshed yet
              there's no row to apply it to, and Apply/Save were silently
              no-op-ing with zero feedback. Hiding the row until there's a
              row to target beats a preset gallery that looks interactive
              but does nothing. */}
          {rowLayers.length > 0 && (
            <>
              <div className="settings-divider" />
              <div
                className={"settings-row settings-disclosure" + (presetsOpen ? " open" : "")}
                role="button"
                tabIndex={0}
                title="Presets"
                onClick={() => setPresetsOpen(!presetsOpen)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setPresetsOpen(!presetsOpen);
                }}
              >
                <div className="settings-row-label">
                  <Star />
                  Presets
                </div>
                <ChevronRight className="settings-chevron" />
              </div>
              {presetsOpen && <PresetPanel />}
            </>
          )}
        </div>
      )}
      {mode === "itr" && showSameForAll && (
        <label id="same-all-section">
          <input type="checkbox" checked={sameForAll} onChange={(e) => setSameForAll(e.target.checked)} />
          Same value for all layers
        </label>
      )}
      {changelogOpen && <ChangelogList />}
      {mode === "var" && (
        <>
          <VarNamesRow />
          <button className="var-test-btn" onClick={testVarComps}>Test</button>
          {testLog && <pre id="var-test-log">{testLog.join("\n")}</pre>}
        </>
      )}
      {rowLayers.map((row) => (
        <div key={row.rowKey} className="extra-layer-group">
          <div className="layer-group-label">{row.name} [{row.type}]</div>
          {Array.from({ length: count }, (_, iter) => (
            <IterationRow
              key={iter}
              row={row}
              iter={iter}
              onPreview={mode === "itr" ? () => previewIteration(iter) : undefined}
            />
          ))}
        </div>
      ))}
      <RunButton effectiveValue={effectiveValue} />
    </div>
  );
}
