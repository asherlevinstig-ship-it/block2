import { describe, expect, it } from "vitest";
import { alternateInteractionMode, portalArrivalInteractionMode, primaryActionForMode } from "./interaction-mode.js";

describe("interaction mode", () => {
  it("routes build clicks to mining", () => {
    expect(primaryActionForMode("build")).toBe("mine");
  });

  it("routes combat clicks to attacks", () => {
    expect(primaryActionForMode("combat")).toBe("attack");
  });

  it("toggles between build and combat", () => {
    expect(alternateInteractionMode("build")).toBe("combat");
    expect(alternateInteractionMode("combat")).toBe("build");
  });

  it("restores combat controls whenever a player enters through a dungeon portal", () => {
    expect(portalArrivalInteractionMode("build", true)).toBe("combat");
    expect(portalArrivalInteractionMode("combat", true)).toBe("combat");
  });

  it("does not force a mode when returning to town", () => {
    expect(portalArrivalInteractionMode("build", false)).toBe("build");
    expect(portalArrivalInteractionMode("combat", false)).toBe("combat");
  });
});
