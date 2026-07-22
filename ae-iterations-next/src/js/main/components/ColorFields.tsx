import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { hexToRgb, rgbToHex, normaliseHex } from "../lib/color";
import { FontInput } from "./FontInput";

export function ColorFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  // Merge the layer's live AE state under any stored edit, so a field the
  // user hasn't touched still shows (and, once any sibling field on this row
  // is edited, still writes through) the real current color/font/content
  // instead of a placeholder.
  const display = { ...row.liveValue, ...value };
  const hex = display.color ? rgbToHex(display.color).toUpperCase() : "#FF0000";

  const onHexChange = (raw: string) => {
    const normalised = normaliseHex(raw);
    if (!normalised) return;
    setValue(row.rowKey, iter, { ...display, color: hexToRgb(normalised) });
  };

  return (
    <div className="color-cell">
      <input type="color" value={hex.toLowerCase()} onChange={(e) => onHexChange(e.target.value)} />
      <input type="text" maxLength={7} value={hex} onChange={(e) => onHexChange(e.target.value)} />
      {row.type === "text" && (
        <>
          <FontInput
            value={display.font ?? ""}
            onChange={(font) => setValue(row.rowKey, iter, { ...display, font })}
          />
          <input
            type="text"
            placeholder="Text content"
            value={display.content ?? ""}
            onChange={(e) => setValue(row.rowKey, iter, { ...display, content: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
