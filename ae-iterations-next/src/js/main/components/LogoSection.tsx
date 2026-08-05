import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { LogoPickerGrid } from "./LogoPickerGrid";
import { PositionPickerPopup } from "./PositionPickerPopup";

export function LogoSection() {
  const {
    compName, logoPath, logoX, logoY, logoSize,
    setLogoPath, setLogoX, setLogoY, setLogoSize,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, logoPath: s.logoPath, logoX: s.logoX, logoY: s.logoY, logoSize: s.logoSize,
      setLogoPath: s.setLogoPath, setLogoX: s.setLogoX, setLogoY: s.setLogoY, setLogoSize: s.setLogoSize,
    }))
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div id="logo-section">
      <LogoPickerGrid onSelect={setLogoPath} selectedPath={logoPath ?? undefined} />
      <div className="emoji-fields-row">
        <div className="emoji-field emoji-field-position">
          <label className="emoji-field-label">Position</label>
          <div className="emoji-position-group">
            <span className="emoji-axis">X</span>
            <input type="number" value={logoX} onChange={(e) => setLogoX(parseInt(e.target.value, 10) || 0)} />
            <span className="emoji-position-sep" />
            <span className="emoji-axis">Y</span>
            <input type="number" value={logoY} onChange={(e) => setLogoY(parseInt(e.target.value, 10) || 0)} />
          </div>
        </div>
        <div className="emoji-field emoji-field-size">
          <label className="emoji-field-label">Size</label>
          <input type="number" value={logoSize} onChange={(e) => setLogoSize(parseInt(e.target.value, 10) || 100)} />
        </div>
      </div>
      <button
        className="video-toggle"
        disabled={!compName}
        title={compName ? "Position visually" : "Refresh a layer first"}
        onClick={() => setPickerOpen(true)}
      >
        Position visually…
      </button>
      {pickerOpen && (
        <PositionPickerPopup
          compName={compName}
          x={logoX}
          y={logoY}
          markerKind="logo"
          onChange={(nx, ny) => {
            setLogoX(nx);
            setLogoY(ny);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
