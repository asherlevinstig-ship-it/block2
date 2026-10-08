import { describe, expect, it } from "vitest";
import { MOB_ARCHETYPES, damageAfterArmor, defeatReward, mobArchetype } from "../src/mob-archetypes.js";

describe("mob archetypes", () => {
  it("gives the Stone Brute a slower, heavier and more readable attack", () => {
    const crawler = MOB_ARCHETYPES.moss_crawler;
    const brute = MOB_ARCHETYPES.stone_brute;
    expect(brute.maxHealth).toBeGreaterThan(crawler.maxHealth);
    expect(brute.speed).toBeLessThan(crawler.speed);
    expect(brute.windupMs).toBeGreaterThan(crawler.windupMs);
    expect(brute.damage).toBeGreaterThan(crawler.damage);
    expect(brute.rewardStamina).toBeGreaterThan(crawler.rewardStamina);
  });

  it("mitigates weapon damage but lets Powers pierce armour", () => {
    expect(damageAfterArmor(1, 1)).toBe(1);
    expect(damageAfterArmor(3, 1)).toBe(2);
    expect(damageAfterArmor(3, 1, true)).toBe(3);
    expect(damageAfterArmor(0, 1)).toBe(0);
  });

  it("falls back safely to the crawler profile", () => {
    expect(mobArchetype("unknown").id).toBe("moss_crawler");
    expect(mobArchetype("stone_brute").id).toBe("stone_brute");
    expect(mobArchetype("cave_spitter").attackKind).toBe("projectile");
    expect(mobArchetype("briar_crawler").name).toBe("Briar Crawler");
  });

  it("makes the regional Briar Crawler a quicker Greenwood threat", () => {
    const briar = MOB_ARCHETYPES.briar_crawler;
    expect(briar.speed).toBeGreaterThan(MOB_ARCHETYPES.moss_crawler.speed);
    expect(briar.maxHealth).toBeGreaterThan(MOB_ARCHETYPES.moss_crawler.maxHealth);
    expect(briar.spawn.x).toBeGreaterThan(30);
  });

  it("gives the Cave Spitter a dodgeable projectile and lingering hazard", () => {
    const spitter = MOB_ARCHETYPES.cave_spitter;
    expect(spitter.minimumAttackRange).toBeGreaterThan(0);
    expect(spitter.projectileTravelMs).toBeGreaterThan(500);
    expect(spitter.hazardDurationMs).toBeGreaterThan(3000);
    expect(spitter.maxHealth).toBeLessThan(MOB_ARCHETYPES.moss_crawler.maxHealth);
  });

  it("caps Brute defeat rewards at the player's health and stamina maximums", () => {
    expect(defeatReward(3, 5, 72, 100, MOB_ARCHETYPES.stone_brute)).toEqual({
      health: 4,
      stamina: 100,
      healthRestored: 1,
      staminaRestored: 28,
    });
  });
});
