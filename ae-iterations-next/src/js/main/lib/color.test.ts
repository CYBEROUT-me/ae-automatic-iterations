import { describe, it, expect } from "vitest";
import { hexToRgb, rgbToHex, normaliseHex } from "./color";

describe("hexToRgb", () => {
  it("converts pure red", () => {
    expect(hexToRgb("#FF0000")).toEqual([1, 0, 0]);
  });
  it("converts a mid-tone value", () => {
    const [r, g, b] = hexToRgb("#7F7F7F");
    expect(r).toBeCloseTo(0.498, 2);
    expect(g).toBeCloseTo(0.498, 2);
    expect(b).toBeCloseTo(0.498, 2);
  });
});

describe("rgbToHex", () => {
  it("converts pure blue back to hex", () => {
    expect(rgbToHex([0, 0, 1])).toBe("#0000ff");
  });
  it("round-trips with hexToRgb", () => {
    expect(rgbToHex(hexToRgb("#00FF00"))).toBe("#00ff00");
  });
});

describe("normaliseHex", () => {
  it("accepts a hex string without a leading #", () => {
    expect(normaliseHex("ff0000")).toBe("#FF0000");
  });
  it("accepts a hex string with a leading #", () => {
    expect(normaliseHex("#00ff00")).toBe("#00FF00");
  });
  it("rejects an invalid hex string", () => {
    expect(normaliseHex("not-a-color")).toBeNull();
  });
  it("trims whitespace before validating", () => {
    expect(normaliseHex("  #0000ff  ")).toBe("#0000FF");
  });
});
