import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CALLING_ABILITIES, CALLING_ABILITY_OPTIONS, type BuildPathId, type CallingAbilityId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, grantBuildPathXp, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";

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

  it.each(["tank", "mage", "assassin", "thief", "ranger"] as const)("activates %s from the dedicated slot", pathId => {
    const { internal, player, client, broadcast } = fixture(pathId);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true, targetId: "hero" });
    internal.state.mobs.set("pursuer", mob);
    internal.mobAwareness.set("pursuer", { targetId: "hero" });
    internal.handleCallingAbility(client, { requestId: `use-${pathId}` });

    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({
      requestId: `use-${pathId}`, pathId, ability: CALLING_ABILITIES[pathId].name,
      cooldownUntil: 10_000 + CALLING_ABILITIES[pathId].cooldownMs,
    }));
    expect(client.send).toHaveBeenCalledWith("build:path-proc", expect.objectContaining({ pathId }));
    expect(broadcast).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({
      casterId: "hero", pathId, abilityId: `${pathId}_${pathId === "tank" ? "bulwark" : pathId === "mage" ? "arcane_surge" : pathId === "assassin" ? "vanish" : pathId === "thief" ? "smoke_bomb" : "volley_focus"}`,
      x: 50, y: 8, z: 50,
    }));
    if (pathId !== "mage") expect(broadcast).toHaveBeenCalledWith("calling:state", expect.objectContaining({
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
  });

  it.each(CALLING_ABILITY_OPTIONS)("equips and activates $id when its rank is unlocked", option => {
    const { internal, player, client } = fixture(option.pathId, 70);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true, health: 20, maxHealth: 20, name: "Target", targetId: "hero" });
    internal.state.mobs.set("target", mob);
    internal.mobAwareness.set("target", { targetId: "hero" });
    internal.handleCallingAbilityEquip(client, { abilityId: option.id as CallingAbilityId });
    expect(parseBuildPathState(player.huntLoadoutsJson).callingAbilities[option.pathId]).toBe(option.id);
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
