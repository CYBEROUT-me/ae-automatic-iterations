import { describe, it, expect } from "vitest";
import { applyLayerValueFailures } from "./applyLayerValue";

describe("applyLayerValueFailures", () => {
  it("returns an empty array when every line in the log is OK", () => {
    const log = ["→ shapeColor: OK"];
    expect(applyLayerValueFailures(log)).toEqual([]);
  });

  it("returns only the FAILED lines, preserving their text", () => {
    const log = ["→ textColor: OK", "→ textFont: FAILED", "→ nothing to apply (no content, no color, no font)"];
    expect(applyLayerValueFailures(log)).toEqual(["→ textFont: FAILED"]);
  });

  it("returns multiple FAILED lines when more than one property fails", () => {
    const log = ["→ shapeColor: FAILED", "→ strokeColor: FAILED"];
    expect(applyLayerValueFailures(log)).toEqual(["→ shapeColor: FAILED", "→ strokeColor: FAILED"]);
  });

  it("returns an empty array for an empty log", () => {
    expect(applyLayerValueFailures([])).toEqual([]);
  });
});
