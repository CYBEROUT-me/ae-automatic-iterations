import { create } from "zustand";
import type { LayerInfo, LayerValue } from "../../../shared/types";
import { buildRowLayers, type RowLayer } from "./rowLayers";

interface AppState {
  compName: string | null;
  layerInfo: LayerInfo[];
  rowLayers: RowLayer[];
  count: number;
  sameForAll: boolean;
  values: Record<string, LayerValue[]>; // rowKey -> per-iteration value
  setLayerInfo(compName: string, layers: LayerInfo[]): void;
  setCount(count: number): void;
  setSameForAll(v: boolean): void;
  setValue(rowKey: string, iter: number, value: LayerValue): void;
  getValue(rowKey: string, iter: number): LayerValue | undefined;
}

export const useAppStore = create<AppState>((set, get) => ({
  compName: null,
  layerInfo: [],
  rowLayers: [],
  count: 5,
  sameForAll: true,
  values: {},
  // Clears `values` on every Refresh so a new layer selection never inherits
  // the previous selection's per-row colors/fonts/video values, even when the
  // new rows happen to reuse the same rowKeys (e.g. same AE layer indices).
  // Matches the original extension's clean-slate behavior of wiping and
  // rebuilding its DOM on every Refresh (extension/js/main.js).
  // TODO(Task 4): pass the real current mode instead of hardcoding "itr" once
  // the store knows about ITR/VAR mode switching.
  setLayerInfo: (compName, layers) => set({ compName, layerInfo: layers, rowLayers: buildRowLayers(layers, "itr"), values: {} }),
  setCount: (count) => set({ count }),
  setSameForAll: (v) => set({ sameForAll: v }),
  setValue: (rowKey, iter, value) =>
    set((s) => {
      const arr = s.values[rowKey] ? [...s.values[rowKey]] : [];
      arr[iter] = value;
      return { values: { ...s.values, [rowKey]: arr } };
    }),
  getValue: (rowKey, iter) => get().values[rowKey]?.[iter],
}));
