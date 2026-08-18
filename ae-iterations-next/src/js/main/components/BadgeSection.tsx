// Badge's own settings only. Positioning (shared canvas) and the
// per-variation text/on-off rows (shared table) both live in OverlaysCard
// now, since neither makes sense to configure for one overlay in isolation.

import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { hexToRgb, rgbToHex } from "../lib/color";
import { LayerPicker } from "./LayerPicker";
import type { OverlayLayer } from "./LayerPicker";
import { ChevronRight } from "lucide-react";

// layers is supplied by OverlaysCard so both overlays share one fetch
// and one comp-name line instead of each printing the same thing.
export function BadgeSection({ layers }: { layers?: OverlayLayer[] } = {}) {
  const {
    badgeX, badgeY, badgeSize, badgeCircleColor, badgeTextColor, badgeLayerIndex,
    setBadgeX, setBadgeY, setBadgeSize, setBadgeCircleColor, setBadgeTextColor, setBadgeLayerIndex,
  } = useAppStore(
    useShallow((s) => ({
      badgeX: s.badgeX, badgeY: s.badgeY, badgeSize: s.badgeSize,
      badgeCircleColor: s.badgeCircleColor, badgeTextColor: s.badgeTextColor, badgeLayerIndex: s.badgeLayerIndex,
      setBadgeX: s.setBadgeX, setBadgeY: s.setBadgeY, setBadgeSize: s.setBadgeSize,
      setBadgeCircleColor: s.setBadgeCircleColor, setBadgeTextColor: s.setBadgeTextColor,
      setBadgeLayerIndex: s.setBadgeLayerIndex,
    }))
  );
  const [exactOpen, setExactOpen] = useState(false);

  return (
    <div id="badge-section" className="overlay-settings">
      <div className="overlay-settings-row">
        <label className="overlay-field">
          <span className="overlay-field-label">Size</span>
          <input
            type="number"
            value={badgeSize}
            onChange={(e) => setBadgeSize(parseInt(e.target.value, 10) || 100)}
          />
        </label>
        <label className="overlay-color-field">
          Circle
          <input
            type="color"
            value={rgbToHex(badgeCircleColor).toLowerCase()}
            onChange={(e) => setBadgeCircleColor(hexToRgb(e.target.value))}
          />
        </label>
        <label className="overlay-color-field">
          Text
          <input
            type="color"
            value={rgbToHex(badgeTextColor).toLowerCase()}
            onChange={(e) => setBadgeTextColor(hexToRgb(e.target.value))}
          />
        </label>
      </div>

      <LayerPicker value={badgeLayerIndex} onChange={setBadgeLayerIndex} layers={layers} />

      {/* Collapsed by default: placement is normally done on the canvas, but
          typing an exact value still matters for reproducing a position
          across jobs. */}
      <button
        className={"overlay-exact-toggle" + (exactOpen ? " open" : "")}
        onClick={() => setExactOpen(!exactOpen)}
      >
        <ChevronRight /> Exact position
      </button>
      {exactOpen && (
        <div className="overlay-exact-row">
          <span className="emoji-axis">X</span>
          <input type="number" value={badgeX} onChange={(e) => setBadgeX(parseInt(e.target.value, 10) || 0)} />
          <span className="emoji-axis">Y</span>
          <input type="number" value={badgeY} onChange={(e) => setBadgeY(parseInt(e.target.value, 10) || 0)} />
        </div>
      )}
    </div>
  );
}
