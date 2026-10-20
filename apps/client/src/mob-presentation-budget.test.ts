import { describe, expect, it } from "vitest";
import { MOB_PRESENTATION_RANGE, mobPresentationVisible } from "./mob-presentation-budget.js";

describe("mob presentation budget", () => {
  it("renders enemies throughout the active streamed play area", () => {
    expect(mobPresentationVisible(true, MOB_PRESENTATION_RANGE)).toBe(true);
  });

  it("removes distant and world-hidden enemies from render and animation work", () => {
    expect(mobPresentationVisible(true, MOB_PRESENTATION_RANGE + .01)).toBe(false);
    expect(mobPresentationVisible(false, 1)).toBe(false);
  });
});
