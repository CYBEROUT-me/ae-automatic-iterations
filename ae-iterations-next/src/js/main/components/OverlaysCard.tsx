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
import { Badge, Image, Move, ChevronRight } from "lucide-react";

export function OverlaysCard() {
  const { badgeEnabled, setBadgeEnabled, logoEnabled, setLogoEnabled, badgeSize, badgeLayerIndex, logoSize, logoLayerIndex, logoPath } =
    useAppStore(
      useShallow((s) => ({
        badgeEnabled: s.badgeEnabled,
        setBadgeEnabled: s.setBadgeEnabled,
        logoEnabled: s.logoEnabled,
        setLogoEnabled: s.setLogoEnabled,
        badgeSize: s.badgeSize,
        badgeLayerIndex: s.badgeLayerIndex,
        logoSize: s.logoSize,
        logoLayerIndex: s.logoLayerIndex,
        logoPath: s.logoPath,
      }))
    );
  const [pickerFocus, setPickerFocus] = useState<OverlayKind | null>(null);
  // Each overlay's settings are set once per job and then never touched,
  // but they occupied ~450px permanently. Collapsed by default with a
  // summary of the values, so what stays on screen is what actually gets
  // edited repeatedly: the per-variation rows and Run.
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [logoOpen, setLogoOpen] = useState(false);

  const layerLabel = (i: number) => (i > 0 ? `layer ${i}` : "top of stack");
  const fileLabel = (p: string | null) => (p ? p.split("/").pop() : "no logo chosen");
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
          {badgeEnabled && (
            <button
              className={"overlay-summary" + (badgeOpen ? " open" : "")}
              title={badgeOpen ? "Hide badge settings" : "Show badge settings"}
              aria-expanded={badgeOpen}
              onClick={() => setBadgeOpen(!badgeOpen)}
            >
              <ChevronRight />
              {badgeOpen ? "settings" : `${badgeSize} · ${layerLabel(badgeLayerIndex)}`}
            </button>
          )}
        </div>
        <button
          className={"settings-switch" + (badgeEnabled ? " on" : "")}
          role="switch"
          aria-checked={badgeEnabled}
          title="Badge overlay"
          onClick={() => setBadgeEnabled(!badgeEnabled)}
        />
      </div>
      {badgeEnabled && badgeOpen && <BadgeSection layers={layerInfo.layers} />}

      <div className="settings-divider" />

      <div className="settings-row">
        <div className="settings-row-label">
          <Image />
          Logo overlay
          {logoEnabled && (
            <button
              className={"overlay-summary" + (logoOpen ? " open" : "")}
              title={logoOpen ? "Hide logo settings" : "Show logo settings"}
              aria-expanded={logoOpen}
              onClick={() => setLogoOpen(!logoOpen)}
            >
              <ChevronRight />
              {logoOpen ? "settings" : `${fileLabel(logoPath)} · ${logoSize} · ${layerLabel(logoLayerIndex)}`}
            </button>
          )}
        </div>
        <button
          className={"settings-switch" + (logoEnabled ? " on" : "")}
          role="switch"
          aria-checked={logoEnabled}
          title="Logo overlay"
          onClick={() => setLogoEnabled(!logoEnabled)}
        />
      </div>
      {logoEnabled && logoOpen && <LogoSection layers={layerInfo.layers} />}

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
