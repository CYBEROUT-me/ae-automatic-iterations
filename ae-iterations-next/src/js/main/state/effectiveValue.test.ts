import { describe, it, expect } from "vitest";
import { effectiveValue } from "./effectiveValue";
import type { RowLayer } from "./rowLayers";
import type { LayerValue } from "../../../shared/types";

const shapeRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "shape", name: "Rect", fillPath: "Contents/Fill 1" };
const strokeRow: RowLayer = { layerIndex: 1, rowKey: "1:stroke:0", type: "stroke", name: "Stroke — Rect", fillPath: "Contents/Stroke 1" };
const textRow: RowLayer = { layerIndex: 2, rowKey: "2", type: "text", name: "Title", fillPath: "" };
const videoRow: RowLayer = { layerIndex: 3, rowKey: "3", type: "video", name: "BG", fillPath: "" };

const rowLayers: RowLayer[] = [shapeRow, strokeRow, textRow, videoRow];

describe("effectiveValue", () => {
  it("returns the row's own value when sameForAll is false", () => {
    const values: Record<string, LayerValue[]> = {
      "1": [{ color: [1, 0, 0] }],
      "2": [{ color: [0, 1, 0], font: "Arial-Bold" }],
    };
    expect(effectiveValue(rowLayers, values, false, shapeRow, 0)).toEqual({ color: [1, 0, 0] });
    expect(effectiveValue(rowLayers, values, false, textRow, 0)).toEqual({ color: [0, 1, 0], font: "Arial-Bold" });
  });

  it("borrows row 0's color for a non-first shape row when sameForAll is true", () => {
    // simulate a second shape layer (different layerIndex) at rowKey "9"
    const secondShapeRow: RowLayer = { layerIndex: 9, rowKey: "9", type: "shape", name: "Rect2", fillPath: "Contents/Fill 1" };
    const rows = [shapeRow, secondShapeRow];
    const values: Record<string, LayerValue[]> = {
      "1": [{ color: [1, 0, 0] }],
      "9": [{ color: [0, 0, 1] }], // own value should be ignored
    };
    expect(effectiveValue(rows, values, true, secondShapeRow, 0)).toEqual({ color: [1, 0, 0] });
  });

  it("borrows row 0's color and font for a non-first text row when sameForAll is true", () => {
    const values: Record<string, LayerValue[]> = {
      "1": [{ color: [1, 0, 0] }],
      "2": [{ color: [0, 1, 0], font: "Arial-Bold" }],
    };
    const result = effectiveValue(rowLayers, values, true, textRow, 0);
    expect(result).toEqual({ color: [1, 0, 0], font: undefined });
  });

  it("borrows row 0's actual font string for a non-first text row when row 0 is itself a text layer", () => {
    // row 0 here is a real text layer with a real (non-undefined) font, so this
    // asserts the borrowing row receives that exact string rather than relying
    // on `undefined === undefined` by construction.
    const firstTextRow: RowLayer = { layerIndex: 1, rowKey: "1", type: "text", name: "Headline", fillPath: "" };
    const secondTextRow: RowLayer = { layerIndex: 2, rowKey: "2", type: "text", name: "Subhead", fillPath: "" };
    const rows = [firstTextRow, secondTextRow];
    const values: Record<string, LayerValue[]> = {
      "1": [{ color: [1, 0, 0], font: "Helvetica-Bold" }],
      "2": [{ color: [0, 0, 1], font: "Arial-Bold" }], // own value should be ignored
    };
    const result = effectiveValue(rows, values, true, secondTextRow, 0);
    expect(result).toEqual({ color: [1, 0, 0], font: "Helvetica-Bold" });
    expect(result?.font).toBe("Helvetica-Bold");
  });

  it("never borrows for stroke rows even when sameForAll is true", () => {
    const values: Record<string, LayerValue[]> = {
      "1": [{ color: [1, 0, 0] }],
      "1:stroke:0": [{ color: [0.5, 0.5, 0.5] }],
    };
    expect(effectiveValue(rowLayers, values, true, strokeRow, 0)).toEqual({ color: [0.5, 0.5, 0.5] });
  });

  it("never borrows for video rows even when sameForAll is true", () => {
    const values: Record<string, LayerValue[]> = {
      "1": [{ color: [1, 0, 0] }],
      "3": [{ flip: true, bw: false, tint: null, tintAmount: 50, hue: 0 }],
    };
    expect(effectiveValue(rowLayers, values, true, videoRow, 0)).toEqual({
      flip: true,
      bw: false,
      tint: null,
      tintAmount: 50,
      hue: 0,
    });
  });

  it("returns the row's own value for row 0 itself, regardless of sameForAll", () => {
    const values: Record<string, LayerValue[]> = { "1": [{ color: [1, 0, 0] }] };
    expect(effectiveValue(rowLayers, values, true, shapeRow, 0)).toEqual({ color: [1, 0, 0] });
  });

  it("falls back to the row's own value when row 0 has no value yet for that iteration", () => {
    const values: Record<string, LayerValue[]> = {
      "2": [{ color: [0, 1, 0], font: "Arial-Bold" }],
    };
    // row 0 (shapeRow) has no value at all -> firstVal undefined -> own returned (also undefined here)
    expect(effectiveValue(rowLayers, values, true, textRow, 0)).toEqual({ color: [0, 1, 0], font: "Arial-Bold" });
  });
});
