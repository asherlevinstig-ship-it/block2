import { describe, expect, it } from "vitest";
import { activeObjective, createObjectiveProgress, creditObjectiveDefeat, nextObjectiveTarget } from "./world-objectives.js";

describe("world objective director", () => {
  it("starts players on the nearby briar disturbance", () => {
    const progress = createObjectiveProgress();
    expect(activeObjective(progress).id).toBe("briar-disturbance");
    expect(nextObjectiveTarget(progress)).toBe("greenwood-briar");
  });

  it("ignores unrelated defeats and requires every camp target", () => {
    const progress = createObjectiveProgress();
    expect(creditObjectiveDefeat(progress, "moss-crawler").completed).toBeUndefined();
    expect(creditObjectiveDefeat(progress, "greenwood-briar").completed?.id).toBe("briar-disturbance");
    expect(creditObjectiveDefeat(progress, "wild-crawler").completed).toBeUndefined();
    expect(nextObjectiveTarget(progress)).toBe("greenwood-briar-north");
    expect(creditObjectiveDefeat(progress, "greenwood-briar-north").completed?.id).toBe("overgrown-camp");
  });

  it("loops into a new event cycle after the frontier encounter", () => {
    const progress = createObjectiveProgress();
    creditObjectiveDefeat(progress, "greenwood-briar");
    creditObjectiveDefeat(progress, "wild-crawler");
    creditObjectiveDefeat(progress, "greenwood-briar-north");
    expect(creditObjectiveDefeat(progress, "stone-brute").completed?.id).toBe("stone-awakening");
    expect(activeObjective(progress).id).toBe("briar-disturbance");
  });
});
