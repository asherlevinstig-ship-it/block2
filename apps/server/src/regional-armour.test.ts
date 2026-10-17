import { describe, expect, it, vi } from "vitest";
import { isMistfenToxicPool } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { FENWALKER_POOL_WARD_COOLDOWN_MS, NORTHWATCH_SHARD_WARD_COOLDOWN_MS, fenwalkerBlocksPoolPulse, foragerRecoveryBonus, northwatchShardWardReady } from "./regional-armour.js";

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

  it("gives Northwatch field and boss cloaks a narrow shard-shot advantage", () => {
    const ward = (armourId: string, kind = "projectile", z = -54, now = 10_000, readyAt = 0) =>
      northwatchShardWardReady(armourId, "shard_sentry", kind, 18, 8, z, now, readyAt);
    expect(ward("ridgeguard_mantle")).toBe(true);
    expect(ward("northwatch_cloak")).toBe(true);
    expect(ward("fenwalker_mantle")).toBe(false);
    expect(ward("ridgeguard_mantle", "melee")).toBe(false);
    expect(ward("ridgeguard_mantle", "projectile", 0)).toBe(false);
    expect(northwatchShardWardReady("ridgeguard_mantle", "northwatch_watchbreaker", "projectile", 18, 8, -54, 10_000, 0)).toBe(false);
    expect(ward("ridgeguard_mantle", "projectile", -54, 10_000, 10_000 + NORTHWATCH_SHARD_WARD_COOLDOWN_MS)).toBe(false);
    for (const [armourId, expectedHealth] of [["ridgeguard_mantle", 10], ["northwatch_cloak", 10], ["fenwalker_mantle", 7]] as const) {
      const room = new WorldRoom(); room.setState(new WorldState());
      const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
      const player = new PlayerState();
      Object.assign(player, { x: 18.5, y: 8, z: -54.5, health: 10, maxHealth: 10, armourId });
      const sentry = new MobState();
      Object.assign(sentry, { x: 19.5, y: 8, z: -54.5, archetype: "shard_sentry" });
      room.state.players.set("hero", player); room.state.mobs.set("northwatch-spitter", sentry);
      (room as any).damagePlayer("northwatch-spitter", "hero", 5, 10_000, false, "projectile");
      expect(player.health).toBe(expectedHealth);
      const firstHit = broadcast.mock.calls.find(([name]) => name === "combat:player-hit")?.[1] as { absorbedBy?: string; wardCooldownMs?: number };
      expect(firstHit.absorbedBy).toBe(armourId === "fenwalker_mantle" ? undefined : "northwatch");
      if (armourId !== "fenwalker_mantle") expect(firstHit.wardCooldownMs).toBe(NORTHWATCH_SHARD_WARD_COOLDOWN_MS);
      if (armourId !== "fenwalker_mantle") {
        (room as any).damagePlayer("northwatch-spitter", "hero", 5, 11_000, false, "projectile");
        expect(player.health).toBe(7);
        const hits = broadcast.mock.calls.filter(([name]) => name === "combat:player-hit");
        expect((hits[1]![1] as { absorbedBy?: string }).absorbedBy).toBeUndefined();
        (room as any).damagePlayer("northwatch-spitter", "hero", 5, 18_000, false, "projectile");
        expect(player.health).toBe(7);
        expect((broadcast.mock.calls.filter(([name]) => name === "combat:player-hit")[2]![1] as { absorbedBy?: string }).absorbedBy).toBe("northwatch");
      }
    }
  });

  it("blocks only one low-damage shot across multiple sentries during a recharge", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const player = new PlayerState();
    Object.assign(player, { x: 18.5, y: 8, z: -54.5, health: 5, maxHealth: 5, armourId: "ridgeguard_mantle" });
    room.state.players.set("hero", player);
    for (const id of ["northwatch-shard-a", "northwatch-shard-b"]) {
      const sentry = new MobState();
      Object.assign(sentry, { x: 19.5, y: 8, z: -54.5, archetype: "shard_sentry" });
      room.state.mobs.set(id, sentry);
    }
    const hit = (mobId: string, now: number, kind: "projectile" | "melee" = "projectile") =>
      (room as any).damagePlayer(mobId, "hero", 1, now, false, kind);
    hit("northwatch-shard-a", 10_000);
    expect(player.health).toBe(5);
    hit("northwatch-shard-b", 11_000);
    expect(player.health).toBe(4);
    hit("northwatch-shard-a", 12_000, "melee");
    expect(player.health).toBe(3);
    hit("northwatch-shard-b", 18_000);
    expect(player.health).toBe(3);
    const hits = broadcast.mock.calls.filter(([name]) => name === "combat:player-hit")
      .map(([, payload]) => payload as { absorbedBy?: string; damage: number });
    expect(hits.map(({ absorbedBy, damage }) => [absorbedBy, damage])).toEqual([
      ["northwatch", 0], [undefined, 1], [undefined, 1], ["northwatch", 0],
    ]);
  });
});
