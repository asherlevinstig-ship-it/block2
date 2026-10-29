import { describe, expect, it } from "vitest";
import { ACTIVE_GAME_INTERACTION_MODE, primaryActionForMode } from "./interaction-mode.js";

describe("interaction mode", () => {
  it("routes build clicks to mining", () => {
    expect(primaryActionForMode("build")).toBe("mine");
  });

  it("routes combat clicks to attacks", () => {
    expect(primaryActionForMode("combat")).toBe("attack");
  });

  it("keeps the active game permanently in combat", () => {
    expect(ACTIVE_GAME_INTERACTION_MODE).toBe("combat");
    expect(primaryActionForMode(ACTIVE_GAME_INTERACTION_MODE)).toBe("attack");
  });
});
