import { describe, expect, it } from "vitest";
import { silverDepthsMoonstoneReward, silverDepthsRank } from "./silver-depths-results.js";

describe("Silver Depths results", () => {
  it("requires both a fast and controlled clear for gold", () => {
    expect(silverDepthsRank(180_000, 3)).toBe("GOLD");
    expect(silverDepthsRank(180_000, 4)).toBe("SILVER");
  });
  it("awards silver for a solid clear and bronze otherwise", () => {
    expect(silverDepthsRank(300_000, 8)).toBe("SILVER");
    expect(silverDepthsRank(300_001, 0)).toBe("BRONZE");
    expect(silverDepthsRank(120_000, 9)).toBe("BRONZE");
  });
  it("pays one, two, or three Moonstone by rank", () => {
    expect(silverDepthsMoonstoneReward("BRONZE")).toBe(1);
    expect(silverDepthsMoonstoneReward("SILVER")).toBe(2);
    expect(silverDepthsMoonstoneReward("GOLD")).toBe(3);
  });
});
