import { describe, expect, it } from "vitest";
import { portalInteractionPrompt, portalLabel, portalWorldLabel } from "./portal-labels.js";

describe("portal labels", () => {
  it("names both directions of Floor 1 explicitly", () => {
    expect(portalWorldLabel(portalLabel("tower-floor-1-entry", "tower-entry"))).toContain("ENTER FLOOR 1");
    expect(portalInteractionPrompt(portalLabel("tower-floor-1-return", "tower-return"))).toBe("RETURN TO TOWN · press E to return");
  });

  it("presents future floors and locked challenges as sealed", () => {
    const floorTwo = portalLabel("tower-floor-2-locked", "tower-locked");
    expect(floorTwo.locked).toBe(true);
    expect(portalWorldLabel(floorTwo)).toContain("ASCENT GATE · SEALED");
    expect(portalLabel("warden-gate", "entry", false).action).toBe("SEALED");
  });
});
