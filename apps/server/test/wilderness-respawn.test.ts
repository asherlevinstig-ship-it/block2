import { describe, expect, it } from "vitest";
import { WILDERNESS_RESPAWN_BASE_MS, WILDERNESS_RESPAWN_STAGGER_MS, wildernessRespawnDelay } from "../src/wilderness-respawn.js";

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
});
