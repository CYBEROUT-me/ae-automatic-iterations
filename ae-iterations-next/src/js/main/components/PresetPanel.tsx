import { useState } from "react";
import { Save, Play, Trash2 } from "lucide-react";
import { useAppStore } from "../state/store";
import { useShallow } from "zustand/react/shallow";
import { hexToRgb, rgbToHex } from "../lib/color";
import { loadUserPresets, saveUserPresets } from "../lib/userPresets";
import library from "../presets-library.json";
import type { Preset, VideoPreset } from "../lib/userPresets";

const libraryPresets = library as Preset[];

function isVideoPreset(p: Preset): p is VideoPreset {
  return (p as VideoPreset).type === "video";
}

function swatchCount(preset: Preset): number {
  return isVideoPreset(preset) ? preset.iterations.length : preset.colors.length;
}

function swatchColor(preset: Preset, i: number): string {
  if (isVideoPreset(preset)) {
    const it = preset.iterations[i];
    return it?.tint || (it?.bw ? "#555" : "#333");
  }
  return preset.colors[i] || "#333";
}

export function PresetPanel() {
  const { rowLayers, count, values, setValue } = useAppStore(
    useShallow((s) => ({ rowLayers: s.rowLayers, count: s.count, values: s.values, setValue: s.setValue }))
  );
  const [userPresets, setUserPresets] = useState<Preset[]>(() => loadUserPresets());
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  const row0 = rowLayers[0];
  const isVideoRow = row0?.type === "video";
  const savedForKind = userPresets.filter((p) => isVideoPreset(p) === isVideoRow);
  const libraryForKind = libraryPresets.filter((p) => isVideoPreset(p) === isVideoRow);

  const applyPreset = (preset: Preset) => {
    if (!row0) return;
    if (isVideoPreset(preset)) {
      const n = Math.min(count, preset.iterations.length);
      for (let i = 0; i < n; i++) {
        const it = preset.iterations[i];
        setValue(row0.rowKey, i, {
          flip: it.flip,
          bw: it.bw,
          tint: it.tint ? hexToRgb(it.tint) : null,
          tintAmount: 50,
          hue: it.hue,
        });
      }
    } else {
      const n = Math.min(count, preset.colors.length);
      for (let i = 0; i < n; i++) {
        const existing = values[row0.rowKey]?.[i];
        setValue(row0.rowKey, i, { ...existing, color: hexToRgb(preset.colors[i]) });
      }
    }
  };

  const deletePreset = (index: number) => {
    const updated = userPresets.filter((_, i) => i !== index);
    try {
      saveUserPresets(updated);
      setUserPresets(updated);
    } catch (e) {
      setStatus("Could not delete preset: " + String(e));
    }
  };

  const savePreset = () => {
    if (!row0) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const preset: Preset = isVideoRow
      ? {
          name: trimmed,
          type: "video",
          iterations: Array.from({ length: count }, (_, i) => {
            const v = values[row0.rowKey]?.[i];
            return {
              flip: !!v?.flip,
              bw: !!v?.bw,
              tint: v?.tint ? rgbToHex(v.tint) : null,
              hue: v?.hue ?? 0,
            };
          }),
        }
      : {
          name: trimmed,
          colors: Array.from({ length: count }, (_, i) => {
            const v = values[row0.rowKey]?.[i];
            return v?.color ? rgbToHex(v.color).toUpperCase() : "#FF0000";
          }),
        };

    const updated = [preset, ...userPresets];
    try {
      saveUserPresets(updated);
      setUserPresets(updated);
      setName("");
      setStatus("");
    } catch (e) {
      setStatus("Could not save preset: " + String(e));
    }
  };

  const renderItem = (preset: Preset, isUser: boolean, index: number) => (
    <div key={(isUser ? "user-" : "lib-") + preset.name + index} className="preset-card">
      <div className="preset-card-swatches">
        {Array.from({ length: swatchCount(preset) }, (_, i) => (
          <div key={i} className="preset-swatch" style={{ background: swatchColor(preset, i) }} />
        ))}
      </div>
      <div className="preset-card-name">{preset.name}</div>
      <div className="preset-card-actions">
        <button className="row-action" title="Apply preset" onClick={() => applyPreset(preset)}>
          <Play />
        </button>
        {isUser && (
          <button className="row-action" title="Delete preset" onClick={() => deletePreset(index)}>
            <Trash2 />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div id="preset-panel">
      <div id="preset-save-row">
        <input
          id="preset-name-input"
          type="text"
          placeholder="Preset name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button id="btn-save-preset" className="icon-btn" title="Save preset" onClick={savePreset}>
          <Save />
        </button>
      </div>
      {status && <div className="preset-status">{status}</div>}
      <div id="preset-list">
        {savedForKind.length > 0 && (
          <>
            <div className="preset-group-label">Saved</div>
            <div className="preset-grid">
              {savedForKind.map((preset) => renderItem(preset, true, userPresets.indexOf(preset)))}
            </div>
          </>
        )}
        <div className="preset-group-label">Library</div>
        <div className="preset-grid">
          {libraryForKind.map((preset, i) => renderItem(preset, false, i))}
        </div>
      </div>
    </div>
  );
}
