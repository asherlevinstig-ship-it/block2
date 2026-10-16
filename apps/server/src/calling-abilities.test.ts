import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CALLING_ABILITIES, CALLING_ABILITY_OPTIONS, type BuildPathId, type CallingAbilityId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, chooseBuildSpecialization, grantBuildPathXp, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";

describe("hotbar Calling abilities", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000); });
  afterEach(() => vi.useRealTimers());

  function fixture(pathId: BuildPathId, xp = 0) {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any; internal.roomKind = "overworld";
    const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const player = new PlayerState();
    Object.assign(player, { x: 50, y: 8, z: 50, stamina: 25, maxStamina: 100,
      powerCooldownUntil: 99_000, specialCooldownUntil: 99_000 });
    player.huntLoadoutsJson = serializeBuildPathState(grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), pathId), xp).state);
    room.state.players.set("hero", player);
    const client = { sessionId: "hero", send: vi.fn() };
    internal.clients.push(client);
    return { room, internal, player, client, broadcast };
  }

  it.each(["tank", "mage", "assassin", "thief", "ranger", "healer"] as const)("activates %s from the dedicated slot", pathId => {
    const { internal, player, client, broadcast } = fixture(pathId);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true, targetId: "hero" });
    internal.state.mobs.set("pursuer", mob);
    internal.mobAwareness.set("pursuer", { targetId: "hero" });
    if (pathId === "healer") player.health = 2;
    internal.handleCallingAbility(client, { requestId: `use-${pathId}` });

    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({
      requestId: `use-${pathId}`, pathId, ability: CALLING_ABILITIES[pathId].name,
      cooldownUntil: 10_000 + CALLING_ABILITIES[pathId].cooldownMs,
    }));
    expect(client.send).toHaveBeenCalledWith("build:path-proc", expect.objectContaining({ pathId }));
    expect(broadcast).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({
      casterId: "hero", pathId, abilityId: `${pathId}_${pathId === "tank" ? "bulwark" : pathId === "mage" ? "arcane_surge" : pathId === "assassin" ? "vanish" : pathId === "thief" ? "smoke_bomb" : pathId === "healer" ? "field_mend" : "volley_focus"}`,
      x: 50, y: 8, z: 50,
    }));
    if (pathId !== "mage" && pathId !== "healer") expect(broadcast).toHaveBeenCalledWith("calling:state", expect.objectContaining({
      playerId: "hero", pathId, phase: "active",
    }));
    if (pathId === "tank") {
      expect(internal.tankBulwarkUntil.get("hero")).toBe(15_000);
      internal.damagePlayer("field-test", "hero", 3, 10_000, false);
      expect(player.health).toBe(3);
    }
    if (pathId === "mage") { expect(player.powerCooldownUntil).toBe(10_000); expect(player.stamina).toBe(55); }
    if (pathId === "assassin") {
      expect(internal.assassinShadowUntil.get("hero")).toBe(13_000);
      expect(internal.mobAwareness.has("pursuer")).toBe(false);
    }
    if (pathId === "thief") {
      expect(player.stamina).toBe(45);
      expect(internal.mobAwareness.has("pursuer")).toBe(false);
    }
    if (pathId === "ranger") expect(internal.rangerCallingFocus.get("hero")).toEqual({ hits: 3, bonus: 1 });
    if (pathId === "healer") expect(player.health).toBe(4);
  });

  it.each(CALLING_ABILITY_OPTIONS)("equips and activates $id when its rank is unlocked", option => {
    const { internal, player, client } = fixture(option.pathId, 70);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true, health: 20, maxHealth: 20, name: "Target", targetId: "hero" });
    internal.state.mobs.set("target", mob);
    internal.mobAwareness.set("target", { targetId: "hero" });
    internal.handleCallingAbilityEquip(client, { abilityId: option.id as CallingAbilityId });
    expect(parseBuildPathState(player.huntLoadoutsJson).callingAbilities[option.pathId]).toBe(option.id);
    if (option.pathId === "healer") player.health = 2;
    internal.handleCallingAbility(client, { requestId: `activate-${option.id}`, yaw: 0 });
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({ abilityId: option.id }));
  });

  it("keeps locked abilities out of the slot", () => {
    const { internal, player, client } = fixture("tank");
    internal.handleCallingAbilityEquip(client, { abilityId: "tank_earthbreaker" });
    expect(parseBuildPathState(player.huntLoadoutsJson).callingAbilities.tank).toBeUndefined();
    expect(client.send).toHaveBeenCalledWith("build:path", expect.objectContaining({
      selectedCallingAbilityId: "tank_bulwark",
      message: expect.stringContaining("unlocks at Path Rank 3"),
    }));
  });

  it("credits a Tank who challenges Northwatch off an ally without dealing fake damage", () => {
    const { room, internal, player, client } = fixture("tank", 70);
    const ally = new PlayerState(); Object.assign(ally, { x: 51, y: 8, z: 50 }); room.state.players.set("ally", ally);
    const boss = new MobState(); Object.assign(boss, { x: 52, y: 8, z: 50, alive: true, health: 52, maxHealth: 52 });
    room.state.mobs.set("northwatch-watchbreaker", boss);
    internal.mobAwareness.set("northwatch-watchbreaker", { targetId: "ally", lastSeen: { x: 51, y: 8, z: 50 }, seenAt: 10_000 });
    internal.handleCallingAbilityEquip(client, { abilityId: "tank_challenge" });
    internal.handleCallingAbility(client, { requestId: "northwatch-challenge" });
    expect(internal.mobAwareness.get("northwatch-watchbreaker").targetId).toBe("hero");
    expect(internal.combatContributions.eligiblePersistent("northwatch-watchbreaker", boss, room.state.players)).toContain("hero");
    expect(internal.combatContributions.eligible("northwatch-watchbreaker", boss, room.state.players, 10_000)).toEqual([]);
    expect(player.stamina).toBeGreaterThan(25);
  });

  it("credits Northwatch damage prevented by a Tank guarding an ally", () => {
    const { room, internal, player } = fixture("tank", 70);
    player.defending = true;
    const ally = new PlayerState(); Object.assign(ally, { x: 51, y: 8, z: 50 }); room.state.players.set("ally", ally);
    const boss = new MobState(); Object.assign(boss, { x: 52, y: 8, z: 50, alive: true, health: 20, maxHealth: 20 });
    room.state.mobs.set("northwatch-watchbreaker", boss);
    internal.damagePlayer("northwatch-watchbreaker", "ally", 2, 10_000, false);
    expect(internal.combatContributions.eligiblePersistent("northwatch-watchbreaker", boss, room.state.players)).toContain("hero");
  });

  it("heals an injured ally before self and credits actual boss-fight healing", () => {
    const { room, internal, player, client, broadcast } = fixture("healer", 70);
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    player.health = 2;
    const ally = new PlayerState(); Object.assign(ally, { x: 52, y: 8, z: 50, health: 1, maxHealth: 5 });
    room.state.players.set("ally", ally);
    const boss = new MobState(); Object.assign(boss, { x: 53, y: 8, z: 50, alive: true, isMiniBoss: true,
      combatState: "windup", health: 52, maxHealth: 52 });
    room.state.mobs.set("northwatch-watchbreaker", boss);
    internal.handleCallingAbility(client, { requestId: "heal-ally" });
    expect(ally.health).toBe(4); expect(player.health).toBe(2);
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({ abilityId: "healer_field_mend", detail: expect.stringContaining("+3 HP") }));
    expect(broadcast).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({ targetId: "ally", x: ally.x, z: ally.z }));
    expect(internal.combatContributions.eligiblePersistent("northwatch-watchbreaker", boss, room.state.players)).toEqual(["hero"]);
    internal.defeatMob("northwatch-watchbreaker", boss, "ally", 10_100);
    expect([...room.state.lootDrops.values()].some(drop => drop.ownerId === "hero")).toBe(true);
  });

  it("does not spend Field Mend cooldown when nobody is injured, then can self-heal", () => {
    const { internal, player, client } = fixture("healer");
    internal.handleCallingAbility(client, { requestId: "no-target" });
    expect(internal.callingAbilityReadyAt.has("hero")).toBe(false);
    player.health = 3;
    internal.handleCallingAbility(client, { requestId: "self-heal" });
    expect(player.health).toBe(5);
    expect(internal.callingAbilityReadyAt.get("hero")).toBe(25_000);
  });

  it("Field Medic restores stamina to an injured ally", () => {
    const { room, internal, player, client } = fixture("healer", 70);
    player.huntLoadoutsJson = serializeBuildPathState(chooseBuildSpecialization(parseBuildPathState(player.huntLoadoutsJson), "healer", "field_medic"));
    const ally = new PlayerState(); Object.assign(ally, { x: 52, y: 8, z: 50, health: 3, maxHealth: 5, stamina: 40, maxStamina: 100 });
    room.state.players.set("ally", ally);
    internal.handleCallingAbility(client, { requestId: "field-medic" });
    expect(ally.health).toBe(5); expect(ally.stamina).toBe(50);
    expect(parseBuildPathState(player.huntLoadoutsJson).trials.field_medic).toBe(10);
  });

  it("publishes persistent charges and clears them as they are consumed", () => {
    const { internal, client, broadcast } = fixture("mage", 70);
    internal.handleCallingAbilityEquip(client, { abilityId: "mage_mana_shield" });
    internal.handleCallingAbility(client, { requestId: "shield" });
    expect(broadcast).toHaveBeenCalledWith("calling:state", expect.objectContaining({
      abilityId: "mage_mana_shield", charges: 3, phase: "active",
    }));
    internal.damagePlayer("attacker", "hero", 3, 10_001, false);
    expect(broadcast).toHaveBeenCalledWith("calling:state", expect.objectContaining({
      abilityId: "mage_mana_shield", charges: 2, phase: "active",
    }));
  });

  it("equips a town-only branch and applies its authoritative effect", () => {
    const { internal, player, client, broadcast } = fixture("tank", 30);
    internal.grantCallingTrial("hero", "bulwark_iron_skin", 24);
    player.x = 8.5; player.z = 8.5;
    internal.handleCallingAugmentEquip(client, { augmentId: "bulwark_iron_skin" });
    expect(parseBuildPathState(player.huntLoadoutsJson).callingAugments.tank_bulwark).toBe("bulwark_iron_skin");
    player.x = 50; player.z = 50;
    internal.handleCallingAbility(client, { requestId: "reinforced-bulwark" });
    expect(broadcast).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({
      abilityId: "tank_bulwark", augmentId: "bulwark_iron_skin",
    }));
    internal.damagePlayer("attacker", "hero", 3, 10_001, false);
    expect(player.health).toBe(4);
  });

  it("requires a Calling and enforces the server cooldown", () => {
    const { internal, player, client } = fixture("mage");
    internal.handleCallingAbility(client, { requestId: "first" });
    player.powerCooldownUntil = 77_000;
    internal.handleCallingAbility(client, { requestId: "second" });
    expect(player.powerCooldownUntil).toBe(77_000);
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("recovers in 16s"));

    player.huntLoadoutsJson = "{}";
    internal.callingAbilityReadyAt.clear();
    internal.handleCallingAbility(client, { requestId: "unbound" });
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("Choose a Calling"));
  });
});
