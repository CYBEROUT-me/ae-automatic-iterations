import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { hexToRgb, rgbToHex } from "../lib/color";
import { PositionPickerPopup } from "./PositionPickerPopup";

export function BadgeSection() {
  const {
    compName, count, badgeTexts, badgeX, badgeY, badgeSize, badgeCircleColor, badgeTextColor, badgeLayerIndex,
    setBadgeText, setBadgeX, setBadgeY, setBadgeSize, setBadgeCircleColor, setBadgeTextColor, setBadgeLayerIndex,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, count: s.count, badgeTexts: s.badgeTexts, badgeX: s.badgeX, badgeY: s.badgeY,
      badgeSize: s.badgeSize, badgeCircleColor: s.badgeCircleColor, badgeTextColor: s.badgeTextColor,
      badgeLayerIndex: s.badgeLayerIndex,
      setBadgeText: s.setBadgeText, setBadgeX: s.setBadgeX, setBadgeY: s.setBadgeY, setBadgeSize: s.setBadgeSize,
      setBadgeCircleColor: s.setBadgeCircleColor, setBadgeTextColor: s.setBadgeTextColor,
      setBadgeLayerIndex: s.setBadgeLayerIndex,
    }))
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div id="badge-section">
      <div className="emoji-fields-row">
        <div className="emoji-field emoji-field-position">
          <label className="emoji-field-label">Position</label>
          <div className="emoji-position-group">
            <span className="emoji-axis">X</span>
            <input type="number" value={badgeX} onChange={(e) => setBadgeX(parseInt(e.target.value, 10) || 0)} />
            <span className="emoji-position-sep" />
            <span className="emoji-axis">Y</span>
            <input type="number" value={badgeY} onChange={(e) => setBadgeY(parseInt(e.target.value, 10) || 0)} />
          </div>
        </div>
        <div className="emoji-field emoji-field-size">
          <label className="emoji-field-label">Size</label>
          <input type="number" value={badgeSize} onChange={(e) => setBadgeSize(parseInt(e.target.value, 10) || 100)} />
        </div>
      </div>
      <div className="overlay-color-row">
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
        <button className="video-toggle" title="Position visually" onClick={() => setPickerOpen(true)}>
          Position visually…
        </button>
      </div>
      <div className="emoji-layer-row">
        <span className="emoji-layer-label">Attach to layer</span>
        <input
          className="emoji-layer-input"
          type="number"
          value={badgeLayerIndex}
          onChange={(e) => setBadgeLayerIndex(parseInt(e.target.value, 10) || 0)}
        />
      </div>
      <div id="emoji-iter-rows">
        {Array.from({ length: count }, (_, iter) => (
          <div key={iter} className="badge-iter-row">
            <span className="emoji-iter-num">{iter + 1}</span>
            <input
              type="text"
              className="badge-text-input"
              placeholder="Badge text"
              value={badgeTexts[iter] ?? ""}
              onChange={(e) => setBadgeText(iter, e.target.value || null)}
            />
          </div>
        ))}
      </div>
      {pickerOpen && (
        <PositionPickerPopup
          compName={compName}
          x={badgeX}
          y={badgeY}
          overlay={{
            kind: "badge",
            text: badgeTexts.find((t) => !!t) || "25",
            size: badgeSize,
            circleColor: badgeCircleColor,
            textColor: badgeTextColor,
          }}
          onChange={(nx, ny) => {
            setBadgeX(nx);
            setBadgeY(ny);
          }}
          onSizeChange={setBadgeSize}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
