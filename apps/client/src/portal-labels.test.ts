import { describe, expect, it } from "vitest";
import { portalInteractionPrompt, portalLabel, portalWorldLabel } from "./portal-labels.js";

describe("portal labels", () => {
  it("names both directions of Floor 1 explicitly", () => {
    expect(portalWorldLabel(portalLabel("tower-floor-1-entry", "tower-entry"))).toContain("TOWER DIRECTORY");
    expect(portalInteractionPrompt(portalLabel("tower-floor-1-entry", "tower-entry"))).toBe("TOWER DIRECTORY · hold E to choose");
    expect(portalInteractionPrompt(portalLabel("tower-floor-1-return", "tower-return"))).toBe("RETURN TO TOWN · hold E to return");
  });

  it("presents future floors and locked challenges as sealed", () => {
    const floorTwo = portalLabel("tower-floor-2-locked", "tower-locked");
    expect(floorTwo.locked).toBe(true);
    expect(portalWorldLabel(floorTwo)).toContain("ASCENT GATE · SEALED");
    expect(portalLabel("warden-gate", "entry", false).action).toBe("SEALED");
  });

  it("names both sides of the Floor 2 greybox", () => {
    expect(portalLabel("tower-floor-2-entry", "tower-entry")).toMatchObject({ title: "ENTER FLOOR 2", locked: false });
    expect(portalInteractionPrompt(portalLabel("tower-floor-2-return", "tower-return")))
      .toBe("RETURN TO FLOOR 1 · hold E to return");
    expect(portalLabel("tower-floor-3-locked", "tower-locked").locked).toBe(true);
  });

  it("names both sides of the tavern doorway", () => {
    expect(portalLabel("tavern-entry", "tavern-entry").title).toBe("THE HEARTH & HAMMER");
    expect(portalInteractionPrompt(portalLabel("tavern-exit", "tavern-exit"))).toBe("RETURN TO TOWN · hold E to return");
  });
});
