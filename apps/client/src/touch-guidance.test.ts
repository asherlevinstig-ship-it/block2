import { describe, expect, it } from "vitest";
import { touchGuidanceText } from "./touch-guidance.js";

describe("tablet input guidance", () => {
  it("names visible touch controls instead of keyboard keys", () => {
    expect(touchGuidanceText("Press I to open your inventory.")).toBe("Tap PACK to open your inventory.");
    expect(touchGuidanceText("Hold E to collect the bag.")).toBe("Hold INTERACT to collect the bag.");
    expect(touchGuidanceText("Press G to use it. Press F to use your Special.")).toBe(
      "Tap POWER to use it. Tap SPECIAL to use your Special.",
    );
    expect(touchGuidanceText("Press J or attack to strike. Space dodges.")).toBe("Tap ATTACK to strike. Tap DODGE.");
    expect(touchGuidanceText("Tap J for a spark · hold J to weave. Hold R to aim."))
      .toBe("Tap ATTACK for a spark · Hold ATTACK to weave. Hold POWER to aim.");
  });

  it("gives tablet players an explicit back action", () => {
    expect(touchGuidanceText("Press I or ESC to close")).toBe("Tap BACK to close");
    expect(touchGuidanceText("Esc to close")).toBe("Tap BACK to close");
  });
});

