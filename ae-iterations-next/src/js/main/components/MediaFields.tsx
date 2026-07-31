import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";
import { FolderOpen } from "lucide-react";

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
      <button className="video-toggle" onClick={browse}>
        <FolderOpen /> Browse…
      </button>
      <span className={"media-file-label" + (value?.mediaPath ? " has-file" : "")}>{fileName}</span>
    </div>
  );
}
