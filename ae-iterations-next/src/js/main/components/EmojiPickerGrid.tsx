import { useEffect, useState } from "react";
import { evalTS } from "../../lib/utils/bolt";

interface EmojiFile {
  path: string;
  name: string;
}

export function EmojiPickerGrid({ onSelect }: { onSelect: (path: string, name: string) => void }) {
  const [files, setFiles] = useState<EmojiFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    evalTS("listEmojiFiles")
      .then((res) => setFiles(res.files))
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return <div className="emoji-empty">{error}</div>;
  if (!files) return <div className="emoji-empty">Loading…</div>;
  if (files.length === 0) return <div className="emoji-empty">No emoji files found.</div>;

  return (
    <div id="emoji-picker-grid">
      {files.map((f) => (
        <div key={f.path} className="emoji-grid-item" title={f.name} onClick={() => onSelect(f.path, f.name)}>
          <img src={"file://" + f.path} alt={f.name} />
        </div>
      ))}
    </div>
  );
}
