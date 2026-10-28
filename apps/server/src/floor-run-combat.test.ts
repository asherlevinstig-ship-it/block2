import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { CALLING_ABILITY_OPTIONS, FLOOR_RUN_UPGRADES, TOWER_FLOOR_ONE_NORTH_WARDEN_ID, TOWER_FLOOR_ONE_SOUTH_WARDEN_ID,
  type BuildPathId, type CallingAbilityId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, grantBuildPathXp, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(path: BuildPathId = "assassin", ability?: CallingAbilityId) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
  vi.spyOn(Math, "random").mockReturnValue(.99);
  const player = new PlayerState();
  Object.assign(player, { x: 330, y: 8, z: 105, health: 30, maxHealth: 30, level: 5,
    stamina: 50, maxStamina: 100, mainHandId: "forged_sword", mainHandTag: "melee", yaw: 90 });
  const build = grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), path), 140).state;
  if (ability) build.callingAbilities[path] = ability;
  player.huntLoadoutsJson = serializeBuildPathState(build);
  const client = { sessionId: "hero", send: vi.fn() }; internal.clients.push(client);
  room.state.players.set("hero", player);
  const mob = new MobState(); Object.assign(mob, { x: 333, y: 8, z: 105, health: 50, maxHealth: 50, armor: 0, yaw: 90 });
  room.state.mobs.set("target", mob);
  const ally = new PlayerState(); Object.assign(ally, { x: 331, y: 8, z: 105, health: 3, maxHealth: 30, stamina: 20 });
  room.state.players.set("ally", ally);
  const select = (upgrade: string) => {
    for (let seed = 0; seed < 100; seed++) {
      internal.floorRunUpgrades.start("hero"); internal.floorRunUpgrades.earn("hero", TOWER_FLOOR_ONE_NORTH_WARDEN_ID);
      const offer = internal.floorRunUpgrades.state("hero", path, internal.floorUpgradeAbilities(player));
      if (!offer.choices.includes(upgrade)) continue;
      internal.chooseFloorRunUpgrade(client, { offerId: offer.offerId, upgradeId: upgrade });
      expect(internal.hasFloorUpgrade("hero", upgrade)).toBe(true); return;
    }
    throw new Error("No eligible offer for " + upgrade);
  };
  const cast = (slot: "power" | "special" = CALLING_ABILITY_OPTIONS.find(option => option.id === ability)?.category === "Utility" ? "special" : "power") => internal.handleCallingAbility(client, { requestId: "cast", slot, yaw: 90 });
  const hit = (step = 1) => {
    internal.pendingAttacks.set("hero", { requestId: "attack-run", mainHandId: player.mainHandId, step, yaw: 90, impactAt: 10000 });
    internal.resolvePendingAttacks(10000);
    for (let now = 10020; now <= 10300; now += 20) internal.resolveWeaponProjectiles(now);
  };
  return { room, internal, player, client, mob, ally, select, cast, hit, broadcast };
}

