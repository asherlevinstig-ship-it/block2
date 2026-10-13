import { describe, expect, it } from "vitest";
import { advanceMiningExpedition, isBuriedVaultSeal, isInsideEastMine } from "./mining-expedition.js";

describe("first mining expedition", () => {
  it("advances through discovery milestones and completes when the lantern is claimed", () => {
    const events = ["briefed", "entered_mine", "mined_iron", "mined_silver", "breached_vault", "defeated_warden", "claimed_lantern"] as const;
    let stage = 0;
    expect(advanceMiningExpedition(stage, "mined_iron")).toBe(0);
    for (const event of events) stage = advanceMiningExpedition(stage, event);
    expect(stage).toBe(8);
    expect(advanceMiningExpedition(stage, "returned_to_blacksmith")).toBe(8);
    expect(advanceMiningExpedition(7, "returned_to_blacksmith")).toBe(8);
  });

  it("recognizes the authored mine and its silver vault seal", () => {
    expect(isInsideEastMine({ x: 37.5, y: 3, z: 8.5 })).toBe(true);
    expect(isInsideEastMine({ x: 37.5, y: 8, z: 8.5 })).toBe(false);
    expect(isBuriedVaultSeal(52, 2, 9)).toBe(true);
    expect(isBuriedVaultSeal(51, 2, 9)).toBe(false);
  });
});
