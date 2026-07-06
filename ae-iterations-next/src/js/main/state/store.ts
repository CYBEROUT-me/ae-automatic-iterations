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
  setLayerInfo: (compName, layers) => set({ compName, layerInfo: layers, rowLayers: buildRowLayers(layers) }),
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