describe("authoritative Floor 1 upgrade rewards", () => {
  it("rewards both eligible contributors once per Warden and leaves spectators out", () => {
    const f = fixture(); f.internal.floorRunUpgrades.start("hero"); f.internal.floorRunUpgrades.start("ally");
    const idle = new PlayerState(); Object.assign(idle, { x: 331, y: 8, z: 105 });
    f.room.state.players.set("idle", idle); f.internal.floorRunUpgrades.start("idle");
    for (const id of [TOWER_FLOOR_ONE_NORTH_WARDEN_ID, TOWER_FLOOR_ONE_NORTH_WARDEN_ID, TOWER_FLOOR_ONE_SOUTH_WARDEN_ID]) {
      const boss = new MobState(); Object.assign(boss, { x: 333, y: 8, z: 105, health: 20, maxHealth: 20, isMiniBoss: true, level: 4, archetype: "stone_brute" });
      f.room.state.mobs.set(id, boss);
      f.internal.combatContributions.record(id, "hero", 10, 10000);
      f.internal.combatContributions.record(id, "ally", 10, 10000);
      f.internal.defeatMob(id, boss, "hero", 10000);
    }
    expect(f.internal.floorRunUpgrades.state("hero", "assassin", []).pending).toBe(2);
    expect(f.internal.floorRunUpgrades.state("ally", "healer", []).pending).toBe(2);
    expect(f.internal.floorRunUpgrades.state("idle", "tank", []).pending).toBe(0);
  });
  it("blocks selection in combat, retains the choice, then accepts it when safe", () => {
    const f = fixture(); f.internal.floorRunUpgrades.start("hero"); f.internal.floorRunUpgrades.earn("hero", "north");
    const offer = f.internal.floorRunUpgrades.state("hero", "assassin", f.internal.floorUpgradeAbilities(f.player));
    f.mob.targetId = "hero";
    f.internal.chooseFloorRunUpgrade(f.client, { offerId: offer.offerId, upgradeId: offer.choices[0] });
    expect(f.internal.floorRunUpgrades.state("hero", "assassin", f.internal.floorUpgradeAbilities(f.player)).pending).toBe(1);
    f.mob.targetId = ""; f.mob.combatState = "idle";
    f.internal.chooseFloorRunUpgrade(f.client, { offerId: offer.offerId, upgradeId: offer.choices[0] });
    expect(f.internal.floorRunUpgrades.state("hero", "assassin", f.internal.floorUpgradeAbilities(f.player)).pending).toBe(0);
  });
  it("protects the open chooser, clears its perks on death, and rejects the old choice", () => {
    const f = fixture(); f.select("assassin_open");
    f.internal.setProtectedDialog(f.client, { open: true });
    f.internal.damagePlayer("target", "hero", 100, 10000, false); expect(f.player.health).toBe(30);
    f.internal.setProtectedDialog(f.client, { open: false });
    f.internal.damagePlayer("target", "hero", 100, 10000, false); expect(f.player.health).toBe(0);
    expect(f.internal.floorRunUpgrades.active("hero")).toBe(false);
    expect(f.internal.hasFloorUpgrade("hero", "assassin_open")).toBe(false);
  });
  it("removes temporary bonuses after leaving the floor without touching saved progression", () => {
    const f = fixture(); const saved = f.player.huntLoadoutsJson; f.select("assassin_open");
    f.player.x = 99.5; f.internal.sendFloorRunUpgrades(f.client, true);
    expect(f.internal.floorRunUpgrades.active("hero")).toBe(false); expect(f.player.huntLoadoutsJson).toBe(saved);
  });
  it("does not activate upgrades in archived mode or after changing Calling", () => {
    const f = fixture(); f.select("assassin_open"); f.internal.rapidPractice = false;
    expect(f.internal.floorRunWeaponBonus("hero", f.player, f.mob, 10000)).toBe(0);
    f.internal.rapidPractice = true;
    f.player.huntLoadoutsJson = serializeBuildPathState(chooseBuildPath(parseBuildPathState("{}"), "mage"));
    expect(f.internal.floorRunWeaponBonus("hero", f.player, f.mob, 10000)).toBe(0);
  });
});

