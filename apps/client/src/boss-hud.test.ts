import { describe, expect, it } from "vitest";
import { activeCombatNearby, advanceBossHud, initialBossHud, leaderAttackLabel, leaderAttackName, leaderExposureLabel, leaderHealthPhase, realmBossHealthPhase } from "./boss-hud.js";
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
  it("uses dungeon-specific guardian phase and victory language", () => {
    const guardian = { ...boss, x: 187, z: 165, name: "Ancient Root Guardian", maxHealth: 28, health: 28 };
    const explorer = { ...player, x: 186, z: 165 };
    const arrived = advanceBossHud(initialBossHud(), guardian, explorer, 1000);
    expect(arrived.message).toContain("AWAKENS");
    const enraged = advanceBossHud(arrived, { ...guardian, health: 13, enraged: true }, explorer, 5000);
    expect(enraged.message).toContain("CHARGE");
    const defeated = advanceBossHud(enraged, { ...guardian, alive: false, health: 0, enraged: true }, explorer, 6000);
    expect(defeated.message).toContain("CLAIM YOUR REWARD");
  });
  it("announces the crystal boss phases and signature reward", () => {
    const crystal = { ...boss, x: 72.5, y: 1, z: 9.5, name: "Crystal Matriarch", maxHealth: 28, health: 28 };
    const explorer = { ...player, x: 70, y: 1, z: 9.5 };
    const arrived = advanceBossHud(initialBossHud(), crystal, explorer, 1000);
    expect(arrived.message).toContain("FIND THE GAPS");
    const enraged = advanceBossHud(arrived, { ...crystal, health: 13, enraged: true }, explorer, 5000);
    expect(enraged.message).toContain("ROTATING CRYSTAL WAVES");
    const defeated = advanceBossHud(enraged, { ...crystal, alive: false, health: 0, enraged: true }, explorer, 6000);
    expect(defeated.message).toContain("MATRIARCH'S EDGE");
  });
  it("uses concise discovery and premium-loot copy for area mini-bosses", () => {
    const leader = { ...boss, name: "Mossback Alpha", isMiniBoss: true };
    const arrived = advanceBossHud(initialBossHud(), leader, player, 1000);
    expect(arrived.message).toBe("MOSSBACK ALPHA DISCOVERED · AREA MINI-BOSS");
    const defeated = advanceBossHud(arrived, { ...leader, alive: false, health: 0 }, player, 2000);
    expect(defeated.message).toContain("PREMIUM LOOT DROPPED");
  });
  it("turns internal attack patterns into clear combat labels", () => {
    expect(leaderAttackName("rocks")).toBe("ROCK VOLLEY");
    expect(leaderAttackLabel("pool", "windup")).toBe("VENOM POOL · INCOMING");
    expect(leaderAttackLabel("rush", "strike")).toBe("PACK RUSH · ACTIVE");
    expect(leaderAttackLabel("crystal-burst", "recover")).toBe("CRYSTAL BURST · RECOVERING");
  });
  it("counts the exposed opening down to zero", () => {
    expect(leaderExposureLabel(3500, 1000)).toBe("LEADER EXPOSED · 2.5s");
    expect(leaderExposureLabel(3500, 3499)).toBe("LEADER EXPOSED · 0.1s");
    expect(leaderExposureLabel(3500, 3500)).toBe("");
  });
  it("recognises nearby combat without treating distant or idle mobs as combat", () => {
    const active = { x: 5, y: 8, z: 0, alive: true, combatState: "windup", targetId: "tester" };
    expect(activeCombatNearby("tester", { x: 0, y: 8, z: 0 }, [active])).toBe(true);
    expect(activeCombatNearby("tester", { x: 0, y: 8, z: 0 }, [{ ...active, combatState: "idle", targetId: "" }])).toBe(false);
    expect(activeCombatNearby("tester", { x: 0, y: 1, z: 0 }, [active])).toBe(false);
    expect(activeCombatNearby("tester", { x: 30, y: 8, z: 0 }, [active])).toBe(false);
  });
  it("shows leader phases at the 60 and 25 percent health markers", () => {
    expect(leaderHealthPhase(20, 20)).toBe(1);
    expect(leaderHealthPhase(12, 20)).toBe(2);
    expect(leaderHealthPhase(6, 20)).toBe(2);
    expect(leaderHealthPhase(5, 20)).toBe(3);
  });
  it("shows the Realm Warden phases at two-thirds and one-third health", () => {
    expect(realmBossHealthPhase(90, 90)).toBe(1);
    expect(realmBossHealthPhase(60, 90)).toBe(2);
    expect(realmBossHealthPhase(31, 90)).toBe(2);
    expect(realmBossHealthPhase(30, 90)).toBe(3);
  });
});
