import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";
import { rgbToHex } from "../lib/color";

const POPUP_WIDTH = 320;
const CORNER_MARGIN = 80; // comp pixels
const MIN_SIZE = 1; // percent
const SNAP_PX = 6; // screen pixels — how close before overlays align to each other

// Must match lib/applyBadge.ts's BASE_DIAMETER/BASE_FONT_SIZE exactly, so this
// preview's proportions match the real AE render. Duplicated rather than
// imported: applyBadge.ts targets the ExtendScript/host bundle, this file
// targets the panel's browser bundle -- they are not the same build.
const BASE_DIAMETER = 100;
const BASE_FONT_SIZE = 40;

interface FrameInfo {
  path: string;
  width: number;
  height: number;
}

export type OverlayKind = "badge" | "logo";

interface ActiveOverlay {
  kind: OverlayKind;
  x: number;
  y: number;
  size: number;
  setPos: (x: number, y: number) => void;
  setSize: (size: number) => void;
  text?: string;
  circleColor?: [number, number, number];
  textColor?: [number, number, number];
  imagePath?: string | null;
}

// One canvas for every enabled overlay, rather than a separate popup per
// overlay. Badge and logo routinely need to sit in a deliberate relationship
// to each other (same height, aligned edge), which is impossible to judge
// when each is positioned against a canvas that pretends the other doesn't
// exist. `focus` is just which one starts selected — whichever section's
// button opened the picker.
export function PositionPickerPopup({ focus, onClose }: { focus: OverlayKind; onClose: () => void }) {
  const s = useAppStore(
    useShallow((st) => ({
      compName: st.compName,
      badgeEnabled: st.badgeEnabled, badgeX: st.badgeX, badgeY: st.badgeY, badgeSize: st.badgeSize,
      badgeTexts: st.badgeTexts, badgeCircleColor: st.badgeCircleColor, badgeTextColor: st.badgeTextColor,
      setBadgeX: st.setBadgeX, setBadgeY: st.setBadgeY, setBadgeSize: st.setBadgeSize,
      logoEnabled: st.logoEnabled, logoPath: st.logoPath, logoX: st.logoX, logoY: st.logoY, logoSize: st.logoSize,
      setLogoX: st.setLogoX, setLogoY: st.setLogoY, setLogoSize: st.setLogoSize,
    }))
  );

  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust] = useState(() => Date.now());
  const [logoNatural, setLogoNatural] = useState<{ width: number; height: number } | null>(null);
  const [selected, setSelected] = useState<OverlayKind>(focus);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const canvasRef = useRef<HTMLDivElement>(null);
  // Records which overlay is being dragged and where the drag began, so
  // Shift can constrain to the axis the user actually moved along.
  const dragRef = useRef<{ kind: OverlayKind; startX: number; startY: number } | null>(null);
  const resizingRef = useRef<OverlayKind | null>(null);

  useEffect(() => {
    evalTS("renderPreviewFrame", s.compName ? { compName: s.compName } : undefined)
      .then((res) => setFrame(res))
      .catch((err) => setError(evalTSErrorMessage(err)));
  }, [s.compName]);

  useEffect(() => {
    setLogoNatural(null);
  }, [s.logoPath]);

  const overlays: ActiveOverlay[] = [];
  if (s.badgeEnabled) {
    overlays.push({
      kind: "badge",
      x: s.badgeX, y: s.badgeY, size: s.badgeSize,
      setPos: (nx, ny) => { s.setBadgeX(nx); s.setBadgeY(ny); },
      setSize: s.setBadgeSize,
      text: s.badgeTexts.find((t) => !!t) || "25",
      circleColor: s.badgeCircleColor,
      textColor: s.badgeTextColor,
    });
  }
  if (s.logoEnabled) {
    overlays.push({
      kind: "logo",
      x: s.logoX, y: s.logoY, size: s.logoSize,
      setPos: (nx, ny) => { s.setLogoX(nx); s.setLogoY(ny); },
      setSize: s.setLogoSize,
      imagePath: s.logoPath,
    });
  }

  const scale = frame ? POPUP_WIDTH / frame.width : 1;
  const displayHeight = frame ? frame.height * scale : POPUP_WIDTH;
  const get = (kind: OverlayKind) => overlays.filter((o) => o.kind === kind)[0];

  const halfWidthOf = (o: ActiveOverlay) => {
    const base = o.kind === "badge" ? BASE_DIAMETER / 2 : logoNatural ? logoNatural.width / 2 : 0;
    return base * (o.size / 100) * scale;
  };

  const moveOverlay = (kind: OverlayKind, clientX: number, clientY: number, shiftKey: boolean) => {
    const o = get(kind);
    if (!frame || !canvasRef.current || !o) return;
    const rect = canvasRef.current.getBoundingClientRect();
    let compX = Math.round(Math.min(Math.max(clientX - rect.left, 0), rect.width) / scale);
    let compY = Math.round(Math.min(Math.max(clientY - rect.top, 0), rect.height) / scale);

    // Shift constrains to whichever axis has moved further since the drag
    // began — the usual "drag straight" behaviour.
    const start = dragRef.current;
    if (shiftKey && start && start.kind === kind) {
      if (Math.abs(compX - start.startX) >= Math.abs(compY - start.startY)) compY = start.startY;
      else compX = start.startX;
    }

    // Magnetic alignment to the other overlay. Threshold is in screen
    // pixels so it feels the same regardless of comp resolution.
    let guideX: number | null = null;
    let guideY: number | null = null;
    for (let i = 0; i < overlays.length; i++) {
      const other = overlays[i];
      if (other.kind === kind) continue;
      if (Math.abs(compX - other.x) * scale < SNAP_PX) {
        compX = other.x;
        guideX = other.x;
      }
      if (Math.abs(compY - other.y) * scale < SNAP_PX) {
        compY = other.y;
        guideY = other.y;
      }
    }
    setGuides({ x: guideX, y: guideY });
    o.setPos(compX, compY);
  };

  const resizeOverlay = (kind: OverlayKind, clientX: number) => {
    const o = get(kind);
    if (!frame || !canvasRef.current || !o) return;
    const base = o.kind === "badge" ? BASE_DIAMETER / 2 : logoNatural ? logoNatural.width / 2 : 0;
    if (base <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = clientX - rect.left - o.x * scale;
    const newSize = (Math.max(dx, 4) / scale / base) * 100;
    o.setSize(Math.max(MIN_SIZE, Math.round(newSize)));
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizingRef.current) resizeOverlay(resizingRef.current, e.clientX);
      else if (dragRef.current) moveOverlay(dragRef.current.kind, e.clientX, e.clientY, e.shiftKey);
    };
    const onUp = () => {
      dragRef.current = null;
      resizingRef.current = null;
      setGuides({ x: null, y: null });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  const beginDrag = (kind: OverlayKind, e: React.MouseEvent) => {
    e.stopPropagation();
    const o = get(kind);
    if (!o) return;
    setSelected(kind);
    dragRef.current = { kind, startX: o.x, startY: o.y };
  };

  const corners = frame
    ? [
        { label: "TL", x: CORNER_MARGIN, y: CORNER_MARGIN },
        { label: "TR", x: frame.width - CORNER_MARGIN, y: CORNER_MARGIN },
        { label: "BL", x: CORNER_MARGIN, y: frame.height - CORNER_MARGIN },
        { label: "BR", x: frame.width - CORNER_MARGIN, y: frame.height - CORNER_MARGIN },
      ]
    : [];

  const selectedOverlay = get(selected) || overlays[0];

  return (
    <div className="position-picker-backdrop" data-testid="position-picker-backdrop" onClick={onClose}>
      <div className="position-picker-popup" onClick={(e) => e.stopPropagation()}>
        {error && <div className="position-picker-error">{error}</div>}
        {!error && !frame && <div className="position-picker-loading">Rendering preview…</div>}
        {frame && !overlays.length && (
          <div className="position-picker-error">Enable Badge or Logo to position it.</div>
        )}
        {frame && (
          <div
            ref={canvasRef}
            data-testid="position-picker-canvas"
            className="position-picker-canvas"
            style={{ width: POPUP_WIDTH, height: displayHeight }}
            onMouseDown={(e) => {
              // Clicking bare canvas moves the selected overlay there, so
              // coarse placement doesn't require grabbing a small target.
              if (!selectedOverlay) return;
              dragRef.current = { kind: selectedOverlay.kind, startX: selectedOverlay.x, startY: selectedOverlay.y };
              moveOverlay(selectedOverlay.kind, e.clientX, e.clientY, e.shiftKey);
            }}
          >
            <img
              className="position-picker-snapshot"
              src={"file://" + frame.path + "?t=" + cacheBust}
              alt="Comp preview"
              draggable={false}
            />

            {guides.x !== null && (
              <div data-testid="align-guide-x" className="position-picker-guide-v" style={{ left: guides.x * scale }} />
            )}
            {guides.y !== null && (
              <div data-testid="align-guide-y" className="position-picker-guide-h" style={{ top: guides.y * scale }} />
            )}

            {overlays.map((o) =>
              o.kind === "badge" ? (
                <div
                  key="badge"
                  data-testid="overlay-badge"
                  className={"position-picker-badge-preview" + (selected === "badge" ? " selected" : "")}
                  onMouseDown={(e) => beginDrag("badge", e)}
                  style={{
                    left: o.x * scale,
                    top: o.y * scale,
                    width: BASE_DIAMETER * (o.size / 100) * scale,
                    height: BASE_DIAMETER * (o.size / 100) * scale,
                    backgroundColor: rgbToHex(o.circleColor as [number, number, number]),
                    color: rgbToHex(o.textColor as [number, number, number]),
                    fontSize: BASE_FONT_SIZE * (o.size / 100) * scale,
                  }}
                >
                  {o.text}
                </div>
              ) : o.imagePath ? (
                <img
                  key="logo"
                  data-testid="overlay-logo"
                  className={"position-picker-logo-preview" + (selected === "logo" ? " selected" : "")}
                  src={"file://" + o.imagePath}
                  alt="Logo preview"
                  draggable={false}
                  onMouseDown={(e) => beginDrag("logo", e)}
                  onLoad={(e) =>
                    setLogoNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
                  }
                  style={
                    logoNatural
                      ? {
                          left: o.x * scale,
                          top: o.y * scale,
                          width: logoNatural.width * (o.size / 100) * scale,
                          height: logoNatural.height * (o.size / 100) * scale,
                        }
                      : { left: o.x * scale, top: o.y * scale, width: 0, height: 0, visibility: "hidden" }
                  }
                />
              ) : (
                <div
                  key="logo-marker"
                  className="position-picker-marker position-picker-marker-logo"
                  onMouseDown={(e) => beginDrag("logo", e)}
                  style={{ left: o.x * scale, top: o.y * scale }}
                />
              )
            )}

            {selectedOverlay && halfWidthOf(selectedOverlay) > 0 && (
              <div
                data-testid="position-picker-resize-handle"
                className="position-picker-resize-handle"
                title="Drag to resize"
                style={{
                  left: selectedOverlay.x * scale + halfWidthOf(selectedOverlay),
                  top: selectedOverlay.y * scale,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  resizingRef.current = selectedOverlay.kind;
                }}
              />
            )}
          </div>
        )}

        {/* Only worth showing with both on canvas — with one overlay there
            is nothing to disambiguate, and the corner buttons/resize handle
            already act on it. */}
        {frame && overlays.length > 1 && (
          <div className="position-picker-select-row">
            {overlays.map((o) => (
              <button
                key={o.kind}
                className={"position-picker-select-btn" + (selected === o.kind ? " active" : "")}
                onClick={() => setSelected(o.kind)}
              >
                {o.kind === "badge" ? "Badge" : "Logo"}
              </button>
            ))}
          </div>
        )}

        {frame && selectedOverlay && (
          <div className="position-picker-corners">
            {corners.map((c) => (
              <button
                key={c.label}
                className="position-picker-corner-btn"
                onClick={() => selectedOverlay.setPos(c.x, c.y)}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
        {overlays.length > 1 && (
          <div className="position-picker-hint">Hold Shift to drag straight · overlays snap to each other</div>
        )}
        <button className="video-toggle position-picker-close" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
