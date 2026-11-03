import { describe, expect, it } from "vitest";
import { floorTwoTelegraphStyle } from "./floor-two-telegraphs.js";

describe("Floor 2 enemy telegraphs", () => {
  it("keeps ranged tells readable from their real engagement distance", () => {
    expect(floorTwoTelegraphStyle("floor2-quench-sentry-a", "shard_sentry", "aimed")?.range).toBeGreaterThanOrEqual(34);
    expect(floorTwoTelegraphStyle("floor2-quench-sentry-b", "cave_spitter", "fan")?.range).toBeGreaterThanOrEqual(34);
  });

  it("gives pounces, charges, blooms and projectiles distinct warning colours", () => {
    const colors = [
      floorTwoTelegraphStyle("floor2-intake-hound", "ember_hound", "ember-pounce")?.color,
      floorTwoTelegraphStyle("floor2-intake-ram", "cinder_ram", "furnace-charge")?.color,
      floorTwoTelegraphStyle("floor2-quench-bloater", "fen_bloater", "toxic-bloom")?.color,
      floorTwoTelegraphStyle("floor2-intake-sentry", "shard_sentry", "aimed")?.color,
    ];
    expect(new Set(colors.map(color => color?.join(","))).size).toBe(colors.length);
  });

  it("makes the Forgeheart readable across its full arena and distinguishes its barrage", () => {
    const smash = floorTwoTelegraphStyle("floor2-forgeheart", "stone_brute", "smash")!;
    const barrage = floorTwoTelegraphStyle("floor2-forgeheart", "stone_brute", "warden-barrage")!;
    expect(smash.range).toBe(42);
    expect(barrage.range).toBe(42);
    expect(barrage.color).not.toEqual(smash.color);
  });

  it("does not alter enemies outside Floor 2", () => {
    expect(floorTwoTelegraphStyle("floor1-crownkeeper", "stone_brute", "smash")).toBeNull();
  });
});
