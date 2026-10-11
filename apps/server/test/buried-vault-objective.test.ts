import { describe, expect, it } from "vitest";
import { nearbyObjective } from "../src/world-objectives.js";

const player = { x: 52.5, y: 1, z: 9.5, health: 5, miningExpeditionStage: 8, inventory: new Map<string, { quantity: number }>() };
const mob = (x: number, z: number, alive = true) => ({ x, y: 1, z, alive, name: "Vault enemy", difficultyTier: 3, combatState: "idle", targetId: "" });

describe("buried vault objective", () => {
  it("groups the sealed chamber defenders into one mining-combat objective", () => {
    const result = nearbyObjective("miner", player, new Map([
      ["buried-vault-crawler", mob(54.5, 10.5)],
      ["buried-chamber-brute", mob(56.5, 9.5)],
    ]), new Map(), new Map(), 10_000, null);
    expect(result.objectiveId).toBe("buried-vault");
    expect(result.title).toBe("Breach the Buried Vault");
    expect(result.targetMobIds).toEqual(["buried-vault-crawler", "buried-chamber-brute"]);
  });

  it("switches to the personal lantern cache after the defenders fall", () => {
    const result = nearbyObjective("miner", player, new Map([
      ["buried-vault-crawler", mob(54.5, 10.5, false)],
      ["buried-chamber-brute", mob(56.5, 9.5, false)],
    ]), new Map(), new Map([["buried-chamber-brute:10000:1", {
      x: 56.5, y: 1.2, z: 9.5, ownerId: "miner", itemId: "miners_lantern", expiresAt: 40_000,
    }]]), 10_000, "buried-vault");
    expect(result.kind).toBe("loot");
    expect(result.title).toBe("Collect Your Loot");
  });
});
