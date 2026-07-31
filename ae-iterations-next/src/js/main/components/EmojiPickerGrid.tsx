import { useEffect, useState } from "react";
import { evalTS, evalTSErrorMessage } from "../../lib/utils/bolt";

interface EmojiFile {
  path: string;
  name: string;
}

export function EmojiPickerGrid({
  onSelect,
  selectedPath,
}: {
  onSelect: (path: string, name: string) => void;
  selectedPath?: string;
}) {
  const [files, setFiles] = useState<EmojiFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    evalTS("listEmojiFiles")
      .then((res) => setFiles(res.files))
      .catch((err) => setError(evalTSErrorMessage(err)));
  }, []);

  if (error) return <div className="emoji-empty">{error}</div>;
  if (!files) return <div className="emoji-empty">Loading…</div>;
  if (files.length === 0) return <div className="emoji-empty">No emoji files found.</div>;

  return (
    <div id="emoji-picker-grid">
      {files.map((f) => (
        <div
          key={f.path}
          className={"emoji-grid-item" + (f.path === selectedPath ? " selected" : "")}
          title={f.name}
          onClick={() => onSelect(f.path, f.name)}
        >
          <img src={"file://" + f.path} alt={f.name} />
        </div>
      ))}
    </div>
  );
}
