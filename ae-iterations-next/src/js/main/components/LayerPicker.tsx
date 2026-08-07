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

import { useEffect, useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS } from "../../lib/utils/bolt";

interface OverlayLayer {
  index: number;
  name: string;
}

export function LayerPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { mode, compName } = useAppStore(useShallow((s) => ({ mode: s.mode, compName: s.compName })));
  const [layers, setLayers] = useState<OverlayLayer[]>([]);
  const [targetComp, setTargetComp] = useState("");
  const [candidates, setCandidates] = useState<string[]>([]);

  // Re-fetches when the mode changes (different target comp) and when
  // compName changes, which is the panel's signal that the user just hit
  // Refresh and the project may have moved on.
  useEffect(() => {
    let stale = false;
    evalTS("listOverlayLayers", mode)
      .then((res) => {
        if (stale) return;
        setLayers(res.layers || []);
        setTargetComp(res.compName || "");
        setCandidates(res.candidates || []);
      })
      .catch(() => {
        if (!stale) setLayers([]);
      });
    return () => {
      stale = true;
    };
  }, [mode, compName]);

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
      {/* Named, not just a tooltip: more than one comp in a project can
          legitimately match the studio naming convention, so which one
          these layers came from has to be verifiable at a glance. */}
      {targetComp && (
        <div className="layer-picker-source" title={targetComp}>
          in {targetComp}
        </div>
      )}
      {/* Its own line rather than appended to the comp name: the comp name
          is long enough to ellipsize on a narrow panel, which was cutting
          the warning down to "2 comps ma…" — the one part that must stay
          readable. */}
      {candidates.length > 1 && (
        <div className="layer-picker-warn">
          {candidates.length} comps match this pattern — using the one above
        </div>
      )}
    </>
  );
}
