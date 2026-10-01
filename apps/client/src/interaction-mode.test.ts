import { describe, expect, it } from "vitest";
import { alternateInteractionMode, primaryActionForMode } from "./interaction-mode.js";

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
});
