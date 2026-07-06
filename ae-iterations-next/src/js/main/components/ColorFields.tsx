import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { hexToRgb, rgbToHex, normaliseHex } from "../lib/color";

export function ColorFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  const hex = value?.color ? rgbToHex(value.color).toUpperCase() : "#FF0000";

  const onHexChange = (raw: string) => {
    const normalised = normaliseHex(raw);
    if (!normalised) return;
    setValue(row.rowKey, iter, { ...value, color: hexToRgb(normalised) });
  };

  return (
    <div className="color-cell">
      <input type="color" value={hex.toLowerCase()} onChange={(e) => onHexChange(e.target.value)} />
      <input type="text" maxLength={7} value={hex} onChange={(e) => onHexChange(e.target.value)} />
      {row.type === "text" && (
        <>
          <input
            type="text"
            placeholder="PostScript name"
            value={value?.font ?? ""}
            onChange={(e) => setValue(row.rowKey, iter, { ...value, font: e.target.value })}
          />
          <input
            type="text"
            placeholder="Text content"
            value={value?.content ?? ""}
            onChange={(e) => setValue(row.rowKey, iter, { ...value, content: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
