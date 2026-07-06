import type { RowLayer } from "../state/rowLayers";
import { LAYER_HANDLERS } from "../state/layerHandlers";

export function IterationRow({ row, iter }: { row: RowLayer; iter: number }) {
  const handler = LAYER_HANDLERS[row.type];
  if (!handler) return <div className="iter-row">Unsupported layer type: {row.type}</div>;
  const Fields = handler.RowFields;
  return (
    <div className="iter-row">
      <span className="iter-num">{iter + 1}</span>
      <Fields row={row} iter={iter} />
    </div>
  );
}
