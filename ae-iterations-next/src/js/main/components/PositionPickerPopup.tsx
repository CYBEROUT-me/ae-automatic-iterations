import { useEffect, useRef, useState } from "react";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";

const POPUP_WIDTH = 320;

interface FrameInfo {
  path: string;
  width: number;
  height: number;
}

export function PositionPickerPopup({
  compName,
  x,
  y,
  onChange,
  onClose,
  markerKind,
}: {
  compName: string | null;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
  onClose: () => void;
  markerKind: "badge" | "logo";
}) {
  const [frame, setFrame] = useState<FrameInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust] = useState(() => Date.now());
  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    evalTS("renderPreviewFrame", compName ? { compName } : undefined)
      .then((res) => setFrame(res))
      .catch((err) => setError(evalTSErrorMessage(err)));
  }, [compName]);

  const scale = frame ? POPUP_WIDTH / frame.width : 1;
  const displayHeight = frame ? frame.height * scale : POPUP_WIDTH;

  const updateFromClientPos = (clientX: number, clientY: number) => {
    if (!frame || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const relX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const relY = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    onChange(Math.round(relX / scale), Math.round(relY / scale));
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) updateFromClientPos(e.clientX, e.clientY);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

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
            <img src={"file://" + frame.path + "?t=" + cacheBust} alt="Comp preview" draggable={false} />
            <div
              className={"position-picker-marker position-picker-marker-" + markerKind}
              style={{ left: x * scale, top: y * scale }}
            />
          </div>
        )}
        <button className="video-toggle position-picker-close" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
