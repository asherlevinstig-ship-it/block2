import { describe, expect, it } from "vitest";
import { rapidPracticeCollisionCellSolid, TOWER_FLOOR_ONE } from "./index.js";
import { INTERACTION_TEST_PLAYER, INTERACTION_TEST_PLAYER_ID, isInteractionTestPlayer } from "./interaction-test-player.js";

describe("interaction test player", () => {
  it("is clearly labelled, wounded and positioned beside the town spawn", () => {
    expect(INTERACTION_TEST_PLAYER.name).toContain("BOT");
    expect(INTERACTION_TEST_PLAYER.health).toBeLessThan(INTERACTION_TEST_PLAYER.maxHealth);
    expect(Math.hypot(INTERACTION_TEST_PLAYER.x - 99.5, INTERACTION_TEST_PLAYER.z - 106.5)).toBeLessThanOrEqual(4);
  });

  it("stands on the open arrival road rather than inside the tower portal", () => {
    expect(rapidPracticeCollisionCellSolid(
      INTERACTION_TEST_PLAYER.x, INTERACTION_TEST_PLAYER.y, INTERACTION_TEST_PLAYER.z,
    )).toBe(false);
    expect(Math.hypot(
      INTERACTION_TEST_PLAYER.x - TOWER_FLOOR_ONE.townPortal.x,
      INTERACTION_TEST_PLAYER.z - TOWER_FLOOR_ONE.townPortal.z,
    )).toBeGreaterThan(6);
    expect(INTERACTION_TEST_PLAYER.x).toBeLessThan(99.5);
  });

  it("only recognises the reserved server-owned player id", () => {
    expect(isInteractionTestPlayer(INTERACTION_TEST_PLAYER_ID)).toBe(true);
    expect(isInteractionTestPlayer("real-player")).toBe(false);
  });
});
