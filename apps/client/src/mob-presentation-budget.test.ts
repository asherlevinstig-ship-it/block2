import { describe, expect, it } from "vitest";
import { MOB_FULL_DETAIL_RANGE, MOB_PRESENTATION_RANGE, mobPresentationDetail,
  mobPresentationInitialDelay, mobPresentationIntervalMs, mobPresentationVisible } from "./mob-presentation-budget.js";

describe("mob presentation budget", () => {
  it("renders enemies throughout the active streamed play area", () => {
    expect(mobPresentationVisible(true, MOB_PRESENTATION_RANGE)).toBe(true);
  });

  it("removes distant and world-hidden enemies from render and animation work", () => {
    expect(mobPresentationVisible(true, MOB_PRESENTATION_RANGE + .01)).toBe(false);
    expect(mobPresentationVisible(false, 1)).toBe(false);
  });

  it("uses articulated models nearby and a cheap silhouette at distance", () => {
    expect(mobPresentationDetail(true, MOB_FULL_DETAIL_RANGE)).toBe("full");
    expect(mobPresentationDetail(true, MOB_FULL_DETAIL_RANGE + .01)).toBe("lod");
    expect(mobPresentationDetail(true, MOB_PRESENTATION_RANGE + .01)).toBe("hidden");
  });

  it("reduces only the visual sampling rate for distant enemies", () => {
    expect(mobPresentationIntervalMs("full", 20)).toBe(0);
    expect(mobPresentationIntervalMs("lod", 40)).toBe(100);
    expect(mobPresentationIntervalMs("lod", 60)).toBe(200);
  });

  it("stagger-schedules distant mobs within their presentation interval", () => {
    const delays = ["mob-a", "mob-b", "mob-c", "mob-d"].map(id => mobPresentationInitialDelay(id, 200));
    expect(delays.every(delay => delay >= 0 && delay < 200)).toBe(true);
    expect(new Set(delays).size).toBeGreaterThan(1);
    expect(mobPresentationInitialDelay("mob-a", 0)).toBe(0);
  });
});