describe("class weapon and guard effects", () => {
  it.each([
    ["assassin_flank", "assassin"], ["assassin_open", "assassin"], ["assassin_finish", "assassin"],
    ["thief_distraction", "thief"], ["thief_opening", "thief"], ["mage_distance", "mage"],
    ["ranger_distance", "ranger"], ["ranger_open", "ranger"], ["healer_protect", "healer"],
  ] as const)("%s rewards its stated combat condition", (upgrade, path) => {
    const f = fixture(path); f.select(upgrade);
    f.mob.yaw = -90; f.mob.health = 40;
    expect(f.internal.floorRunWeaponBonus("hero", f.player, f.mob, 10000)).toBe(0);
    if (upgrade === "assassin_flank") f.mob.yaw = 90;
    if (upgrade.endsWith("_open")) f.mob.health = f.mob.maxHealth;
    if (upgrade === "assassin_finish") f.mob.health = 10;
    if (upgrade === "thief_distraction" || upgrade === "healer_protect") f.mob.targetId = "ally";
    if (upgrade === "thief_opening") f.mob.combatState = "stagger";
    if (upgrade.endsWith("_distance")) f.mob.x = 337;
    expect(f.internal.floorRunWeaponBonus("hero", f.player, f.mob, 10000)).toBe(1);
  });
  it("Deep Focus spends stamina only when its threshold is met", () => {
    const f = fixture("mage"); f.select("mage_reserve"); f.player.stamina = 85;
    expect(f.internal.floorRunWeaponBonus("hero", f.player, f.mob, 10000)).toBe(1); expect(f.player.stamina).toBe(77);
    expect(f.internal.floorRunWeaponBonus("hero", f.player, f.mob, 10000)).toBe(0); expect(f.player.stamina).toBe(77);
  });
  it("Arc Jump hits one visible neighbour, has a cooldown and grants no healing", () => {
    const f = fixture("mage"); f.select("mage_chain");
    const other = new MobState(); Object.assign(other, { x: 334, y: 8, z: 106, health: 20, maxHealth: 20 });
    f.room.state.mobs.set("other", other); f.player.health = 10; f.hit();
    expect(other.health).toBe(19); expect(f.player.health).toBe(10);
    f.internal.floorRunWeaponEffects("hero", f.player, "target", f.mob, 10200, 1);
    expect(other.health).toBe(19);
    expect(f.broadcast).toHaveBeenCalledWith("floor:arc-jump", expect.objectContaining({ targetId: "other" }));
  });
  it("Shared Vigor restores ally stamina, with a cooldown and no health gain", () => {
    const f = fixture("healer"); f.select("healer_vigor"); f.hit();
    expect(f.ally.stamina).toBe(24); expect(f.ally.health).toBe(3);
    f.internal.floorRunWeaponEffects("hero", f.player, "target", f.mob, 10200, 1);
    expect(f.ally.stamina).toBe(24);
  });
  it("Pinning Finish roots a staggered enemy and does not root an idle target", () => {
    const f = fixture("ranger"); f.select("ranger_snare");
    f.internal.floorRunWeaponEffects("hero", f.player, "target", f.mob, 10000, 1);
    expect(f.internal.rangerRootedUntil.has("target")).toBe(false);
    f.mob.combatState = "stagger"; f.internal.floorRunWeaponEffects("hero", f.player, "target", f.mob, 10000, 1);
    expect(f.internal.rangerRootedUntil.get("target")).toBe(10700);
  });
  it.each(["tank", "thief", "healer"] as const)("%s guard upgrade reduces real block stamina cost", path => {
    const base = fixture(path); base.player.yaw = 90; base.player.defending = true; base.player.defenseStartedAt = 9000;
    base.internal.damagePlayer("target", "hero", 3, 10000, true); const spent = 50 - base.player.stamina;
    const upgraded = fixture(path); upgraded.select(path + "_guard");
    upgraded.player.yaw = 90; upgraded.player.defending = true; upgraded.player.defenseStartedAt = 9000;
    upgraded.internal.damagePlayer("target", "hero", 3, 10000, true);
    expect(50 - upgraded.player.stamina).toBe(spent - 4);
  });
  it("Crushing Timing interrupts a brute windup through the real hit resolver", () => {
    const f = fixture("tank"); f.select("tank_breaker"); f.mob.archetype = "stone_brute"; f.mob.combatState = "windup"; f.hit();
    expect(f.mob.combatState).toBe("stagger");
  });
  it("Shield Reprisal empowers only the first hit after a parry", () => {
    const f = fixture("tank"); f.select("tank_riposte");
    f.player.defending = true; f.player.defenseStartedAt = 9950;
    f.internal.damagePlayer("target", "hero", 3, 10000, true);
    expect(f.internal.floorRunWeaponBonus("hero", f.player, f.mob, 10000)).toBe(2);
    expect(f.internal.floorRunWeaponBonus("hero", f.player, f.mob, 10000)).toBe(0);
  });
});

