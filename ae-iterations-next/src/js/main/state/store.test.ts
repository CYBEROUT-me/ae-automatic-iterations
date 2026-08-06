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

describe("badge/logo overlay state", () => {
  beforeEach(() => {
    useAppStore.setState({
      compName: null, layerInfo: [], rowLayers: [], count: 5, sameForAll: true, values: {},
      mode: "var", varNames: [],
      badgeEnabled: false, badgeTexts: [], badgeX: 90, badgeY: 90, badgeSize: 100,
      badgeCircleColor: [1, 1, 1], badgeTextColor: [0, 0, 0], badgeLayerIndex: 0,
      logoEnabled: false, logoPath: null, logoX: 990, logoY: 90, logoSize: 100, logoLayerIndex: 0,
    });
  });

  it("badge defaults are sane", () => {
    const s = useAppStore.getState();
    expect(s.badgeEnabled).toBe(false);
    expect(s.badgeX).toBe(90);
    expect(s.badgeY).toBe(90);
    expect(s.badgeSize).toBe(100);
    expect(s.badgeCircleColor).toEqual([1, 1, 1]);
    expect(s.badgeTextColor).toEqual([0, 0, 0]);
  });

  it("logo defaults are sane", () => {
    const s = useAppStore.getState();
    expect(s.logoEnabled).toBe(false);
    expect(s.logoPath).toBeNull();
    expect(s.logoX).toBe(990);
  });

  it("setBadgeText sets free text at the given iteration without disturbing others", () => {
    useAppStore.getState().setBadgeText(0, "25+");
    useAppStore.getState().setBadgeText(2, "50% OFF");
    expect(useAppStore.getState().badgeTexts[0]).toBe("25+");
    expect(useAppStore.getState().badgeTexts[2]).toBe("50% OFF");
    expect(useAppStore.getState().badgeTexts[1]).toBeUndefined();
  });

  it("setBadgeEnabled/X/Y/Size/CircleColor/TextColor update their fields independently", () => {
    useAppStore.getState().setBadgeEnabled(true);
    useAppStore.getState().setBadgeX(10);
    useAppStore.getState().setBadgeY(20);
    useAppStore.getState().setBadgeSize(50);
    useAppStore.getState().setBadgeCircleColor([0.5, 0.5, 0.5]);
    useAppStore.getState().setBadgeTextColor([1, 1, 0]);
    const s = useAppStore.getState();
    expect(s.badgeEnabled).toBe(true);
    expect(s.badgeX).toBe(10);
    expect(s.badgeY).toBe(20);
    expect(s.badgeSize).toBe(50);
    expect(s.badgeCircleColor).toEqual([0.5, 0.5, 0.5]);
    expect(s.badgeTextColor).toEqual([1, 1, 0]);
  });

  it("setLogoEnabled/Path/X/Y/Size update their fields independently", () => {
    useAppStore.getState().setLogoEnabled(true);
    useAppStore.getState().setLogoPath("/logos/brand.png");
    useAppStore.getState().setLogoX(100);
    useAppStore.getState().setLogoY(200);
    useAppStore.getState().setLogoSize(75);
    const s = useAppStore.getState();
    expect(s.logoEnabled).toBe(true);
    expect(s.logoPath).toBe("/logos/brand.png");
    expect(s.logoX).toBe(100);
    expect(s.logoY).toBe(200);
    expect(s.logoSize).toBe(75);
  });

  it("setLogoLayerIndex updates its field", () => {
    useAppStore.getState().setLogoLayerIndex(5);
    expect(useAppStore.getState().logoLayerIndex).toBe(5);
  });

  it("setBadgeLayerIndex updates its field", () => {
    useAppStore.getState().setBadgeLayerIndex(5);
    expect(useAppStore.getState().badgeLayerIndex).toBe(5);
  });

  it("setLogoPerIteration sets a per-iteration flag without disturbing others", () => {
    useAppStore.getState().setLogoPerIteration(0, false);
    useAppStore.getState().setLogoPerIteration(2, false);
    expect(useAppStore.getState().logoPerIteration[0]).toBe(false);
    expect(useAppStore.getState().logoPerIteration[2]).toBe(false);
    expect(useAppStore.getState().logoPerIteration[1]).toBeUndefined();
  });
});
