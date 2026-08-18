import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { Play } from "lucide-react";

// One full-width field per variant, not a two-column grid. These are studio
// filenames ~50 characters long and the part that DIFFERS between variants
// is at the end — in two columns the field was 180px against 390px of
// content, so every name rendered as "LO_13148_8574_M0_S0_EI" and the only
// meaningful part was the part cut off.
//
// The per-row "Variant name" label is gone too: it appeared once per row
// with a numbered chip right beside it already saying the same thing. One
// heading covers the whole list.
//
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
      <div className="var-names-head">Variant names</div>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="var-row">
          <span className="var-field-num">{i + 1}</span>
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
      ))}
    </div>
  );
}
