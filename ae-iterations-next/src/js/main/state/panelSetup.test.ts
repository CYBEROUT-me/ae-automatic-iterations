import { describe, it, expect } from "vitest";
import { captureSetup, applySetup } from "./panelSetup";
import { useAppStore } from "./store";

describe("captureSetup", () => {
  it("captures overlay/global config", () => {
    useAppStore.setState({
      mode: "var", count: 4, varNames: ["A", "B"],
      badgeEnabled: true, badgeX: 120, badgeCircleColor: [1, 0, 0],
      logoEnabled: true, logoPath: "/logos/x.png",
    });
    const setup = captureSetup(useAppStore.getState());
    expect(setup.mode).toBe("var");
    expect(setup.count).toBe(4);
    expect(setup.varNames).toEqual(["A", "B"]);
    expect(setup.badgeEnabled).toBe(true);
    expect(setup.badgeX).toBe(120);
    expect(setup.badgeCircleColor).toEqual([1, 0, 0]);
    expect(setup.logoPath).toBe("/logos/x.png");
  });

  it("does not capture comp-specific state, which must come from a Refresh", () => {
    useAppStore.setState({
      compName: "Some Comp",
      layerInfo: [{ name: "L", index: 1, type: "shape" }],
      values: { "1": [{ color: [1, 0, 0] }] },
    });
    const setup = captureSetup(useAppStore.getState()) as Record<string, unknown>;
    expect(setup.compName).toBeUndefined();
    expect(setup.layerInfo).toBeUndefined();
    expect(setup.rowLayers).toBeUndefined();
    expect(setup.values).toBeUndefined();
  });
});

describe("applySetup", () => {
  it("returns an empty patch for null/garbage input", () => {
    expect(applySetup(null)).toEqual({});
    expect(applySetup(undefined)).toEqual({});
    expect(applySetup("nonsense" as never)).toEqual({});
  });

  it("applies valid fields", () => {
    const patch = applySetup({ mode: "var", count: 3, badgeEnabled: true, logoPath: "/l.png" });
    expect(patch.mode).toBe("var");
    expect(patch.count).toBe(3);
    expect(patch.badgeEnabled).toBe(true);
    expect(patch.logoPath).toBe("/l.png");
  });

  it("drops fields of the wrong type instead of applying them", () => {
    const patch = applySetup({
      count: "five" as never,
      badgeEnabled: "yes" as never,
      badgeCircleColor: [1, 0] as never,
      varNames: [1, 2] as never,
    });
    expect(patch.count).toBeUndefined();
    expect(patch.badgeEnabled).toBeUndefined();
    expect(patch.badgeCircleColor).toBeUndefined();
    expect(patch.varNames).toBeUndefined();
  });

  it("rejects a NaN count, which would otherwise render zero rows with no explanation", () => {
    expect(applySetup({ count: NaN }).count).toBeUndefined();
    expect(applySetup({ count: Infinity }).count).toBeUndefined();
  });

  it("clamps count to the range the UI itself accepts", () => {
    expect(applySetup({ count: 0 }).count).toBeUndefined();
    expect(applySetup({ count: 999 }).count).toBeUndefined();
    expect(applySetup({ count: 5 }).count).toBe(5);
  });

  it("rejects an unknown mode", () => {
    expect(applySetup({ mode: "sideways" }).mode).toBeUndefined();
    expect(applySetup({ mode: "itr" }).mode).toBe("itr");
  });

  it("accepts null logoPath (no logo chosen) but not a non-string", () => {
    expect(applySetup({ logoPath: null })).toHaveProperty("logoPath", null);
    expect(applySetup({ logoPath: 42 as never }).logoPath).toBeUndefined();
  });

  it("round-trips a captured setup unchanged", () => {
    useAppStore.setState({
      mode: "var", count: 5, sameForAll: false, varNames: ["X", "Y"],
      badgeEnabled: true, badgeTexts: ["25+", null], badgeCircleColor: [1, 1, 1],
      badgeTextColor: [0, 0, 0], badgeEnabledPerIteration: [true, false],
      logoEnabled: true, logoPath: "/l.png", logoPerIteration: [false, true],
    });
    const captured = captureSetup(useAppStore.getState());
    const patch = applySetup(captured);
    expect(patch.mode).toBe("var");
    expect(patch.count).toBe(5);
    expect(patch.sameForAll).toBe(false);
    expect(patch.varNames).toEqual(["X", "Y"]);
    expect(patch.badgeTexts).toEqual(["25+", null]);
    expect(patch.badgeEnabledPerIteration).toEqual([true, false]);
    expect(patch.logoPerIteration).toEqual([false, true]);
  });
});
