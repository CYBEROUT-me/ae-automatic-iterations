// "Attach to layer" as a list of real layer names rather than a bare
// number. The index alone is meaningless while configuring an overlay --
// working out what "2" pointed at, and why an overlay landed somewhere
// unexpected, was a recurring source of confusion.
//
// Still stores the index (that's what the host resolves against); the name
// is purely what the user picks by. Degrades to the original number input
// whenever the layer list can't be resolved -- no comp open yet, a project
// that doesn't follow the naming convention, or a host call that fails --
// so this can never become a dead end that blocks configuring an overlay.
//
// Two modes: given a `layers` prop it renders only the field (the caller
// already knows and displays which comp they came from — OverlaysCard shows
// it once for both overlays instead of printing the identical comp name
// under each). Without the prop it fetches its own list and names the comp
// itself, which is how EmojiSection uses it standalone in ITR mode.

import { useEffect, useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS } from "../../lib/utils/bolt";

export interface OverlayLayer {
  index: number;
  name: string;
}

export interface OverlayLayersInfo {
  compName: string;
  layers: OverlayLayer[];
  candidates: string[];
}

// Shared by LayerPicker's standalone mode and by OverlaysCard, which needs
// the same data to name the comp once at card level.
export function useOverlayLayers(): OverlayLayersInfo {
  const { mode, compName } = useAppStore(useShallow((s) => ({ mode: s.mode, compName: s.compName })));
  const [info, setInfo] = useState<OverlayLayersInfo>({ compName: "", layers: [], candidates: [] });

  // Re-fetches when the mode changes (different target comp) and when
  // compName changes, which is the panel's signal that the user just hit
  // Refresh and the project may have moved on.
  useEffect(() => {
    let stale = false;
    evalTS("listOverlayLayers", mode)
      .then((res) => {
        if (stale) return;
        setInfo({ compName: res.compName || "", layers: res.layers || [], candidates: res.candidates || [] });
      })
      .catch(() => {
        if (!stale) setInfo({ compName: "", layers: [], candidates: [] });
      });
    return () => {
      stale = true;
    };
  }, [mode, compName]);

  return info;
}

export function LayerPicker({
  value,
  onChange,
  layers: provided,
}: {
  value: number;
  onChange: (v: number) => void;
  layers?: OverlayLayer[];
}) {
  const own = useOverlayLayers();
  const layers = provided ?? own.layers;
  // Only the standalone form names its own comp; when the caller supplied
  // the list, it is showing that itself.
  const showSource = provided === undefined;

  if (!layers.length) {
    return (
      <div className="emoji-layer-row">
        <span className="emoji-layer-label">Attach to layer</span>
        <input
          className="emoji-layer-input"
          type="number"
          title="No layer list available — enter an index"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        />
      </div>
    );
  }

  // A stored index that no longer matches a layer (project changed since
  // it was set, or it came from a restored session) would otherwise leave
  // the select showing an unrelated entry — surface it instead.
  const known = layers.filter((l) => l.index === value).length > 0;

  return (
    <>
      <div className="emoji-layer-row">
        <span className="emoji-layer-label">Attach to layer</span>
        <select
          className="layer-picker-select"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        >
          <option value={0}>Top of stack</option>
          {layers.map((l) => (
            <option key={l.index} value={l.index}>
              {l.index} — {l.name}
            </option>
          ))}
          {value > 0 && !known && <option value={value}>{value} — (no such layer)</option>}
        </select>
      </div>
      {showSource && own.compName && (
        <div className="layer-picker-source" title={own.compName}>
          in {own.compName}
        </div>
      )}
      {showSource && own.candidates.length > 1 && (
        <div className="layer-picker-warn">
          {own.candidates.length} comps match this pattern — using the one above
        </div>
      )}
    </>
  );
}
