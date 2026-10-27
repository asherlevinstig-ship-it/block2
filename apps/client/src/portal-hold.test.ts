import { describe, expect, it } from "vitest";
import { portalHoldProgress } from "./portal-hold.js";
describe("hold to travel", () => {
  const hold = { portalId: "entry", startedAt: 1000, source: "keyboard" as const };
  it("matches the loot hold duration", () => {
    expect(portalHoldProgress(hold, 1375, "entry")).toBe(.5);
    expect(portalHoldProgress(hold, 1750, "entry")).toBe(1);
  });
  it("requires the original reachable portal for completion", () => {
    expect(portalHoldProgress(hold, 1800, null)).toBe(0);
    expect(portalHoldProgress(hold, 1800, "return")).toBe(0);
    expect(portalHoldProgress(null, 1800, "entry")).toBe(0);
  });
});
