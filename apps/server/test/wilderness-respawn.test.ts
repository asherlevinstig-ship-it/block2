import { describe, expect, it } from "vitest";
import { WILDERNESS_RESPAWN_MIN_MS, WILDERNESS_RESPAWN_PER_LEVEL_MS, WILDERNESS_RESPAWN_SAFE_RADIUS, WILDERNESS_RESPAWN_STAGGER_MS,
  wildernessRespawnDelay, wildernessSpawnClear } from "../src/wilderness-respawn.js";

describe("wilderness respawn rhythm", () => {
  it("waits at least forty seconds and scales upward with enemy level", () => {
    expect(wildernessRespawnDelay("enemy:0", 1)).toBe(WILDERNESS_RESPAWN_MIN_MS);
    expect(wildernessRespawnDelay("enemy:0", 2)).toBe(45_000);
    expect(wildernessRespawnDelay("enemy:0", 5)).toBe(60_000);
    expect(wildernessRespawnDelay("enemy:0", 9)).toBe(80_000);
    expect(wildernessRespawnDelay("enemy:0", 9) - wildernessRespawnDelay("enemy:0", 8)).toBe(WILDERNESS_RESPAWN_PER_LEVEL_MS);
  });

  it("rebuilds roaming packs in a predictable wave", () => {
    const first = wildernessRespawnDelay("outskirts-west-pack:0", 2);
    const second = wildernessRespawnDelay("outskirts-west-pack:1", 2);
    const third = wildernessRespawnDelay("outskirts-west-pack:2", 2);
    expect(second - first).toBe(WILDERNESS_RESPAWN_STAGGER_MS);
    expect(third - second).toBe(WILDERNESS_RESPAWN_STAGGER_MS);
  });

  it("uses stable offsets for authored encounters", () => {
    const delay = wildernessRespawnDelay("frontier-brute-west", 9);
    expect(wildernessRespawnDelay("frontier-brute-west", 9)).toBe(delay);
    expect(delay).toBeGreaterThanOrEqual(80_000);
    expect(delay).toBeLessThan(80_000 + 4 * WILDERNESS_RESPAWN_STAGGER_MS);
  });

  it("sanitizes invalid levels without dropping below the minimum", () => {
    expect(wildernessRespawnDelay("enemy:0", 0)).toBe(WILDERNESS_RESPAWN_MIN_MS);
    expect(wildernessRespawnDelay("enemy:0", Number.NaN)).toBe(WILDERNESS_RESPAWN_MIN_MS);
  });

  it("waits while a living player is inside the spawn safety bubble", () => {
    const spawn = { x: 10, y: 8, z: 10 };
    expect(wildernessSpawnClear(spawn, [{ x: 10 + WILDERNESS_RESPAWN_SAFE_RADIUS - .1, y: 8, z: 10, health: 5 }])).toBe(false);
    expect(wildernessSpawnClear(spawn, [{ x: 10 + WILDERNESS_RESPAWN_SAFE_RADIUS, y: 8, z: 10, health: 5 }])).toBe(true);
  });

  it("ignores defeated players and players on another floor", () => {
    const spawn = { x: 10, y: 8, z: 10 };
    expect(wildernessSpawnClear(spawn, [
      { x: 10, y: 8, z: 10, health: 0 },
      { x: 10, y: 4, z: 10, health: 5 },
    ])).toBe(true);
  });
});
