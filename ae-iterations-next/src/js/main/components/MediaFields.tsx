import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";
import { VideoEffectFields } from "./VideoEffectFields";
import { FolderOpen } from "lucide-react";

// VAR mode's footage rows: a swapped source file AND the same flip/B&W/
// tint/hue effects ITR mode's video rows get -- a variant can point at
// different media, grade it differently, or both. Two lines under one row
// number/Preview button, not two separate rows, since it's one layer.
export function MediaFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  const fileName = value?.mediaPath ? value.mediaPath.split("/").pop() : "No file";

  const browse = () => {
    evalTS("browseForMedia")
      .then((res) => {
        if (res.path) setValue(row.rowKey, iter, { ...value, mediaPath: res.path });
      })
      .catch((err) => alert("Browse failed: " + evalTSErrorMessage(err)));
  };

  return (
    <div className="media-fields">
      <div className="media-fields-browse-row">
        <button className="video-toggle" onClick={browse}>
          <FolderOpen /> Browse…
        </button>
        <span className={"media-file-label" + (value?.mediaPath ? " has-file" : "")}>{fileName}</span>
      </div>
      <div className="media-fields-effects-row">
        <VideoEffectFields row={row} iter={iter} />
      </div>
    </div>
  );
}
