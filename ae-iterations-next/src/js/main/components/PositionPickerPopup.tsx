import { useEffect, useRef, useState } from "react";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";
import { rgbToHex } from "../lib/color";

const POPUP_WIDTH = 320;
const CORNER_MARGIN = 80; // comp pixels
const MIN_SIZE = 1; // percent

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

type OverlayPreview =
  | { kind: "badge"; text: string; size: number; circleColor: [number, number, number]; textColor: [number, number, number] }
  | { kind: "logo"; size: number; imagePath: string | null };

export function PositionPickerPopup({
  compName,
  x,
  y,
  onChange,
  onSizeChange,
  onClose,
  overlay,
}: {
  compName: string | null;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  onSizeChange: (size: number) => void;
  onClose: () => void;
  overlay: OverlayPreview;
}) {
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust] = useState(() => Date.now());
  const [logoNatural, setLogoNatural] = useState<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);

  useEffect(() => {
    evalTS("renderPreviewFrame", compName ? { compName } : undefined)
      .then((res) => setFrame(res))
      .catch((err) => setError(evalTSErrorMessage(err)));
  }, [compName]);

  const logoImagePath = overlay.kind === "logo" ? overlay.imagePath : null;
  useEffect(() => {
    setLogoNatural(null);
  }, [logoImagePath]);

  const scale = frame ? POPUP_WIDTH / frame.width : 1;
  const displayHeight = frame ? frame.height * scale : POPUP_WIDTH;

  // Base half-width in comp pixels at size=100 -- the resize handle's
  // distance from center is this, times size/100, times scale.
  const baseHalfWidth = overlay.kind === "badge" ? BASE_DIAMETER / 2 : logoNatural ? logoNatural.width / 2 : 0;

  const updateFromClientPos = (clientX: number, clientY: number) => {
    if (!frame || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const relX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const relY = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    onChange(Math.round(relX / scale), Math.round(relY / scale));
  };

  const updateSizeFromClientX = (clientX: number) => {
    if (!frame || !canvasRef.current || baseHalfWidth <= 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = clientX - rect.left - x * scale;
    const newHalfWidthScreen = Math.max(dx, 4);
    const newSize = (newHalfWidthScreen / scale / baseHalfWidth) * 100;
    onSizeChange(Math.max(MIN_SIZE, Math.round(newSize)));
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizingRef.current) updateSizeFromClientX(e.clientX);
      else if (draggingRef.current) updateFromClientPos(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
      resizingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  const corners = frame
    ? [
        { label: "TL", x: CORNER_MARGIN, y: CORNER_MARGIN },
        { label: "TR", x: frame.width - CORNER_MARGIN, y: CORNER_MARGIN },
        { label: "BL", x: CORNER_MARGIN, y: frame.height - CORNER_MARGIN },
        { label: "BR", x: frame.width - CORNER_MARGIN, y: frame.height - CORNER_MARGIN },
      ]
    : [];

  const displayedHalfWidth = baseHalfWidth * (overlay.size / 100) * scale;
  const showResizeHandle = overlay.kind === "badge" || !!logoNatural;

  return (
    <div className="position-picker-backdrop" data-testid="position-picker-backdrop" onClick={onClose}>
      <div className="position-picker-popup" onClick={(e) => e.stopPropagation()}>
        {error && <div className="position-picker-error">{error}</div>}
        {!error && !frame && <div className="position-picker-loading">Rendering preview…</div>}
        {frame && (
          <div
            ref={canvasRef}
            data-testid="position-picker-canvas"
            className="position-picker-canvas"
            style={{ width: POPUP_WIDTH, height: displayHeight }}
            onMouseDown={(e) => {
              draggingRef.current = true;
              updateFromClientPos(e.clientX, e.clientY);
            }}
          >
            <img
              className="position-picker-snapshot"
              src={"file://" + frame.path + "?t=" + cacheBust}
              alt="Comp preview"
              draggable={false}
            />

            {overlay.kind === "badge" && (
              <div
                className="position-picker-badge-preview"
                style={{
                  left: x * scale,
                  top: y * scale,
                  width: BASE_DIAMETER * (overlay.size / 100) * scale,
                  height: BASE_DIAMETER * (overlay.size / 100) * scale,
                  backgroundColor: rgbToHex(overlay.circleColor),
                  color: rgbToHex(overlay.textColor),
                  fontSize: BASE_FONT_SIZE * (overlay.size / 100) * scale,
                }}
              >
                {overlay.text}
              </div>
            )}

            {overlay.kind === "logo" && overlay.imagePath && (
              <img
                className="position-picker-logo-preview"
                src={"file://" + overlay.imagePath}
                alt="Logo preview"
                draggable={false}
                onLoad={(e) =>
                  setLogoNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
                }
                style={
                  logoNatural
                    ? {
                        left: x * scale,
                        top: y * scale,
                        width: logoNatural.width * (overlay.size / 100) * scale,
                        height: logoNatural.height * (overlay.size / 100) * scale,
                      }
                    : { left: x * scale, top: y * scale, width: 0, height: 0, visibility: "hidden" }
                }
              />
            )}
            {overlay.kind === "logo" && (!overlay.imagePath || !logoNatural) && (
              <div
                className="position-picker-marker position-picker-marker-logo"
                style={{ left: x * scale, top: y * scale }}
              />
            )}

            {showResizeHandle && (
              <div
                data-testid="position-picker-resize-handle"
                className="position-picker-resize-handle"
                title="Drag to resize"
                style={{ left: x * scale + displayedHalfWidth, top: y * scale }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  resizingRef.current = true;
                }}
              />
            )}
          </div>
        )}
        {frame && (
          <div className="position-picker-corners">
            {corners.map((c) => (
              <button key={c.label} className="position-picker-corner-btn" onClick={() => onChange(c.x, c.y)}>
                {c.label}
              </button>
            ))}
          </div>
        )}
        <button className="video-toggle position-picker-close" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
