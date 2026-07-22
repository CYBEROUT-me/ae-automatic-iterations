import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { hexToRgb, rgbToHex } from "../lib/color";
import type { LayerValue } from "../../../shared/types";
import { FlipHorizontal2, Contrast } from "lucide-react";

export function VideoFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  const v: LayerValue = { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0, ...row.liveValue, ...value };

  const update = (patch: Partial<LayerValue>) => setValue(row.rowKey, iter, { ...v, ...patch });

  return (
    <div className="video-fields">
      <button
        className={"video-toggle" + (v.flip ? " active" : "")}
        title="Flip Horizontal"
        onClick={() => update({ flip: !v.flip })}
      >
        <FlipHorizontal2 /> Flip
      </button>
      <button
        className={"video-toggle" + (v.bw ? " active" : "")}
        title="Black & White"
        onClick={() => update({ bw: !v.bw })}
      >
        <Contrast /> B&amp;W
      </button>
      <div className="tint-cell">
        <input
          type="checkbox"
          checked={!!v.tint}
          onChange={(e) => update({ tint: e.target.checked ? hexToRgb("#ff6b35") : null })}
        />
        <input
          type="color"
          disabled={!v.tint}
          value={v.tint ? rgbToHex(v.tint).toLowerCase() : "#ff6b35"}
          onChange={(e) => update({ tint: hexToRgb(e.target.value) })}
        />
        <input
          type="number"
          min={0}
          max={100}
          disabled={!v.tint}
          value={v.tintAmount ?? 50}
          onChange={(e) => update({ tintAmount: parseInt(e.target.value, 10) || 50 })}
        />
      </div>
      <div className="hue-group">
        <input
          type="range"
          min={-180}
          max={180}
          className="hue-slider"
          title="Hue shift (degrees)"
          value={v.hue ?? 0}
          onChange={(e) => update({ hue: parseInt(e.target.value, 10) || 0 })}
        />
        <input
          type="number"
          min={-180}
          max={180}
          className="hue-value"
          title="Hue shift (degrees)"
          value={v.hue ?? 0}
          onChange={(e) => update({ hue: parseInt(e.target.value, 10) || 0 })}
        />
      </div>
    </div>
  );
}
