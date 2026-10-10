import { describe, expect, it } from "vitest";
import { advanceBossHud, initialBossHud } from "./boss-hud.js";
const player = { x: 40, y: 8, z: 18, health: 5 };
const boss = { x: 43, y: 8, z: 18, name: "Matriarch", alive: true, health: 24, maxHealth: 24, enraged: false };
describe("boss HUD", () => {
  it("announces arrival once without extending its message every frame", () => {
    const first = advanceBossHud(initialBossHud(), boss, player, 1000);
    expect(first.visible).toBe(true); expect(first.message).toContain("ARRIVED");
    expect(advanceBossHud(first, boss, player, 2000).messageUntil).toBe(4000);
    expect(advanceBossHud(first, boss, player, 4000).message).toBe("");
  });
  it("announces enrage and defeat, then hides", () => {
    const arrived = advanceBossHud(initialBossHud(), boss, player, 1000);
    const enraged = advanceBossHud(arrived, { ...boss, enraged: true }, player, 5000);
    expect(enraged.message).toContain("ENRAGED");
    const dead = advanceBossHud(enraged, { ...boss, alive: false }, player, 6000);
    expect(dead.message).toContain("DEFEATED"); expect(dead.visible).toBe(true);
    expect(advanceBossHud(dead, { ...boss, alive: false }, player, 9500).visible).toBe(false);
  });
  it("hides on leaving or another floor and does not replay arrival on return", () => {
    const arrived = advanceBossHud(initialBossHud(), boss, player, 1000);
    const away = advanceBossHud(arrived, boss, { ...player, x: 0 }, 2000);
    expect(away.visible).toBe(false);
    expect(advanceBossHud(away, boss, player, 3000).message).toBe("");
    expect(advanceBossHud(arrived, boss, { ...player, y: 1 }, 2000).visible).toBe(false);
  });
  it("keeps the bar stable near its range boundary and clears on disconnect", () => {
    const arrived = advanceBossHud(initialBossHud(), boss, player, 1000);
    expect(advanceBossHud(arrived, boss, { ...player, x: 17 }, 2000).visible).toBe(true);
    expect(advanceBossHud(arrived, undefined, player, 2000)).toEqual(initialBossHud());
    expect(advanceBossHud(arrived, boss, { ...player, health: 0 }, 2000).visible).toBe(false);
  });
});
