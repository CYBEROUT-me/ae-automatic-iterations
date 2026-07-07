import type { RowLayer } from "../state/rowLayers";
import { useAppStore } from "../state/store";
import { evalTS } from "../../lib/utils/bolt";

export function MediaFields({ row, iter }: { row: RowLayer; iter: number }) {
  const value = useAppStore((s) => s.values[row.rowKey]?.[iter]);
  const setValue = useAppStore((s) => s.setValue);
  const fileName = value?.mediaPath ? value.mediaPath.split("/").pop() : "No file";

  const browse = () => {
    evalTS("browseForMedia")
      .then((res) => {
        if (res.path) setValue(row.rowKey, iter, { ...value, mediaPath: res.path });
      })
      .catch((err) => alert("Browse failed: " + String(err)));
  };

  return (
    <div className="media-fields">
      <button onClick={browse}>Browse…</button>
      <span className="media-file-label">{fileName}</span>
    </div>
  );
}
