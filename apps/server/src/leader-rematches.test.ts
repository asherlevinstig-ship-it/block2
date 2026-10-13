import { describe, expect, it } from "vitest";
import { leaderRematch, leaderRematchMaterialBonus, leaderRematchPattern, leaderRematchPressureCadence, leaderRematchStats, leaderRematchTiming } from "./leader-rematches.js";

describe("empowered leader rematches", () => {
  it("rotates deterministic modifiers and caps progression at five", () => {
    const modifiers = new Set(Array.from({ length: 5 }, (_, index) => leaderRematch("moss-crawler", index + 1).modifier));
    expect(modifiers.size).toBe(4);
    expect(leaderRematch("moss-crawler", 99).tier).toBe(5);
    expect(leaderRematch("moss-crawler", 0).modifier).toBe("");
  });

  it("scales difficulty without exceeding combat schema limits", () => {
    const base = { maxHealth: 30, damage: 2, armor: 1, speedMultiplier: 1, rewardMultiplier: 2 };
    const scaled = leaderRematchStats(base, { tier: 5, modifier: "armoured", rewardLabel: "" });
    expect(scaled.maxHealth).toBeGreaterThan(base.maxHealth);
    expect(scaled.maxHealth).toBeLessThanOrEqual(120);
    expect(scaled.armor).toBe(2);
    expect(scaled.rewardMultiplier).toBe(4);
  });

  it("changes attack rhythm, patterns, arena pressure, and bonus loot by modifier", () => {
    expect(leaderRematchTiming("frenzied")).toEqual({ windup: .82, cooldown: .76 });
    expect(leaderRematchTiming("relentless").cooldown).toBeLessThan(1);
    expect(leaderRematchPattern("aimed", "cave_spitter", 1, "venomous")).toBe("pool");
    expect(leaderRematchPattern("slam", "stone_brute", 2, "armoured")).toBe("warden-barrage");
    expect(leaderRematchPressureCadence(3, "relentless")).toBe(2);
    expect(leaderRematchMaterialBonus(5)).toBe(3);
  });
});
