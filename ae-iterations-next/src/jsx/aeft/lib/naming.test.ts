import { describe, it, expect } from "vitest";
import { incrementProjectId, stripAspectSuffix } from "./naming";

describe("incrementProjectId", () => {
  it("increments the second underscore-delimited segment", () => {
    expect(incrementProjectId("LO_10794_4378_M11_S0_EN_usr_CAM_PRI_Video_ITR_9x16"))
      .toBe("LO_10795_4378_M11_S0_EN_usr_CAM_PRI_Video_ITR_9x16");
  });

  it("carries over a multi-digit rollover", () => {
    expect(incrementProjectId("LO_10799_4378")).toBe("LO_10800_4378");
  });

  it("only touches the second segment, not others", () => {
    expect(incrementProjectId("LO_1_2_3")).toBe("LO_2_2_3");
  });
});

describe("stripAspectSuffix", () => {
  it("strips a trailing _9x16 suffix", () => {
    expect(stripAspectSuffix("TL_11352_Video_VAR_9x16")).toBe("TL_11352_Video_VAR");
  });

  it("strips a trailing _4x5 suffix", () => {
    expect(stripAspectSuffix("TL_11352_Video_VAR_4x5")).toBe("TL_11352_Video_VAR");
  });

  it("returns the name unchanged when no aspect suffix is present", () => {
    expect(stripAspectSuffix("TL_11352_Video_VAR")).toBe("TL_11352_Video_VAR");
  });

  it("only strips a trailing suffix, not one that appears mid-string", () => {
    expect(stripAspectSuffix("TL_9x16_Video_VAR_1x1")).toBe("TL_9x16_Video_VAR");
  });
});
