import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { LogoPickerGrid } from "./LogoPickerGrid";
import { PositionPickerPopup } from "./PositionPickerPopup";
import { LayerPicker } from "./LayerPicker";

export function LogoSection() {
  const {
    compName, count, logoPath, logoX, logoY, logoSize, logoLayerIndex, logoPerIteration,
    setLogoPath, setLogoX, setLogoY, setLogoSize, setLogoLayerIndex, setLogoPerIteration,
  } = useAppStore(
    useShallow((s) => ({
      compName: s.compName, count: s.count, logoPath: s.logoPath, logoX: s.logoX, logoY: s.logoY, logoSize: s.logoSize,
      logoLayerIndex: s.logoLayerIndex, logoPerIteration: s.logoPerIteration,
      setLogoPath: s.setLogoPath, setLogoX: s.setLogoX, setLogoY: s.setLogoY, setLogoSize: s.setLogoSize,
      setLogoLayerIndex: s.setLogoLayerIndex, setLogoPerIteration: s.setLogoPerIteration,
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
      <button className="video-toggle" title="Position visually" onClick={() => setPickerOpen(true)}>
        Position visually…
      </button>
      <LayerPicker value={logoLayerIndex} onChange={setLogoLayerIndex} />
      <div id="emoji-iter-rows">
        {Array.from({ length: count }, (_, iter) => (
          <div key={iter} className="badge-iter-row">
            <span className="emoji-iter-num">{iter + 1}</span>
            <label className="logo-iter-toggle">
              <input
                type="checkbox"
                checked={logoPerIteration[iter] ?? true}
                onChange={(e) => setLogoPerIteration(iter, e.target.checked)}
              />
              Apply logo
            </label>
          </div>
        ))}
      </div>
      {pickerOpen && (
        <PositionPickerPopup
          compName={compName}
          x={logoX}
          y={logoY}
          overlay={{ kind: "logo", size: logoSize, imagePath: logoPath }}
          onChange={(nx, ny) => {
            setLogoX(nx);
            setLogoY(ny);
          }}
          onSizeChange={setLogoSize}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
