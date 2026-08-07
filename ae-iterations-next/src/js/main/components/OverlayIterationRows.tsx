// One row per variation covering every enabled overlay, instead of a
// separate list per overlay. Answering "what does variation 3 actually
// get?" previously meant scrolling between two lists and counting rows in
// each to line them up.
//
// Columns appear only for enabled overlays, so with one overlay on this is
// no busier than the single list it replaces.

import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";

export function OverlayIterationRows() {
  const s = useAppStore(
    useShallow((st) => ({
      count: st.count,
      badgeEnabled: st.badgeEnabled,
      badgeTexts: st.badgeTexts,
      badgeEnabledPerIteration: st.badgeEnabledPerIteration,
      setBadgeText: st.setBadgeText,
      setBadgeEnabledPerIteration: st.setBadgeEnabledPerIteration,
      logoEnabled: st.logoEnabled,
      logoPerIteration: st.logoPerIteration,
      setLogoPerIteration: st.setLogoPerIteration,
      varNames: st.varNames,
    }))
  );

  if (!s.badgeEnabled && !s.logoEnabled) return null;

  return (
    <div className="overlay-iter-table">
      <div className="overlay-iter-head">
        <span className="overlay-iter-num" />
        {s.badgeEnabled && <span className="overlay-iter-badge-col">Badge text</span>}
        {s.logoEnabled && <span className="overlay-iter-logo-col">Logo</span>}
      </div>

      {Array.from({ length: s.count }, (_, iter) => (
        <div key={iter} className="overlay-iter-row">
          {/* The variant's own name when it has one — far easier to match
              against than a bare ordinal when checking a specific variant. */}
          <span className="overlay-iter-num" title={s.varNames[iter] || undefined}>
            {iter + 1}
          </span>

          {s.badgeEnabled && (
            <span className="overlay-iter-badge-col">
              <input
                type="checkbox"
                className="badge-iter-checkbox"
                title="Apply badge to this variation"
                checked={s.badgeEnabledPerIteration[iter] ?? true}
                onChange={(e) => s.setBadgeEnabledPerIteration(iter, e.target.checked)}
              />
              <input
                type="text"
                className="badge-text-input"
                placeholder="Badge text"
                value={s.badgeTexts[iter] ?? ""}
                onChange={(e) => s.setBadgeText(iter, e.target.value || null)}
              />
            </span>
          )}

          {s.logoEnabled && (
            <span className="overlay-iter-logo-col">
              <input
                type="checkbox"
                title="Apply logo to this variation"
                checked={s.logoPerIteration[iter] ?? true}
                onChange={(e) => s.setLogoPerIteration(iter, e.target.checked)}
              />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
