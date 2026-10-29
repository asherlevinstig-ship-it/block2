import { describe, expect, it } from "vitest";
import {
  RAPID_PRACTICE_ARENA,
  RAPID_PRACTICE_BOSS_ID,
  RAPID_PRACTICE_FREE_ROAM,
  RAPID_PRACTICE_SPAWNS,
  RAPID_PRACTICE_TOWN_COLLIDERS,
  RAPID_PRACTICE_WAVES,
  RAPID_PRACTICE_WEAPON_CHOICES,
  RAPID_WORLD_ZONES,
  EMPTY_RAPID_PRACTICE_UPGRADES,
  applyRapidPracticeUpgrade,
  rapidPracticeAttackTiming,
  rapidMistfenToxicPoolAt,
  rapidPracticeGuardedReward,
  rapidPracticeMovementSpeed,
  rapidPracticeProjectileFan,
  rapidPracticeProjectileTravelMs,
  rapidPracticeWeaponProfile,
} from "./rapid-practice.js";
import { FAST_WORLD_TOWN_BOUNDS, TOWER_FLOOR_ONE_SPAWNS, fastWorldRegionDefinition, rapidPracticeCollisionCellSolid } from "@blockcraft/protocol";

describe("fast low-poly world", () => {
  it("provides five bounded free-roam regions with authored permanent populations", () => {
    expect(RAPID_PRACTICE_FREE_ROAM).toBe(true);
    expect(RAPID_WORLD_ZONES.map(zone => zone.name)).toEqual(["Greenwood", "Mistfen", "Sunken Coast", "Southern Quarry", "Ashen Reach"]);
    const totalPopulation = RAPID_WORLD_ZONES.reduce((total, zone) => total
      + fastWorldRegionDefinition(zone.id).targetPopulation, 0);
    const archivedRegionSpawns = RAPID_PRACTICE_SPAWNS.filter(spawn => spawn.zone !== "tower-floor-1");
    expect(archivedRegionSpawns).toHaveLength(totalPopulation);
    expect(RAPID_PRACTICE_SPAWNS).toHaveLength(totalPopulation + TOWER_FLOOR_ONE_SPAWNS.length);
    expect(new Set(RAPID_PRACTICE_SPAWNS.map(spawn => spawn.id)).size).toBe(RAPID_PRACTICE_SPAWNS.length);
    for (const spawn of archivedRegionSpawns) {
      expect(spawn.x).toBeGreaterThan(RAPID_PRACTICE_ARENA.minX);
      expect(spawn.x).toBeLessThan(RAPID_PRACTICE_ARENA.maxX);
      expect(spawn.z).toBeGreaterThan(RAPID_PRACTICE_ARENA.minZ);
      expect(spawn.z).toBeLessThan(RAPID_PRACTICE_ARENA.maxZ);
      expect(spawn.respawnMs).toBeGreaterThanOrEqual(40_000);
    }
    expect(RAPID_PRACTICE_WAVES.flat()).toHaveLength(totalPopulation);
    expect(new Set(RAPID_PRACTICE_WAVES.flat()).size).toBe(totalPopulation);
    expect(RAPID_PRACTICE_WAVES[2]).toContain(RAPID_PRACTICE_BOSS_ID);
    for (const zone of RAPID_WORLD_ZONES) {
      const residents = RAPID_PRACTICE_SPAWNS.filter(spawn => spawn.zone === zone.id);
      expect(residents).toHaveLength(fastWorldRegionDefinition(zone.id).targetPopulation);
      expect(residents.filter(spawn => spawn.leader).map(spawn => spawn.id)).toEqual([zone.leaderId]);
      expect(Math.min(...residents.map(spawn => spawn.level))).toBeGreaterThanOrEqual(zone.levelMin);
      expect(Math.max(...residents.map(spawn => spawn.level))).toBeLessThanOrEqual(zone.levelMax);
    }
  });

  it("shares guarded rewards and toxic-pool footprints with the authored region", () => {
    expect(rapidPracticeGuardedReward("greenwood-fenward-guard-b")).toBe(true);
    expect(rapidPracticeGuardedReward("mistfen-wayfinder-keeper")).toBe(true);
    expect(rapidPracticeGuardedReward("mistfen-wayfinder-guard")).toBe(false);
    expect(rapidPracticeGuardedReward("floor1-north-cache-keeper")).toBe(true);
    expect(rapidPracticeGuardedReward("floor1-south-cache-brute")).toBe(true);
    expect(rapidPracticeGuardedReward("floor1-north-approach-keeper")).toBe(false);
    expect(rapidMistfenToxicPoolAt(160, 75)).toBe(true);
    expect(rapidMistfenToxicPoolAt(169, 59)).toBe(false); // visible basin boardwalk is safe
    expect(rapidMistfenToxicPoolAt(164, 66.5)).toBe(false);
    expect(rapidMistfenToxicPoolAt(179.5, 51.5)).toBe(false);
  });

  it("gives the Greenwood leader a close two-mob escort group", () => {
    const region = fastWorldRegionDefinition("greenwood");
    const leader = RAPID_PRACTICE_SPAWNS.find(spawn => spawn.id === region.leaderId)!;
    const followers = RAPID_PRACTICE_SPAWNS.filter(spawn =>
      ["greenwood-elderthorn-rootguard", "greenwood-elderthorn-attendant"].includes(spawn.id));
    expect(followers).toHaveLength(2);
    expect(followers.every(follower => Math.hypot(follower.x - leader.x, follower.z - leader.z) <= 6)).toBe(true);
    expect(leader.respawnMs).toBe(90_000);
  });

  it("keeps both Miremother escorts inside the Mistfen leader basin", () => {
    const region = fastWorldRegionDefinition("mistfen");
    const leader = RAPID_PRACTICE_SPAWNS.find(spawn => spawn.id === region.leaderId)!;
    const followers = RAPID_PRACTICE_SPAWNS.filter(spawn =>
      ["mistfen-miremother-spitter", "mistfen-miremother-briar"].includes(spawn.id));
    expect(followers).toHaveLength(2);
    expect(followers.every(follower => Math.hypot(follower.x - leader.x, follower.z - leader.z) <= 6)).toBe(true);
    expect(leader.respawnMs).toBe(96_000);
  });

  it("supports the Tidecaller with two close coastal escorts", () => {
    const region = fastWorldRegionDefinition("sunken-coast");
    const leader = RAPID_PRACTICE_SPAWNS.find(spawn => spawn.id === region.leaderId)!;
    const followers = RAPID_PRACTICE_SPAWNS.filter(spawn =>
      ["coast-tidecaller-shoalguard", "coast-tidecaller-brinefang"].includes(spawn.id));
    expect(followers).toHaveLength(2);
    expect(followers.every(follower => Math.hypot(follower.x - leader.x, follower.z - leader.z) <= 6)).toBe(true);
    expect(leader.respawnMs).toBe(90_000);
  });

  it("keeps the Town of Beginnings inside the arena with a clear east gate", () => {
    expect((RAPID_PRACTICE_ARENA.maxX - RAPID_PRACTICE_ARENA.minX)
      * (RAPID_PRACTICE_ARENA.maxZ - RAPID_PRACTICE_ARENA.minZ)).toBeGreaterThanOrEqual(7_000);
    expect(RAPID_PRACTICE_TOWN_COLLIDERS).toHaveLength(6);
    expect(Math.min(...RAPID_PRACTICE_TOWN_COLLIDERS.map(building => building.minX))).toBeLessThanOrEqual(79);
    for (const building of RAPID_PRACTICE_TOWN_COLLIDERS) {
      expect(building.minX).toBeGreaterThanOrEqual(RAPID_PRACTICE_ARENA.minX);
      expect(building.maxX).toBeLessThanOrEqual(RAPID_PRACTICE_ARENA.maxX);
      expect(building.minZ).toBeGreaterThanOrEqual(RAPID_PRACTICE_ARENA.minZ);
      expect(building.maxZ).toBeLessThanOrEqual(RAPID_PRACTICE_ARENA.maxZ);
      const blocksGate = building.maxX >= 101 && building.minZ <= 109 && building.maxZ >= 103;
      expect(blocksGate).toBe(false);
      const containsSpawn = RAPID_PRACTICE_ARENA.spawn.x >= building.minX
        && RAPID_PRACTICE_ARENA.spawn.x <= building.maxX
        && RAPID_PRACTICE_ARENA.spawn.z >= building.minZ
        && RAPID_PRACTICE_ARENA.spawn.z <= building.maxZ;
      expect(containsSpawn).toBe(false);
    }
  });

  it("keeps a large walkable civic centre between the buildings and east gate", () => {
    const civicCentre = { minX: 52, maxX: 100, minZ: 82, maxZ: 130 };
    for (const building of RAPID_PRACTICE_TOWN_COLLIDERS) {
      const overlaps = building.maxX > civicCentre.minX && building.minX < civicCentre.maxX
        && building.maxZ > civicCentre.minZ && building.minZ < civicCentre.maxZ;
      expect(overlaps, building.id).toBe(false);
    }
  });

  it("shares an analytic collision fallback with fast-world prediction", () => {
    expect(rapidPracticeCollisionCellSolid(180, RAPID_PRACTICE_ARENA.floorY, 106)).toBe(true);
    expect(rapidPracticeCollisionCellSolid(180, RAPID_PRACTICE_ARENA.floorY + 1, 106)).toBe(true);
    expect(rapidPracticeCollisionCellSolid(FAST_WORLD_TOWN_BOUNDS.minX, 8, 106)).toBe(true);
    expect(rapidPracticeCollisionCellSolid(45, 8, 72)).toBe(true);
    expect(rapidPracticeCollisionCellSolid(99, 8, 106)).toBe(false);
  });

  it("speeds up play only inside the Fast World", () => {
    expect(rapidPracticeMovementSpeed(4.2, false)).toBe(4.2);
    expect(rapidPracticeMovementSpeed(4.2, true)).toBeCloseTo(5.796);
    expect(rapidPracticeProjectileTravelMs(900, false)).toBe(900);
    expect(rapidPracticeProjectileTravelMs(900, true)).toBe(612);
    expect(rapidPracticeProjectileTravelMs(200, true)).toBe(180);
  });

  it("tightens attacks and expands hostile shots into readable lanes", () => {
    expect(rapidPracticeAttackTiming({ durationMs: 600, impactMs: 280 }, true))
      .toEqual({ durationMs: 420, impactMs: 196 });
    const fan = rapidPracticeProjectileFan({ x: 0, z: 0 }, [{ x: 0, y: 1, z: 8 }], true);
    expect(fan).toHaveLength(3);
    expect(fan.map(shot => shot.x)).toEqual([-0.72, 0, 0.72]);
    expect(rapidPracticeProjectileFan({ x: 0, z: 0 }, [{ x: 0, y: 1, z: 8 }], false)).toHaveLength(1);
  });

  it("stacks run upgrades and doubles Warden rewards", () => {
    const damage = applyRapidPracticeUpgrade(EMPTY_RAPID_PRACTICE_UPGRADES, "razor_edge");
    const rareHaste = applyRapidPracticeUpgrade(damage, "swift_hands", true);
    expect(rareHaste).toEqual({ damage: 1, haste: 2, vitality: 0, relics: 1 });
    expect(rapidPracticeAttackTiming({ durationMs: 600, impactMs: 280 }, true, rareHaste.haste))
      .toEqual({ durationMs: 340, impactMs: 159 });
  });

  it("gives the three lab weapons distinct projectile identities", () => {
    expect(Object.keys(RAPID_PRACTICE_WEAPON_CHOICES)).toHaveLength(3);
    expect(rapidPracticeWeaponProfile("forged_sword", true)).toMatchObject({ style: "crescent", pierce: 3 });
    expect(rapidPracticeWeaponProfile("forged_bow", true)).toMatchObject({ style: "arrow", bonusDamage: 1 });
    expect(rapidPracticeWeaponProfile("forged_focus", true)).toMatchObject({ style: "orb", splashRadius: 1.8 });
    expect(rapidPracticeWeaponProfile("forged_sword", false)).toBeNull();
  });
});
