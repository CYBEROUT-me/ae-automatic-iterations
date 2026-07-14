import { useEffect, useState } from "react";
import { loadFonts } from "../lib/fonts";

const MAX_RESULTS = 30;

// Fully controlled — the caller (ColorFields) owns the value, this component
// only renders/edits it and layers an autocomplete dropdown on top. No
// shared/global search box: every FontInput instance is self-contained,
// matching every other component in this codebase (MediaFields,
// EmojiPickerGrid, etc.) rather than the original extension's one
// panel-wide floating search input.
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
      {open && (
        <div className="font-dropdown">
          {allFonts === null ? (
            <div className="font-empty">Loading fonts…</div>
          ) : matches.length === 0 ? (
            <div className="font-empty">No fonts found</div>
          ) : (
            matches.map((f) => (
              // onMouseDown + preventDefault (not onClick) so the selection
              // fires before the input's onBlur closes the dropdown — the
              // original extension's exact trick for avoiding a
              // blur-then-click ordering race.
              <div
                key={f}
                className="font-option"
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
