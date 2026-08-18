// Badge and Logo as one "Overlays" card rather than two independent
// sections. They share a canvas, share the comp they land in, and are
// almost always configured against each other — two parallel stacks with a
// "Position visually…" button each made that relationship invisible.
//
// Owns the one thing neither overlay can own alone: the shared position
// picker.

import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { BadgeSection } from "./BadgeSection";
import { LogoSection } from "./LogoSection";
import { OverlayIterationRows } from "./OverlayIterationRows";
import { PositionPickerPopup, type OverlayKind } from "./PositionPickerPopup";
import { useOverlayLayers } from "./LayerPicker";
import { Badge, Image, Move } from "lucide-react";

export function OverlaysCard() {
  const { badgeEnabled, setBadgeEnabled, logoEnabled, setLogoEnabled } = useAppStore(
    useShallow((s) => ({
      badgeEnabled: s.badgeEnabled,
      setBadgeEnabled: s.setBadgeEnabled,
      logoEnabled: s.logoEnabled,
      setLogoEnabled: s.setLogoEnabled,
    }))
  );
  const [pickerFocus, setPickerFocus] = useState<OverlayKind | null>(null);
  const anyEnabled = badgeEnabled || logoEnabled;
  // Fetched once here and shared with both overlays. Previously each
  // LayerPicker fetched its own copy and printed the same comp name under
  // itself, so the identical line appeared twice.
  const layerInfo = useOverlayLayers();

  return (
    <div className="settings-card">
      {anyEnabled && layerInfo.compName && (
        <div className="overlay-target-line" title={layerInfo.compName}>
          Overlays land in <strong>{layerInfo.compName}</strong>
        </div>
      )}
      {anyEnabled && layerInfo.candidates.length > 1 && (
        <div className="layer-picker-warn">
          {layerInfo.candidates.length} comps match this pattern — using the one above
        </div>
      )}
      <div className="settings-row">
        <div className="settings-row-label">
          <Badge />
          Badge overlay
        </div>
        <button
          className={"settings-switch" + (badgeEnabled ? " on" : "")}
          role="switch"
          aria-checked={badgeEnabled}
          title="Badge overlay"
          onClick={() => setBadgeEnabled(!badgeEnabled)}
        />
      </div>
      {badgeEnabled && <BadgeSection layers={layerInfo.layers} />}

      <div className="settings-divider" />

      <div className="settings-row">
        <div className="settings-row-label">
          <Image />
          Logo overlay
        </div>
        <button
          className={"settings-switch" + (logoEnabled ? " on" : "")}
          role="switch"
          aria-checked={logoEnabled}
          title="Logo overlay"
          onClick={() => setLogoEnabled(!logoEnabled)}
        />
      </div>
      {logoEnabled && <LogoSection layers={layerInfo.layers} />}

      {anyEnabled && (
        <>
          <div className="settings-divider" />
          {/* One button for both. The picker shows every enabled overlay on
              a single canvas; focus only decides which starts selected. */}
          <button
            className="overlay-position-btn"
            title="Position overlays on a preview of the comp"
            onClick={() => setPickerFocus(badgeEnabled ? "badge" : "logo")}
          >
            <Move /> Position visually…
          </button>
          <OverlayIterationRows />
        </>
      )}

      {pickerFocus && <PositionPickerPopup focus={pickerFocus} onClose={() => setPickerFocus(null)} />}
    </div>
  );
}
