import { describe, it, expect } from "vitest";
import { buildRowLayers } from "./rowLayers";
import type { LayerInfo } from "../../../shared/types";

describe("buildRowLayers", () => {
  it("makes one row for a shape layer with a fill and no strokes", () => {
    const layers: LayerInfo[] = [
      { name: "Rect", index: 1, type: "shape", fills: [{ path: "Contents/Group 1/Contents/Fill 1", color: [1, 0, 0] }], strokes: [] },
    ];
    const rows = buildRowLayers(layers);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ layerIndex: 1, type: "shape", fillPath: "Contents/Group 1/Contents/Fill 1" });
  });

  it("adds one synthetic stroke row per stroke, sharing the parent layer index", () => {
    const layers: LayerInfo[] = [
      {
        name: "Rect", index: 1, type: "shape",
        fills: [{ path: "Contents/Group 1/Contents/Fill 1", color: [1, 0, 0] }],
        strokes: [{ path: "Contents/Group 1/Contents/Stroke 1", color: [0, 0, 0] }],
      },
    ];
    const rows = buildRowLayers(layers);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ layerIndex: 1, type: "stroke", fillPath: "Contents/Group 1/Contents/Stroke 1" });
    expect(rows[1].rowKey).not.toBe(rows[0].rowKey);
  });

  it("passes through text and video layers as single rows", () => {
    const layers: LayerInfo[] = [
      { name: "Title", index: 2, type: "text", color: [1, 1, 1], font: "Helvetica", text: "Hi" },
      { name: "BG", index: 3, type: "video", videoState: { flip: false, bw: false, tint: null, tintAmount: 50, hue: 0 } },
    ];
    const rows = buildRowLayers(layers);
    expect(rows.map((r) => r.type)).toEqual(["text", "video"]);
    expect(rows[0].fillPath).toBe("");
  });
});
