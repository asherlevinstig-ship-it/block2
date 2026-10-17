import { describe, expect, it, vi } from "vitest";
import { decodeLootBagItems } from "@blockcraft/protocol";
import { Block, NORTHWATCH_MOB_HOMES, NORTHWATCH_SHARD_PATROL_SITE, SURFACE_HEIGHT, northwatchHighlandsBlock } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { hasCombatLineOfSight } from "./combat-impact.js";
import { circleCrawler, createCrawlerPositioning } from "./crawler-positioning.js";
import { PlayerState, WorldState } from "./schema.js";
import { NORTHWATCH_SHARD_PATROL_IDS, WILDERNESS_ENCOUNTERS, isNorthwatchShardPatrol, northwatchPatrolInterruptDuration, northwatchPatrolPattern, northwatchPatrolShotDamage, northwatchShardPatrolAllows } from "./wilderness-encounters.js";

function patrolFixture(playerIds: readonly string[] = ["a", "b"]) {
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  for (const id of playerIds) {
    const player = new PlayerState();
    Object.assign(player, { x: 18.5, y: 8, z: -54.5, health: 5, maxHealth: 5 });
    room.state.players.set(id, player);
  }
  for (const id of NORTHWATCH_SHARD_PATROL_IDS) {
    const entry = WILDERNESS_ENCOUNTERS.find(encounter => encounter.id === id)!;
    internal.registerMob(entry.id, entry.archetype, entry);
  }
  return { room, internal };
}

