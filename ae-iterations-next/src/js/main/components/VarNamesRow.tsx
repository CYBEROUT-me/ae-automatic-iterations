import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { Play } from "lucide-react";

// Preview button lives here, not just on rowLayers' IterationRow: VAR's
// badge/logo overlays don't require any layer to be selected/refreshed at
// all (they apply independently of cfg.layers), but IterationRow is only
// rendered per rowLayers row -- with zero rows there'd be no Preview button
// anywhere in the panel. This row already iterates per-variant (by count),
// independent of rowLayers, so it's the natural place for an overlay-only
// preview trigger.
export function VarNamesRow({ onPreview }: { onPreview: (iter: number) => void }) {
  const { count, varNames, setVarName } = useAppStore(
    useShallow((s) => ({ count: s.count, varNames: s.varNames, setVarName: s.setVarName }))
  );

  return (
    <div id="var-names-row">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="var-field">
          <div className="var-field-label">
            <span className="var-field-num">{i + 1}</span>
            Variant name
          </div>
          <div className="var-field-input-row">
            <input
              type="text"
              placeholder={`Name ${i + 1}`}
              value={varNames[i] ?? ""}
              onChange={(e) => setVarName(i, e.target.value)}
            />
            <button className="row-action" title={`Preview variant ${i + 1}`} onClick={() => onPreview(i)}>
              <Play />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
