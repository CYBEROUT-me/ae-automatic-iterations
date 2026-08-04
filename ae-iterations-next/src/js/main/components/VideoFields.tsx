import type { RowLayer } from "../state/rowLayers";
import { VideoEffectFields } from "./VideoEffectFields";

export function VideoFields({ row, iter }: { row: RowLayer; iter: number }) {
  return (
    <div className="video-fields">
      <VideoEffectFields row={row} iter={iter} />
    </div>
  );
}
