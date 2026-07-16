import { useState } from "react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { evalTS } from "../../lib/utils/bolt";
import { EmojiPickerGrid } from "./EmojiPickerGrid";

export function EmojiSection() {
  const {
    emojiPaths, emojiX, emojiY, emojiSize, emojiLayerIndex, count,
    setEmojiPath, setEmojiX, setEmojiY, setEmojiSize, setEmojiLayerIndex,
  } = useAppStore(
    useShallow((s) => ({
      emojiPaths: s.emojiPaths, emojiX: s.emojiX, emojiY: s.emojiY,
      emojiSize: s.emojiSize, emojiLayerIndex: s.emojiLayerIndex, count: s.count,
      setEmojiPath: s.setEmojiPath, setEmojiX: s.setEmojiX,
      setEmojiY: s.setEmojiY, setEmojiSize: s.setEmojiSize, setEmojiLayerIndex: s.setEmojiLayerIndex,
    }))
  );
  const [openRow, setOpenRow] = useState<number | null>(null);
  const [previewStatus, setPreviewStatus] = useState("");

  const toggleRow = (iter: number) => setOpenRow(openRow === iter ? null : iter);

  const selectEmoji = (iter: number, path: string) => {
    setEmojiPath(iter, path);
    setOpenRow(null);
  };

  const previewEmoji = () => {
    const firstPath = emojiPaths.find((p) => !!p);
    if (!firstPath) {
      setPreviewStatus("Select an emoji first.");
      return;
    }
    setPreviewStatus("Previewing…");
    evalTS("previewEmoji", { emojiPath: firstPath, x: emojiX, y: emojiY, size: emojiSize, layerIndex: emojiLayerIndex })
      .then((res) => setPreviewStatus(`Previewed in ${res.compName} — Ctrl+Z to undo`))
      .catch((err) => setPreviewStatus("Preview failed: " + String(err)));
  };

  return (
    <div id="emoji-config">
      <div className="emoji-pos-row">
        <label>
          X
          <input type="number" value={emojiX} onChange={(e) => setEmojiX(parseInt(e.target.value, 10) || 0)} />
        </label>
        <label>
          Y
          <input type="number" value={emojiY} onChange={(e) => setEmojiY(parseInt(e.target.value, 10) || 0)} />
        </label>
        <label>
          Size
          <input type="number" value={emojiSize} onChange={(e) => setEmojiSize(parseInt(e.target.value, 10) || 100)} />
        </label>
        <label>
          Layer
          <input
            type="number"
            value={emojiLayerIndex}
            onChange={(e) => setEmojiLayerIndex(parseInt(e.target.value, 10) || 1)}
          />
        </label>
      </div>
      <div id="emoji-iter-rows">
        {Array.from({ length: count }, (_, iter) => {
          const path = emojiPaths[iter];
          const name = path ? path.split("/").pop() : "No emoji";
          return (
            <div key={iter} className="emoji-iter-row">
              <span className="emoji-iter-num">{iter + 1}</span>
              <div className={"emoji-iter-thumb" + (path ? " has-emoji" : "")} onClick={() => toggleRow(iter)}>
                {path ? <img src={"file://" + path} alt={name} /> : "+"}
              </div>
              <span className="emoji-iter-name">{name}</span>
              {openRow === iter && <EmojiPickerGrid onSelect={(p) => selectEmoji(iter, p)} />}
            </div>
          );
        })}
      </div>
      <button onClick={previewEmoji}>Preview Emoji</button>
      {previewStatus && <div className="emoji-preview-status">{previewStatus}</div>}
    </div>
  );
}
