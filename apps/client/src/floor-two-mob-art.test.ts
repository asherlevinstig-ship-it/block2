import { describe, expect, it } from "vitest";
import { floorTwoAttackPose, floorTwoMobIdentity } from "./floor-two-mob-art.js";

describe("Floor 2 authored enemy identity", () => {
  it("gives every Floor 2 family a distinct combat read", () => {
    const identities = [
      ["floor2-intake-hound", "ember_hound"],
      ["floor2-intake-ram", "cinder_ram"],
      ["floor2-intake-sentry", "shard_sentry"],
      ["floor2-quench-sentry-b", "cave_spitter"],
      ["floor2-quench-bloater", "fen_bloater"],
      ["floor2-quench-regulator", "stone_brute"],
      ["floor2-forgeheart", "stone_brute"],
    ].map(([id, archetype]) => floorTwoMobIdentity(id!, archetype!)!);
    expect(new Set(identities.map(identity => identity.kind)).size).toBe(identities.length);
    expect(identities.every(identity => identity.attackRead.includes("→"))).toBe(true);
  });

  it("does not alter enemies outside Floor 2", () => {
    expect(floorTwoMobIdentity("floor1-crownkeeper", "stone_brute")).toBeNull();
  });

  it("lowers a ram's head before advancing it on strike", () => {
    const windup = floorTwoAttackPose("ram", "furnace-charge", 1, 0, 0, .5);
    const strike = floorTwoAttackPose("ram", "furnace-charge", 0, 1, 0, .5);
    expect(windup.attackPitch).toBeGreaterThan(30);
    expect(strike.rootZ).toBeGreaterThan(0);
    expect(strike.recoilZ).toBeLessThan(0);
  });

  it("gives Forgeheart different barrage and hammer poses", () => {
    const hammer = floorTwoAttackPose("forgeheart", "smash", 1, 0, 0, .5);
    const barrage = floorTwoAttackPose("forgeheart", "warden-barrage", 1, 0, 0, .5);
    expect(hammer.attackPitch).toBeLessThan(barrage.attackPitch);
    expect(barrage.attackYaw).toBeGreaterThan(30);
  });
});
