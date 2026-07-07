import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";
import type { LayerInfo } from "../../../shared/types";

const initialLayers: LayerInfo[] = [
  { name: "Rect", index: 1, type: "shape", fills: [{ path: "Contents/Group 1/Contents/Fill 1", color: [1, 0, 0] }], strokes: [] },
];

const nextLayers: LayerInfo[] = [
  { name: "OtherRect", index: 1, type: "shape", fills: [{ path: "Contents/Group 1/Contents/Fill 1", color: [0, 1, 0] }], strokes: [] },
];

describe("useAppStore.setLayerInfo", () => {
  beforeEach(() => {
    useAppStore.setState({ compName: null, layerInfo: [], rowLayers: [], count: 5, sameForAll: true, values: {} });
  });

  it("clears values from a previous selection, even when the new rows reuse the same rowKey", () => {
    useAppStore.getState().setLayerInfo("Comp A", initialLayers);
    useAppStore.getState().setValue("1", 0, { color: [1, 0, 0] });
    expect(useAppStore.getState().values).toEqual({ "1": [{ color: [1, 0, 0] }] });

    // Refresh with a different layer selection that happens to reuse rowKey "1".
    useAppStore.getState().setLayerInfo("Comp B", nextLayers);

    expect(useAppStore.getState().values).toEqual({});
    expect(useAppStore.getState().getValue("1", 0)).toBeUndefined();
  });

  it("still updates compName, layerInfo, and rowLayers as before", () => {
    useAppStore.getState().setLayerInfo("Comp A", initialLayers);
    const state = useAppStore.getState();
    expect(state.compName).toBe("Comp A");
    expect(state.layerInfo).toEqual(initialLayers);
    expect(state.rowLayers).toHaveLength(1);
  });
});

describe("setMode", () => {
  beforeEach(() => {
    useAppStore.setState({ compName: null, layerInfo: [], rowLayers: [], count: 5, sameForAll: true, values: {}, mode: "itr", varNames: [] });
  });

  it("recomputes rowLayers from stored layerInfo when mode changes", () => {
    const layers = [
      { name: "BG", index: 1, type: "video" as const, videoState: { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 } },
    ];
    useAppStore.getState().setLayerInfo("Comp A", layers);
    expect(useAppStore.getState().rowLayers[0].type).toBe("video");

    useAppStore.getState().setMode("var");
    expect(useAppStore.getState().mode).toBe("var");
    expect(useAppStore.getState().rowLayers[0].type).toBe("media");
  });
});

describe("setVarName", () => {
  beforeEach(() => {
    useAppStore.setState({ compName: null, layerInfo: [], rowLayers: [], count: 5, sameForAll: true, values: {}, mode: "itr", varNames: [] });
  });

  it("sets a name at the given index without disturbing others", () => {
    useAppStore.getState().setVarName(0, "Red Variant");
    useAppStore.getState().setVarName(2, "Blue Variant");
    expect(useAppStore.getState().varNames[0]).toBe("Red Variant");
    expect(useAppStore.getState().varNames[2]).toBe("Blue Variant");
  });
});