describe("class ability upgrades", () => {
  const coreAbilities = FLOOR_RUN_UPGRADES.filter(upgrade => upgrade.ability);
  it.each(coreAbilities)("$id improves its real ability effect", upgrade => {
    const base = fixture(upgrade.path, upgrade.ability); const upgraded = fixture(upgrade.path, upgrade.ability);
    upgraded.select(upgrade.id);
    const setup = (f: ReturnType<typeof fixture>) => {
      if (upgrade.id === "tank_challenge") f.mob.x = 342;
      if (upgrade.id === "tank_fault") f.mob.x = 336;
      if (upgrade.id === "mage_surge") f.mob.x = 336;
      if (upgrade.id === "ranger_deadeye") f.mob.x = 351;
    };
    setup(base); setup(upgraded); base.cast(); upgraded.cast();
    const a = base.internal, b = upgraded.internal;
    switch (upgrade.id) {
      case "tank_wall": expect(b.tankBulwarkUntil.get("hero") - a.tankBulwarkUntil.get("hero")).toBe(2000); break;
      case "tank_challenge": expect(a.mobAwareness.has("target")).toBe(false); expect(b.mobAwareness.get("target")?.targetId).toBe("hero"); break;
      case "tank_fault": case "mage_surge":
        expect(upgraded.mob.health).toBeLessThan(base.mob.health);
        expect(upgraded.client.send).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({ radiusScale: expect.any(Number) }));
        break;
      case "mage_shield":
        b.damagePlayer("target", "hero", 2, 10000, false);
        expect(b.floorRunWeaponBonus("hero", upgraded.player, upgraded.mob, 10000)).toBe(2); break;
      case "mage_fault": expect([...b.pendingMageOverloads.values()][0].radius - [...a.pendingMageOverloads.values()][0].radius).toBe(1); break;
      case "assassin_cloak": expect(b.stealthUntil.get("hero") - a.stealthUntil.get("hero")).toBe(2000); break;
      case "assassin_mark": expect(b.specialMarks.get("hero").expiresAt - a.specialMarks.get("hero").expiresAt).toBe(5000); break;
      case "assassin_dance": expect(upgraded.mob.health).toBeLessThan(base.mob.health); break;
      case "thief_smoke": expect(b.pathConcealedUntil.get("hero") - a.pathConcealedUntil.get("hero")).toBe(2000); break;
      case "thief_decoy": {
        const before = a.thiefDecoys.get("thief-decoy:hero"), after = b.thiefDecoys.get("thief-decoy:hero");
        expect(after.health - before.health).toBe(3); expect(after.until - before.until).toBe(2000); break;
      }
      case "thief_escape": expect(upgraded.player.invulnerableUntil - base.player.invulnerableUntil).toBe(400); break;
      case "ranger_leap": expect(base.player.x - upgraded.player.x).toBeCloseTo(1.5); break;
      case "ranger_volley": expect(b.rangerCallingFocus.get("hero").hits - a.rangerCallingFocus.get("hero").hits).toBe(1); break;
      case "ranger_deadeye": expect(upgraded.mob.health).toBeLessThan(base.mob.health); break;
      case "healer_rescue": expect(upgraded.ally.health - base.ally.health).toBe(2); break;
      case "healer_field": expect([...b.renewalFields.values()][0].radius - [...a.renewalFields.values()][0].radius).toBe(1.5); break;
      case "healer_renew": expect([...b.renewalFields.values()][0].expiresAt - [...a.renewalFields.values()][0].expiresAt).toBe(2000); break;
      default: throw new Error("Ability upgrade missing integration assertion: " + upgrade.id);
    }
  });
});
