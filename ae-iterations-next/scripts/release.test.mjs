import { describe, it, expect } from "vitest";
import { resolveVersion } from "./release.mjs";

describe("resolveVersion", () => {
  it("auto-increments the patch version when no explicit version is given", () => {
    expect(resolveVersion("0.4.0", undefined)).toBe("0.4.1");
  });

  it("carries over a multi-digit rollover", () => {
    expect(resolveVersion("0.4.9", undefined)).toBe("0.4.10");
  });

  it("uses the explicit version verbatim when given", () => {
    expect(resolveVersion("0.4.0", "1.0.0")).toBe("1.0.0");
  });
});
