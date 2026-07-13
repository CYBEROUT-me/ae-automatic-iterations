import { create } from "zustand";
import type { LayerInfo, LayerValue } from "../../../shared/types";
import { buildRowLayers, type Mode, type RowLayer } from "./rowLayers";

interface AppState {
  compName: string | null;
  layerInfo: LayerInfo[];
  rowLayers: RowLayer[];
  count: number;
  sameForAll: boolean;
  values: Record<string, LayerValue[]>; // rowKey -> per-iteration value
  mode: Mode;
  varNames: string[];
  emojiEnabled: boolean;
  emojiPaths: (string | null)[];
  emojiX: number;
  emojiY: number;
  emojiSize: number;
  emojiLayerIndex: number;
  setLayerInfo(compName: string, layers: LayerInfo[]): void;
  setCount(count: number): void;
  setSameForAll(v: boolean): void;
  setValue(rowKey: string, iter: number, value: LayerValue): void;
  getValue(rowKey: string, iter: number): LayerValue | undefined;
  setMode(mode: Mode): void;
  setVarName(index: number, name: string): void;
  setEmojiEnabled(v: boolean): void;
  setEmojiPath(iter: number, path: string | null): void;
  setEmojiX(v: number): void;
  setEmojiY(v: number): void;
  setEmojiSize(v: number): void;
  setEmojiLayerIndex(v: number): void;
}

export const useAppStore = create<AppState>((set, get) => ({
  compName: null,
  layerInfo: [],
  rowLayers: [],
  count: 5,
  sameForAll: true,
  values: {},
  mode: "itr",
  varNames: [],
  // Clears `values` on every Refresh so a new layer selection never inherits
  // the previous selection's per-row colors/fonts/video values, even when the
  // new rows happen to reuse the same rowKeys (e.g. same AE layer indices).
  // Matches the original extension's clean-slate behavior of wiping and
  // rebuilding its DOM on every Refresh (extension/js/main.js).
  setLayerInfo: (compName, layers) =>
    set((s) => ({ compName, layerInfo: layers, rowLayers: buildRowLayers(layers, s.mode), values: {} })),
  setCount: (count) => set({ count }),
  setSameForAll: (v) => set({ sameForAll: v }),
  setValue: (rowKey, iter, value) =>
    set((s) => {
      const arr = s.values[rowKey] ? [...s.values[rowKey]] : [];
      arr[iter] = value;
      return { values: { ...s.values, [rowKey]: arr } };
    }),
  getValue: (rowKey, iter) => get().values[rowKey]?.[iter],
  // Re-derives rowLayers from the already-stored layerInfo so switching modes
  // relabels video/footage rows as "media" (VAR mode) without requiring a
  // fresh Refresh — mirrors the original extension's switchMode() re-render.
  setMode: (mode) => set((s) => ({ mode, rowLayers: buildRowLayers(s.layerInfo, mode) })),
  setVarName: (index, name) =>
    set((s) => {
      const varNames = [...s.varNames];
      varNames[index] = name;
      return { varNames };
    }),
  emojiEnabled: false,
  emojiPaths: [],
  emojiX: 540,
  emojiY: 1347,
  emojiSize: 100,
  emojiLayerIndex: 1,
  setEmojiEnabled: (v) => set({ emojiEnabled: v }),
  setEmojiPath: (iter, path) =>
    set((s) => {
      const arr = [...s.emojiPaths];
      arr[iter] = path;
      return { emojiPaths: arr };
    }),
  setEmojiX: (v) => set({ emojiX: v }),
  setEmojiY: (v) => set({ emojiY: v }),
  setEmojiSize: (v) => set({ emojiSize: v }),
  setEmojiLayerIndex: (v) => set({ emojiLayerIndex: v }),
}));
