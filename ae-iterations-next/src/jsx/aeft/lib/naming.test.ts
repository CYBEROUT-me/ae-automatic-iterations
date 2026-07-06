import { describe, it, expect } from "vitest";
import { incrementProjectId } from "./naming";

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
