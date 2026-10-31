import { describe, expect, it } from "vitest";
import { rotatingTavernBounties } from "./tavern-services.js";

describe("tavern tower board", () => {
  it("shows three distinct contracts with honest objectives and rewards", () => {
    const bounties = rotatingTavernBounties(new Date("2026-10-31T12:00:00Z"));
    expect(bounties).toHaveLength(3);
    expect(new Set(bounties.map(bounty => bounty.id))).toHaveLength(3);
    expect(bounties.every(bounty => bounty.objective.length > 12 && bounty.reward.length > 8)).toBe(true);
  });

  it("rotates on a later day", () => {
    expect(rotatingTavernBounties(new Date("2026-10-31T12:00:00Z")).map(bounty => bounty.id))
      .not.toEqual(rotatingTavernBounties(new Date("2026-11-01T12:00:00Z")).map(bounty => bounty.id));
  });
});
