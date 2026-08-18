// One layer's iteration rows, as a collapsible card.
//
// Two problems this solves. The heading was `NAME [TYPE]` uppercased — with
// 50-character filenames that wrapped over two lines and was unreadable as
// a heading, so the type is now a chip and the name is mono, normal case,
// single line, tail-truncated with the full value on hover.
//
// And with several layers × several iterations the panel became a wall of
// rows with Run far below it. Collapsing a group to its heading lets you
// work on one layer at a time; the row count stays visible so a collapsed
// group still says how much is inside.

import { useState } from "react";
import { IterationRow } from "./IterationRow";
import type { RowLayer } from "../state/rowLayers";
import { ChevronRight } from "lucide-react";

export function LayerGroup({
  row,
  count,
  onPreview,
}: {
  row: RowLayer;
  count: number;
  onPreview: (iter: number) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="extra-layer-group">
      <button
        className={"layer-group-label" + (open ? " open" : "")}
        title={row.name}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ChevronRight className="layer-group-chevron" />
        <span className="layer-group-name">{row.name}</span>
        <span className="layer-group-type">{row.type}</span>
        {!open && <span className="layer-group-count">{count} rows</span>}
      </button>

      {open &&
        Array.from({ length: count }, (_, iter) => (
          <IterationRow key={iter} row={row} iter={iter} onPreview={() => onPreview(iter)} />
        ))}
    </div>
  );
}
