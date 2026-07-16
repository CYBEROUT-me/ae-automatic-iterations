import type { RowLayer } from "../state/rowLayers";
import { LAYER_HANDLERS } from "../state/layerHandlers";
import { Play } from "lucide-react";

export function IterationRow({
  row,
  iter,
  onPreview,
}: {
  row: RowLayer;
  iter: number;
  onPreview?: () => void;
}) {
  const handler = LAYER_HANDLERS[row.type];
  if (!handler) return <div className="iter-row">Unsupported layer type: {row.type}</div>;
  const Fields = handler.RowFields;
  return (
    <div className="iter-row hover-row">
      <span className="iter-num">{iter + 1}</span>
      <Fields row={row} iter={iter} />
      {onPreview && (
        <button className="row-action" title={`Preview iteration ${iter + 1}`} onClick={onPreview}>
          <Play />
        </button>
      )}
    </div>
  );
}