describe("Northwatch shard patrol", () => {
  it("keeps a fixed sentry-and-stalker trio apart from the Watchbreaker escort", () => {
    expect(NORTHWATCH_SHARD_PATROL_IDS).toHaveLength(3);
    expect(NORTHWATCH_SHARD_PATROL_IDS.map(id => WILDERNESS_ENCOUNTERS.find(mob => mob.id === id)?.archetype))
      .toEqual(["shard_sentry", "ridge_stalker", "ridge_stalker"]);
    expect(isNorthwatchShardPatrol("northwatch-watchbreaker")).toBe(false);
    expect(northwatchShardPatrolAllows({ x: 18.5, y: 8, z: -54.5 })).toBe(true);
    expect(northwatchShardPatrolAllows({ x: 15.5, y: 8, z: -72.5 })).toBe(false);
    expect(northwatchHighlandsBlock(Math.floor(NORTHWATCH_SHARD_PATROL_SITE.x), SURFACE_HEIGHT + 1,
      Math.floor(NORTHWATCH_SHARD_PATROL_SITE.z))).toBe(Block.Stone);
    expect(Math.hypot(NORTHWATCH_MOB_HOMES[1]!.x - NORTHWATCH_MOB_HOMES[5]!.x,
      NORTHWATCH_MOB_HOMES[1]!.z - NORTHWATCH_MOB_HOMES[5]!.z)).toBeLessThan(7);
    const { room } = patrolFixture();
    expect(NORTHWATCH_SHARD_PATROL_IDS.every(id => !room.state.mobs.get(id)!.isElite
      && !room.state.mobs.get(id)!.isMiniBoss)).toBe(true);
    const solo = patrolFixture(["a"]).room;
    for (const id of NORTHWATCH_SHARD_PATROL_IDS) {
      const teamMob = room.state.mobs.get(id)!;
      const soloMob = solo.state.mobs.get(id)!;
      expect([teamMob.maxHealth, teamMob.attackDamage, teamMob.speedMultiplier])
        .toEqual([soloMob.maxHealth, soloMob.attackDamage, soloMob.speedMultiplier]);
    }
  });

  it("makes the cairn genuine shot cover while leaving an open approach", () => {
    const read = (x: number, y: number, z: number) => northwatchHighlandsBlock(x, y, z) ?? Block.Air;
    const sentry = { x: 18.5, y: 8, z: -54.5 };
    expect(hasCombatLineOfSight(sentry, { x: 25.5, y: 8, z: -46.5 }, read)).toBe(false);
    expect(hasCombatLineOfSight(sentry, { x: 18.5, y: 8, z: -46.5 }, read)).toBe(true);
  });

  it("charges a readable lance only with both flankers, and rewards a timed interrupt", () => {
    expect(northwatchPatrolPattern(0, 2)).toBe("patrol-lance");
    expect(northwatchPatrolPattern(1, 2)).toBe("aimed");
    expect(northwatchPatrolPattern(2, 2)).toBe("fan");
    expect(northwatchPatrolPattern(3, 1)).toBe("aimed");
    expect(northwatchPatrolShotDamage("patrol-lance", 1)).toBe(2);
    expect(northwatchPatrolShotDamage("aimed", 1)).toBe(1);
    expect(northwatchPatrolInterruptDuration("northwatch-spitter", "patrol-lance", 650)).toBe(1_200);
    expect(northwatchPatrolInterruptDuration("northwatch-spitter", "patrol-lance", 0)).toBe(0);
    expect(northwatchPatrolInterruptDuration("northwatch-spitter", "aimed", 650)).toBe(650);
    const flank = createCrawlerPositioning("northwatch-patrol-stalker-west", "a",
      ["northwatch-patrol-stalker-west", "northwatch-patrol-stalker-east"]);
    const mob = { x: 0, y: 8, z: 3.1 }, target = { x: 0, y: 8, z: 0 };
    expect(circleCrawler(mob, target, flank, 1_000, .05, 2.05, 2.15)).not.toBeNull();
    expect(circleCrawler(mob, target, flank, 1_700, .05, 2.05, 2.15)).toBeNull();
    expect(circleCrawler(mob, target, flank, 1_700, .05, 2.05, 2.15, 1_400)).not.toBeNull();
  });

  it("rallies nearby companions to an engaged target without changing their stats", () => {
    const { room, internal } = patrolFixture();
    const before = NORTHWATCH_SHARD_PATROL_IDS.map(id => {
      const mob = room.state.mobs.get(id)!;
      return [mob.maxHealth, mob.attackDamage, mob.speedMultiplier];
    });
    internal.rallyNorthwatchShardPatrol("northwatch-spitter", "a", 10_000);
    for (const id of NORTHWATCH_SHARD_PATROL_IDS.slice(1))
      expect(internal.mobAwareness.get(id)?.targetId).toBe("a");
    expect(NORTHWATCH_SHARD_PATROL_IDS.map(id => {
      const mob = room.state.mobs.get(id)!;
      return [mob.maxHealth, mob.attackDamage, mob.speedMultiplier];
    })).toEqual(before);
  });

  it("grants a modest personal crafting cache to both contributors only on full clear", () => {
    const { room, internal } = patrolFixture();
    const [sentry, west, east] = NORTHWATCH_SHARD_PATROL_IDS;
    internal.defeatMob(sentry, room.state.mobs.get(sentry)!, "a", 10_000);
    internal.defeatMob(west, room.state.mobs.get(west)!, "a", 11_000);
    expect([...room.state.lootDrops.values()].some(drop => drop.contentsJson.includes("iron_ore"))).toBe(false);
    internal.defeatMob(east, room.state.mobs.get(east)!, "b", 12_000);
    const cache = [...room.state.lootDrops.entries()].filter(([id]) => id.startsWith("northwatch-shard-patrol-cache:"))
      .map(([, drop]) => drop);
    expect(cache.map(drop => drop.ownerId).sort()).toEqual(["a", "b"]);
    for (const drop of cache) {
      const contents = decodeLootBagItems(drop.contentsJson);
      expect(contents).toContainEqual({ itemId: "iron_ore", quantity: 1 });
      expect(contents.some(item => item.itemId === "ridge_hide" && item.quantity >= 1)).toBe(true);
    }
  });
});
