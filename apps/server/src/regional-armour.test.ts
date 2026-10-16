import { describe, expect, it, vi } from "vitest";
import { isMistfenToxicPool } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";
import { FENWALKER_POOL_WARD_COOLDOWN_MS, fenwalkerBlocksPoolPulse, foragerRecoveryBonus } from "./regional-armour.js";

describe("regional field armour", () => {
  it("recovers extra stamina only in surface Greenwood with the Forager Wrap", () => {
    expect(foragerRecoveryBonus("forager_wrap", 40, 8, 12)).toBe(4);
    expect(foragerRecoveryBonus("forager_wrap", 40, 5, 12)).toBe(0);
    expect(foragerRecoveryBonus("forager_wrap", 0, 8, 0)).toBe(0);
    expect(foragerRecoveryBonus("leather_armour", 40, 8, 12)).toBe(0);
  });

  it("limits the Fenwalker ward to surface Mistfen and its cooldown", () => {
    expect(fenwalkerBlocksPoolPulse("fenwalker_mantle", -40, 8, -20, 10_000, 0)).toBe(true);
    expect(fenwalkerBlocksPoolPulse("fenwalker_mantle", -40, 8, -20, 11_000,
      10_000 + FENWALKER_POOL_WARD_COOLDOWN_MS)).toBe(false);
    expect(fenwalkerBlocksPoolPulse("fenwalker_mantle", -40, 8, -20, 12_500,
      10_000 + FENWALKER_POOL_WARD_COOLDOWN_MS)).toBe(true);
    expect(fenwalkerBlocksPoolPulse("fenwalker_mantle", -40, 5, -20, 10_000, 0)).toBe(false);
    expect(fenwalkerBlocksPoolPulse("leather_armour", -40, 8, -20, 10_000, 0)).toBe(false);
  });

  it("wards off alternating natural pool pulses without removing the marsh danger", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const player = new PlayerState();
    const pool = Array.from({ length: 38 * 32 }, (_, index) => ({ x: -58 + index % 38, z: -43 + Math.floor(index / 38) }))
      .find(({ x, z }) => isMistfenToxicPool(x, z));
    expect(pool).toBeDefined();
    Object.assign(player, { ...pool, y: 8, health: 5, maxHealth: 5, armourId: "fenwalker_mantle" });
    room.state.players.set("hero", player);

    internal.resolveMobHazards(10_000);
    expect(player.health).toBe(5);
    internal.resolveMobHazards(11_250);
    expect(player.health).toBe(4);
    internal.resolveMobHazards(12_500);
    expect(player.health).toBe(4);
    internal.resolveMobHazards(13_750);
    expect(player.health).toBe(3);
  });
});
