import { useState } from "react";
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

  // normaliseHex only accepts a complete 6-digit hex, so committing straight
  // from the input on every keystroke rejected every partial value (e.g.
  // "#FF0") and the controlled input snapped back to the old hex -- typing a
  // color in by hand was impossible, only pasting a complete string worked.
  // hexDraft holds whatever's actually been typed so it can render immediately;
  // it's only committed to the store once it normalises, and cleared (falling
  // back to the derived `hex` above) on blur so an abandoned partial edit
  // doesn't linger in the field.
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  const commitHex = (raw: string) => {
    const normalised = normaliseHex(raw);
    if (normalised) setValue(row.rowKey, iter, { ...display, color: hexToRgb(normalised) });
  };

  return (
    <div className="color-cell">
      <input
        type="color"
        value={hex.toLowerCase()}
        onChange={(e) => {
          setHexDraft(null);
          commitHex(e.target.value);
        }}
      />
      <input
        type="text"
        maxLength={7}
        value={hexDraft ?? hex}
        onChange={(e) => {
          setHexDraft(e.target.value);
          commitHex(e.target.value);
        }}
        onBlur={() => setHexDraft(null)}
      />
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
