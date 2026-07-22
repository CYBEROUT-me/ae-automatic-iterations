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

describe("useAppStore.addLayerInfo", () => {
  beforeEach(() => {
    useAppStore.setState({ compName: null, layerInfo: [], rowLayers: [], count: 5, sameForAll: true, values: {} });
  });

  it("appends a new layer to the existing set without touching prior values", () => {
    useAppStore.getState().setLayerInfo("Comp A", initialLayers);
    useAppStore.getState().setValue("1", 0, { color: [1, 0, 0] });

    const secondLayer: LayerInfo[] = [
      { name: "Circle", index: 2, type: "shape", fills: [{ path: "Contents/Fill 1", color: [0, 0, 1] }], strokes: [] },
    ];
    useAppStore.getState().addLayerInfo("Comp A", secondLayer);

    const state = useAppStore.getState();
    expect(state.layerInfo).toHaveLength(2);
    expect(state.rowLayers).toHaveLength(2);
    expect(state.values).toEqual({ "1": [{ color: [1, 0, 0] }] });
  });

  it("skips a layer already present (by AE layer index) instead of duplicating its row", () => {
    useAppStore.getState().setLayerInfo("Comp A", initialLayers);
    useAppStore.getState().addLayerInfo("Comp A", initialLayers);

    expect(useAppStore.getState().layerInfo).toHaveLength(1);
    expect(useAppStore.getState().rowLayers).toHaveLength(1);
  });

  it("behaves like setLayerInfo when nothing has been selected yet", () => {
    useAppStore.getState().addLayerInfo("Comp A", initialLayers);
    const state = useAppStore.getState();
    expect(state.compName).toBe("Comp A");
    expect(state.layerInfo).toEqual(initialLayers);
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

describe("emoji state", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: null, layerInfo: [], rowLayers: [], count: 5, sameForAll: true, values: {},
      mode: "itr", varNames: [],
      emojiEnabled: false, emojiPaths: [], emojiX: 540, emojiY: 1347, emojiSize: 100, emojiLayerIndex: 1,
    });
  });

  it("defaults match the original extension's shared config", () => {
    const s = useAppStore.getState();
    expect(s.emojiEnabled).toBe(false);
    expect(s.emojiX).toBe(540);
    expect(s.emojiY).toBe(1347);
    expect(s.emojiSize).toBe(100);
    expect(s.emojiLayerIndex).toBe(1);
  });

  it("setEmojiPath sets a path at the given index without disturbing others", () => {
    useAppStore.getState().setEmojiPath(0, "/emojis/a.gif");
    useAppStore.getState().setEmojiPath(2, "/emojis/b.gif");
    expect(useAppStore.getState().emojiPaths[0]).toBe("/emojis/a.gif");
    expect(useAppStore.getState().emojiPaths[2]).toBe("/emojis/b.gif");
    expect(useAppStore.getState().emojiPaths[1]).toBeUndefined();
  });

  it("setEmojiEnabled/X/Y/Size/LayerIndex update their fields independently", () => {
    useAppStore.getState().setEmojiEnabled(true);
    useAppStore.getState().setEmojiX(100);
    useAppStore.getState().setEmojiY(200);
    useAppStore.getState().setEmojiSize(50);
    useAppStore.getState().setEmojiLayerIndex(3);
    const s = useAppStore.getState();
    expect(s.emojiEnabled).toBe(true);
    expect(s.emojiX).toBe(100);
    expect(s.emojiY).toBe(200);
    expect(s.emojiSize).toBe(50);
    expect(s.emojiLayerIndex).toBe(3);
  });
});
