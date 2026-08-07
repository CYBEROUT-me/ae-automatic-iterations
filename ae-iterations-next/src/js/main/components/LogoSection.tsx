// Logo's own settings only — see BadgeSection.tsx's header for why
// positioning and the per-variation rows moved to OverlaysCard.

import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { LogoPickerGrid } from "./LogoPickerGrid";
import { LayerPicker } from "./LayerPicker";
import { ChevronRight } from "lucide-react";

export function LogoSection() {
  const { logoPath, logoX, logoY, logoSize, logoLayerIndex, setLogoPath, setLogoX, setLogoY, setLogoSize, setLogoLayerIndex } =
    useAppStore(
      useShallow((s) => ({
        logoPath: s.logoPath, logoX: s.logoX, logoY: s.logoY, logoSize: s.logoSize, logoLayerIndex: s.logoLayerIndex,
        setLogoPath: s.setLogoPath, setLogoX: s.setLogoX, setLogoY: s.setLogoY, setLogoSize: s.setLogoSize,
        setLogoLayerIndex: s.setLogoLayerIndex,
      }))
    );
  const [exactOpen, setExactOpen] = useState(false);

  return (
    <div id="logo-section" className="overlay-settings">
      <LogoPickerGrid onSelect={setLogoPath} selectedPath={logoPath ?? undefined} />

      <div className="overlay-settings-row">
        <label className="overlay-field">
          <span className="overlay-field-label">Size</span>
          <input type="number" value={logoSize} onChange={(e) => setLogoSize(parseInt(e.target.value, 10) || 100)} />
        </label>
      </div>

      <LayerPicker value={logoLayerIndex} onChange={setLogoLayerIndex} />

      <button
        className={"overlay-exact-toggle" + (exactOpen ? " open" : "")}
        onClick={() => setExactOpen(!exactOpen)}
      >
        <ChevronRight /> Exact position
      </button>
      {exactOpen && (
        <div className="overlay-exact-row">
          <span className="emoji-axis">X</span>
          <input type="number" value={logoX} onChange={(e) => setLogoX(parseInt(e.target.value, 10) || 0)} />
          <span className="emoji-axis">Y</span>
          <input type="number" value={logoY} onChange={(e) => setLogoY(parseInt(e.target.value, 10) || 0)} />
        </div>
      )}
    </div>
  );
}
