// Named "job setups" — the whole overlay/global configuration (badge,
// logo, emoji, count, variant names, mode) saved under a name and
// reloadable in one click, for recurring campaign formats.
//
// Shares panel-state.json with the session autosave (see
// lib/panelState.ts). Every mutation re-reads the file first rather than
// trusting component state, so a save here can't clobber an autosave that
// landed in between, and vice versa.

import { useState } from "react";
import { useAppStore } from "../state/store";
import { loadPanelState, savePanelState } from "../lib/panelState";
import type { JobPreset } from "../lib/panelState";
import { captureSetup, applySetup } from "../state/panelSetup";
import { Save, Trash2 } from "lucide-react";

export function JobPresetBar() {
  const [presets, setPresets] = useState<JobPreset[]>(() => {
    try {
      return loadPanelState().jobPresets;
    } catch (e) {
      return [];
    }
  });
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");

  const persist = (next: JobPreset[]) => {
    const onDisk = loadPanelState();
    const ok = savePanelState({ ...onDisk, jobPresets: next });
    setPresets(next);
    if (!ok) setStatus("Could not write to disk");
    return ok;
  };

  const save = () => {
    const raw = prompt("Name this setup (badge, logo, count and variant names):", selected || "");
    if (raw === null) return;
    const name = raw.trim();
    if (!name) return;
    const setup = captureSetup(useAppStore.getState());
    const existing = presets.filter((p) => p.name === name).length > 0;
    // Overwriting by name is the natural way to update a setup after
    // tweaking it, but it must be a deliberate choice, not a surprise.
    if (existing && !confirm(`"${name}" already exists. Replace it?`)) return;
    const next = existing
      ? presets.map((p) => (p.name === name ? { name, setup } : p))
      : presets.concat([{ name, setup }]);
    if (persist(next)) {
      setSelected(name);
      setStatus(`Saved "${name}"`);
    }
  };

  const load = (name: string) => {
    setSelected(name);
    if (!name) return;
    const preset = presets.filter((p) => p.name === name)[0];
    if (!preset) return;
    const patch = applySetup(preset.setup);
    if (Object.keys(patch).length) useAppStore.setState(patch);
    setStatus(`Loaded "${name}"`);
  };

  const remove = () => {
    if (!selected) return;
    if (!confirm(`Delete setup "${selected}"?`)) return;
    if (persist(presets.filter((p) => p.name !== selected))) {
      setStatus(`Deleted "${selected}"`);
      setSelected("");
    }
  };

  return (
    <div className="job-preset-bar">
      <span className="job-preset-label">Setup</span>
      <select
        className="job-preset-select"
        value={selected}
        onChange={(e) => load(e.target.value)}
        title="Load a saved setup"
      >
        <option value="">{presets.length ? "Load saved setup…" : "No saved setups yet"}</option>
        {presets.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      <button className="icon-btn" title="Save current setup" onClick={save}>
        <Save />
      </button>
      <button className="icon-btn" title="Delete selected setup" onClick={remove} disabled={!selected}>
        <Trash2 />
      </button>
      {status && <span className="job-preset-status">{status}</span>}
    </div>
  );
}
