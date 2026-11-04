import { describe, expect, it } from "vitest";
import { MEDITATION_SITES } from "@blockcraft/protocol";
import { restAtMeditationSite, type MeditationPlayer } from "./meditation-rest.js";

function playerAt(index: number): MeditationPlayer {
  const site = MEDITATION_SITES[index]!;
  return { x: site.x, y: site.y, z: site.z, health: 2, maxHealth: 9, stamina: 12, maxStamina: 125,
    potionCooldownUntil: 50, powerCooldownUntil: 60, specialCooldownUntil: 70,
    defending: true, powerCastStartedAt: 80, invulnerableUntil: 0 };
}

describe("Waystone meditation", () => {
  it("restores a living player beside a site", () => {
    const player = playerAt(1);
    const result = restAtMeditationSite(player, { siteId: "floor-1-waystone" }, 1_000)!;
    expect(result.ok).toBe(true);
    expect([player.health, player.stamina]).toEqual([9, 125]);
    expect([player.potionCooldownUntil, player.powerCooldownUntil, player.specialCooldownUntil]).toEqual([0, 0, 0]);
    expect(player.invulnerableUntil).toBe(2_200);
  });

  it("rejects remote and defeated rests", () => {
    const remote = playerAt(0); remote.x += 20;
    expect(restAtMeditationSite(remote, { siteId: "town-waystone" })?.ok).toBe(false);
    const defeated = playerAt(2); defeated.health = 0;
    expect(restAtMeditationSite(defeated, { siteId: "floor-2-waystone" })?.ok).toBe(false);
  });
});
