import { useEffect, useState } from "react";
import { loadFonts } from "../lib/fonts";
import { Type, ChevronDown } from "lucide-react";

const MAX_RESULTS = 30;

export function FontInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [allFonts, setAllFonts] = useState<string[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    loadFonts().then(setAllFonts);
  }, []);

  const matches = allFonts
    ? allFonts.filter((f) => f.toLowerCase().includes(value.toLowerCase())).slice(0, MAX_RESULTS)
    : [];

  const select = (font: string) => {
    onChange(font);
    setOpen(false);
  };

  return (
    <div className="font-input-wrap">
      <Type className="font-input-icon" />
      <input
        type="text"
        placeholder="PostScript name"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      <ChevronDown className="font-input-chevron" />
      {open && (
        <div className="font-dropdown">
          {allFonts === null ? (
            <div className="font-empty">Loading fonts…</div>
          ) : matches.length === 0 ? (
            <div className="font-empty">No fonts found</div>
          ) : (
            matches.map((f) => (
              <div
                key={f}
                className="font-option hover-row"
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(f);
                }}
              >
                {f}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
