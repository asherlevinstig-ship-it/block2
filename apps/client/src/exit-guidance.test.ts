import { describe, expect, it } from "vitest";
import { MILESTONE_EXIT_STEPS } from "./exit-guidance.js";

describe("underground exit guidance", () => {
  it("marks a continuous route whose steps rise by no more than one block", () => {
    for (let index = 1; index < MILESTONE_EXIT_STEPS.length; index += 1) {
      const previous = MILESTONE_EXIT_STEPS[index - 1]!;
      const current = MILESTONE_EXIT_STEPS[index]!;
      expect(Math.hypot(current.x - previous.x, current.z - previous.z)).toBeLessThanOrEqual(1);
      expect(current.topY - previous.topY).toBeGreaterThanOrEqual(0);
      expect(current.topY - previous.topY).toBeLessThanOrEqual(1);
    }
    expect(MILESTONE_EXIT_STEPS.at(-1)?.topY).toBe(7);
  });
});
