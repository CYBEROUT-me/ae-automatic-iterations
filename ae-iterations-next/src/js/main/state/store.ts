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
  addLayerInfo(compName: string, layers: LayerInfo[]): void;
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
  badgeEnabled: boolean;
  badgeTexts: (string | null)[];
  badgeX: number;
  badgeY: number;
  badgeSize: number;
  badgeCircleColor: [number, number, number];
  badgeTextColor: [number, number, number];
  logoEnabled: boolean;
  logoPath: string | null;
  logoX: number;
  logoY: number;
  logoSize: number;
  logoLayerIndex: number;
  setBadgeEnabled(v: boolean): void;
  setBadgeText(iter: number, text: string | null): void;
  setBadgeX(v: number): void;
  setBadgeY(v: number): void;
  setBadgeSize(v: number): void;
  setBadgeCircleColor(color: [number, number, number]): void;
  setBadgeTextColor(color: [number, number, number]): void;
  setLogoEnabled(v: boolean): void;
  setLogoPath(path: string | null): void;
  setLogoX(v: number): void;
  setLogoY(v: number): void;
  setLogoSize(v: number): void;
  setLogoLayerIndex(v: number): void;
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
  // Appends the newly selected layer(s) to the existing set instead of
  // replacing it, so a second/third "Add Layer" click can build up a
  // multi-layer set one selection at a time without losing what's already
  // been configured on the earlier ones. Layers already present (by AE
  // layer index) are skipped rather than duplicated — clicking Add Layer
  // again on the same selection is a no-op, not a duplicate row. Callers
  // are responsible for rejecting a selection from a different comp before
  // calling this (previewApply/runIterations only ever target one comp).
  addLayerInfo: (compName, layers) =>
    set((s) => {
      const existingIndices = new Set(s.layerInfo.map((l) => l.index));
      const merged = [...s.layerInfo, ...layers.filter((l) => !existingIndices.has(l.index))];
      return { compName, layerInfo: merged, rowLayers: buildRowLayers(merged, s.mode) };
    }),
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
  badgeEnabled: false,
  badgeTexts: [],
  badgeX: 90,
  badgeY: 90,
  badgeSize: 150,
  badgeCircleColor: [1, 1, 1],
  badgeTextColor: [0, 0, 0],
  logoEnabled: false,
  logoPath: null,
  logoX: 990,
  logoY: 90,
  logoSize: 10,
  logoLayerIndex: 0,
  setBadgeEnabled: (v) => set({ badgeEnabled: v }),
  setBadgeText: (iter, text) =>
    set((s) => {
      const arr = [...s.badgeTexts];
      arr[iter] = text;
      return { badgeTexts: arr };
    }),
  setBadgeX: (v) => set({ badgeX: v }),
  setBadgeY: (v) => set({ badgeY: v }),
  setBadgeSize: (v) => set({ badgeSize: v }),
  setBadgeCircleColor: (color) => set({ badgeCircleColor: color }),
  setBadgeTextColor: (color) => set({ badgeTextColor: color }),
  setLogoEnabled: (v) => set({ logoEnabled: v }),
  setLogoPath: (path) => set({ logoPath: path }),
  setLogoX: (v) => set({ logoX: v }),
  setLogoY: (v) => set({ logoY: v }),
  setLogoSize: (v) => set({ logoSize: v }),
  setLogoLayerIndex: (v) => set({ logoLayerIndex: v }),
}));
