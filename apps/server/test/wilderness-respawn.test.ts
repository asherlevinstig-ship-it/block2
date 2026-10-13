import { describe, expect, it } from "vitest";
import { WILDERNESS_RESPAWN_BASE_MS, WILDERNESS_RESPAWN_SAFE_RADIUS, WILDERNESS_RESPAWN_STAGGER_MS,
  wildernessRespawnDelay, wildernessSpawnClear } from "../src/wilderness-respawn.js";

describe("wilderness respawn rhythm", () => {
  it("gives heavier enemies a longer post-fight breather", () => {
    expect(WILDERNESS_RESPAWN_BASE_MS.moss_crawler).toBe(12_000);
    expect(WILDERNESS_RESPAWN_BASE_MS.cave_spitter).toBe(16_000);
    expect(WILDERNESS_RESPAWN_BASE_MS.stone_brute).toBe(22_000);
  });

  it("rebuilds roaming packs in a predictable wave", () => {
    const first = wildernessRespawnDelay("outskirts-west-pack:0", "moss_crawler");
    const second = wildernessRespawnDelay("outskirts-west-pack:1", "moss_crawler");
    const third = wildernessRespawnDelay("outskirts-west-pack:2", "moss_crawler");
    expect(second - first).toBe(WILDERNESS_RESPAWN_STAGGER_MS);
    expect(third - second).toBe(WILDERNESS_RESPAWN_STAGGER_MS);
  });

  it("uses stable offsets for authored encounters", () => {
    const delay = wildernessRespawnDelay("frontier-brute-west", "stone_brute");
    expect(wildernessRespawnDelay("frontier-brute-west", "stone_brute")).toBe(delay);
    expect(delay).toBeGreaterThanOrEqual(WILDERNESS_RESPAWN_BASE_MS.stone_brute);
    expect(delay).toBeLessThan(WILDERNESS_RESPAWN_BASE_MS.stone_brute + 4 * WILDERNESS_RESPAWN_STAGGER_MS);
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
