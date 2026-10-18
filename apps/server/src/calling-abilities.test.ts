import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CALLING_ABILITIES, CALLING_ABILITY_OPTIONS, callingStarterAbility, type BuildPathId, type CallingAbilityId } from "@blockcraft/protocol";
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
    Object.assign(player, { x: 50, y: 8, z: 50, level: 5, stamina: 25, maxStamina: 100,
      powerCooldownUntil: 99_000, specialCooldownUntil: 99_000 });
    player.huntLoadoutsJson = serializeBuildPathState(grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), pathId), xp).state);
    if (pathId === "healer" && xp >= 140) {
      const mastered = chooseBuildSpecialization(parseBuildPathState(player.huntLoadoutsJson), "healer", "lifebinder");
      mastered.mastered.push("lifebinder");
      player.huntLoadoutsJson = serializeBuildPathState(mastered);
    }
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
    const effectRecipient = pathId === "assassin" ? client.send : broadcast;
    expect(effectRecipient).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({
      casterId: "hero", pathId, abilityId: `${pathId}_${pathId === "tank" ? "bulwark" : pathId === "mage" ? "arcane_surge" : pathId === "assassin" ? "vanish" : pathId === "thief" ? "smoke_bomb" : pathId === "healer" ? "field_mend" : "volley_focus"}`,
      x: 50, y: 8, z: 50,
    }));
    if (pathId !== "assassin") expect(client.send).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({
      casterId: "hero", pathId,
    }));
    if (pathId !== "mage" && pathId !== "healer") expect(pathId === "assassin" ? client.send : broadcast).toHaveBeenCalledWith("calling:state", expect.objectContaining({
      playerId: "hero", pathId, phase: "active",
    }));
    if (pathId === "tank") {
      expect(internal.tankBulwarkUntil.get("hero")).toBe(15_000);
      internal.damagePlayer("field-test", "hero", 3, 10_000, false);
      expect(player.health).toBe(3);
      expect(client.send).toHaveBeenCalledWith("tank:block-impact", { playerId: "hero", mobId: "field-test", prevented: 1 });
    }
    if (pathId === "mage") {
      expect(player.powerCooldownUntil).toBe(99_000); expect(player.stamina).toBe(55);
      expect(broadcast).toHaveBeenCalledWith("mage:surge-targets", {
        casterId: "hero", targetIds: ["pursuer"], damage: 2,
      });
    }
    if (pathId === "assassin") {
      expect(internal.assassinShadowUntil.get("hero")).toBe(13_000);
      expect(internal.stealthUntil.get("hero")).toBe(13_000);
      expect(internal.mobAwareness.has("pursuer")).toBe(false);
      expect(broadcast).not.toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({ abilityId: "assassin_vanish" }));
      expect(broadcast).not.toHaveBeenCalledWith("calling:state", expect.objectContaining({ abilityId: "assassin_vanish" }));
    }
    if (pathId === "thief") {
      expect(player.stamina).toBe(45);
      expect(internal.mobAwareness.has("pursuer")).toBe(false);
    }
    if (pathId === "ranger") expect(internal.rangerCallingFocus.get("hero")).toEqual({ hits: 3, bonus: 1 });
    if (pathId === "healer") expect(player.health).toBe(4);
  });

  it("conceals from bosses for the whole Stealth window and reveals on attack", () => {
    const { internal, player, client } = fixture("assassin");
    const boss = new MobState(); Object.assign(boss, { x: 52, y: 8, z: 50, alive: true, isMiniBoss: true, targetId: "hero" });
    internal.state.mobs.set("boss", boss);
    internal.mobAwareness.set("boss", { targetId: "hero" });
    internal.pendingMobMelee.set("boss", { targetId: "hero", yaw: 0, impactAt: 10_300 });
    internal.handleCallingAbility(client, { requestId: "stealth" });
    expect(internal.assassinBossConcealedUntil.get("hero")).toBe(13_000);
    expect(boss.targetId).toBe("");
    expect(internal.pendingMobMelee.has("boss")).toBe(false);
    internal.handleAttack(client, { requestId: "reveal", yaw: 0 });
    expect(internal.stealthUntil.has("hero")).toBe(false);
    expect(internal.pathConcealedUntil.has("hero")).toBe(false);
  });

  it("makes Blade Dance an aimed multi-cut attack instead of a next-hit buff", () => {
    const { room, internal, player, client, broadcast } = fixture("assassin", 70);
    Object.assign(player, { yaw: 0, x: 50, z: 50 });
    const first = new MobState(); Object.assign(first, { x: 50, y: 8, z: 53, alive: true, health: 12, maxHealth: 12 });
    const second = new MobState(); Object.assign(second, { x: 52, y: 8, z: 54, alive: true, health: 12, maxHealth: 12 });
    const behind = new MobState(); Object.assign(behind, { x: 50, y: 8, z: 47, alive: true, health: 12, maxHealth: 12 });
    room.state.mobs.set("first", first); room.state.mobs.set("second", second); room.state.mobs.set("behind", behind);
    internal.handleCallingAbilityEquip(client, { abilityId: "assassin_blade_dance" });
    internal.handleCallingAbility(client, { requestId: "dance", yaw: 0 });
    const event = broadcast.mock.calls.find((call: unknown[]) => call[0] === "assassin:blade-dance")?.[1] as any;
    expect(event.cuts).toHaveLength(4);
    expect(new Set(event.cuts.map((cut: any) => cut.mobId))).toEqual(new Set(["first", "second"]));
    expect(first.health).toBeLessThan(12); expect(second.health).toBeLessThan(12); expect(behind.health).toBe(12);
    expect(internal.assassinShadowUntil.has("hero")).toBe(false);
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({ detail: expect.stringContaining("RAPID CUTS") }));
  });

  it("does not spend Blade Dance when no enemy is inside its aimed arc", () => {
    const { room, internal, client } = fixture("assassin", 70);
    const behind = new MobState(); Object.assign(behind, { x: 50, y: 8, z: 46, alive: true, health: 12 });
    room.state.mobs.set("behind", behind);
    internal.handleCallingAbilityEquip(client, { abilityId: "assassin_blade_dance" });
    internal.handleCallingAbility(client, { requestId: "miss", yaw: 0 });
    expect(internal.callingAbilityReadyAt.has("hero")).toBe(false);
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("aim toward an enemy"));
  });

  it.each(["tank", "mage", "assassin", "thief", "ranger", "healer"] as const)("unlocks %s Power at level 2 and Special at level 4", pathId => {
    const { internal, player, client } = fixture(pathId);
    player.health = 2;
    player.level = 1;
    internal.handleCallingAbility(client, { requestId: "early-power", slot: "power" });
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("has not unlocked"));
    client.send.mockClear();
    player.level = 2;
    internal.handleCallingAbility(client, { requestId: "first-power", slot: "power" });
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({
      slot: "power", abilityId: callingStarterAbility(pathId, "power").id,
    }));
    internal.handleCallingAbility(client, { requestId: "early-special", slot: "special" });
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("Special has not unlocked"));
    player.level = 4;
    if (pathId === "assassin") {
      const target = new MobState(); Object.assign(target, { x: 50, y: 8, z: 53, alive: true, health: 20 });
      internal.state.mobs.set("mark-target", target);
    }
    internal.handleCallingAbility(client, { requestId: "first-special", slot: "special", yaw: 0 });
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({
      slot: "special", abilityId: callingStarterAbility(pathId, "special").id,
    }));
    expect(internal.callingAbilityReadyAt.has("hero")).toBe(true);
    expect(internal.callingSpecialReadyAt.has("hero")).toBe(true);
  });

  it.each(CALLING_ABILITY_OPTIONS)("equips and activates $id when its rank is unlocked", option => {
    const { internal, player, client } = fixture(option.pathId, option.unlockRank >= 4 ? 140 : 70);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true, health: 20, maxHealth: 20, name: "Target", targetId: "hero" });
    internal.state.mobs.set("target", mob);
    internal.mobAwareness.set("target", { targetId: "hero" });
    if (option.id !== "assassin_death_mark") {
      internal.handleCallingAbilityEquip(client, { abilityId: option.id as CallingAbilityId });
      expect(parseBuildPathState(player.huntLoadoutsJson).callingAbilities[option.pathId]).toBe(option.id);
    } else {
      mob.x = 50; mob.z = 52;
    }
    if (option.id === "ranger_deadeye") { mob.x = 50; mob.z = 60; }
    if (option.id === "healer_resurrection") {
      const ally = new PlayerState(); Object.assign(ally, { x: 52, y: 8, z: 50, health: 0 });
      internal.state.players.set("ally", ally);
      internal.parties.restore(["hero", "ally"]);
      internal.resurrectionWindows.set("ally", 22_000);
    }
    if (option.pathId === "healer") player.health = 2;
    internal.handleCallingAbility(client, { requestId: `activate-${option.id}`, yaw: 0,
      ...(option.id === "assassin_death_mark" ? { slot: "special" } : {}) });
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({ abilityId: option.id }));
  });

  it("does not spend Death Mark's cooldown when no enemy is under the aim", () => {
    const { internal, client } = fixture("assassin");
    const offAxis = new MobState(); Object.assign(offAxis, { x: 53, y: 8, z: 50, alive: true });
    internal.state.mobs.set("off-axis", offAxis);
    internal.handleCallingAbility(client, { requestId: "missed-mark", slot: "special", yaw: 0 });
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("aim at a visible enemy"));
    expect(internal.callingSpecialReadyAt.has("hero")).toBe(false);
  });

  it("makes Decoy a real temporary enemy target and reports fooled mobs", () => {
    const { internal, player, client, broadcast } = fixture("thief", 70);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true, health: 12, targetId: "hero" });
    internal.state.mobs.set("pursuer", mob);
    internal.mobAwareness.set("pursuer", { targetId: "hero", lastSeen: { x: 50, y: 8, z: 50 }, seenAt: 10_000 });
    internal.handleCallingAbilityEquip(client, { abilityId: "thief_decoy" });
    internal.handleCallingAbility(client, { requestId: "throw-decoy" });
    const decoyId = "thief-decoy:hero";
    expect(internal.thiefDecoys.get(decoyId)).toEqual({ ownerId: "hero", x: player.x, y: player.y, z: player.z,
      yaw: player.yaw, until: 14_250, health: 5, maxHealth: 5 });
    expect(internal.mobAwareness.get("pursuer").targetId).toBe(decoyId);
    expect(mob.awarenessState).toBe("search");
    expect(client.send).toHaveBeenCalledWith("thief:diverted-targets", {
      casterId: "hero", abilityId: "thief_decoy", targetIds: ["pursuer"],
    });
    expect(broadcast).toHaveBeenCalledWith("thief:diverted-targets", expect.objectContaining({ abilityId: "thief_decoy" }));
  });

  it("lets enemies damage and shatter the Decoy without harming its owner", () => {
    const { internal, player, client, broadcast } = fixture("thief", 70);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true, health: 12, targetId: "hero" });
    internal.state.mobs.set("pursuer", mob);
    internal.mobAwareness.set("pursuer", { targetId: "hero", lastSeen: { x: 50, y: 8, z: 50 }, seenAt: 10_000 });
    internal.handleCallingAbilityEquip(client, { abilityId: "thief_decoy" });
    internal.handleCallingAbility(client, { requestId: "bait" });
    const decoyId = "thief-decoy:hero";
    internal.damageThiefDecoy(decoyId, "pursuer", 3, 10_100);
    expect(internal.thiefDecoys.get(decoyId).health).toBe(2);
    expect(player.health).toBe(5);
    internal.damageThiefDecoy(decoyId, "pursuer", 3, 10_200);
    expect(internal.thiefDecoys.has(decoyId)).toBe(false);
    expect(mob.targetId).toBe("");
    expect(broadcast).toHaveBeenCalledWith("thief:decoy-hit", expect.objectContaining({
      decoyId, health: 0, destroyed: true, reason: "destroyed",
    }));
  });

  it("makes Deadeye an immediate aimed shot with a distance reward", () => {
    const { internal, player, client, broadcast } = fixture("ranger", 70);
    player.mainHandTag = "ranged";
    const mob = new MobState(); Object.assign(mob, { x: 50, y: 8, z: 60, alive: true, health: 20, maxHealth: 20 });
    internal.state.mobs.set("target", mob);
    internal.handleCallingAbilityEquip(client, { abilityId: "ranger_deadeye" });
    internal.handleCallingAbility(client, { requestId: "deadeye", yaw: 0 });
    expect(mob.health).toBeLessThan(20);
    expect(internal.rangerCallingFocus.has("hero")).toBe(false);
    expect(broadcast).toHaveBeenCalledWith("ranger:deadeye-shot", expect.objectContaining({
      casterId: "hero", mobId: "target", longShot: true, distance: 10,
    }));
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({ detail: expect.stringContaining("LONG SHOT") }));
  });

  it("does not spend Deadeye when no enemy is precisely under the aim", () => {
    const { internal, client } = fixture("ranger", 70);
    const offAxis = new MobState(); Object.assign(offAxis, { x: 56, y: 8, z: 50, alive: true, health: 20 });
    internal.state.mobs.set("off-axis", offAxis);
    internal.handleCallingAbilityEquip(client, { abilityId: "ranger_deadeye" });
    internal.handleCallingAbility(client, { requestId: "miss", yaw: 0 });
    expect(internal.callingAbilityReadyAt.has("hero")).toBe(false);
    expect(client.send).toHaveBeenCalledWith("chat:notice", expect.stringContaining("aim precisely"));
  });

  it("makes Volley Focus split ranged attacks into nearby targets", () => {
    const { internal, player, client, broadcast } = fixture("ranger", 70);
    player.mainHandTag = "ranged";
    const primary = new MobState(); Object.assign(primary, { x: 50, y: 8, z: 56, alive: true, health: 20, maxHealth: 20 });
    const left = new MobState(); Object.assign(left, { x: 48, y: 8, z: 57, alive: true, health: 20, maxHealth: 20 });
    const right = new MobState(); Object.assign(right, { x: 52, y: 8, z: 57, alive: true, health: 20, maxHealth: 20 });
    internal.state.mobs.set("primary", primary); internal.state.mobs.set("left", left); internal.state.mobs.set("right", right);
    internal.handleCallingAbility(client, { requestId: "volley", yaw: 0 });
    internal.buildPathDamageBonus(player, primary, "primary", "hero", 10_001, "weapon");
    expect(left.health).toBeLessThan(20); expect(right.health).toBeLessThan(20);
    expect(broadcast).toHaveBeenCalledWith("ranger:volley-split", expect.objectContaining({
      casterId: "hero", primaryMobId: "primary", targets: expect.arrayContaining([
        expect.objectContaining({ mobId: "left" }), expect.objectContaining({ mobId: "right" }),
      ]),
    }));
  });

  it("revives only a fallen party member after a full channel, then consumes the rescue window", () => {
    const { room, internal, player, client, broadcast } = fixture("healer", 140);
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const ally = new PlayerState(); Object.assign(ally, { x: 52, y: 8, z: 50, health: 0, maxHealth: 8, stamina: 0 });
    room.state.players.set("ally", ally);
    const allyClient = { sessionId: "ally", send: vi.fn() }; internal.clients.push(allyClient);
    internal.parties.restore(["hero", "ally"]);
    internal.resurrectionWindows.set("ally", 22_000);
    internal.handleCallingAbilityEquip(client, { abilityId: "healer_resurrection" });
    internal.handleCallingAbility(client, { requestId: "rescue" });
    expect(broadcast).toHaveBeenCalledWith("healer:resurrection-channel", {
      casterId: "hero", targetId: "ally", until: 12_500,
    });
    expect(ally.health).toBe(0);
    internal.resolvePendingResurrections(12_499);
    expect(ally.health).toBe(0);
    internal.resolvePendingResurrections(12_500);
    expect(ally.health).toBe(2);
    expect(internal.resurrectionWindows.has("ally")).toBe(false);
    expect(allyClient.send).toHaveBeenCalledWith("player:resurrected", expect.objectContaining({ health: 2 }));
    expect(broadcast).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({ abilityId: "healer_resurrection", targetId: "ally" }));
    expect(player.health).toBeGreaterThan(0);
  });

  it("interrupts Resurrection on movement and never revives an outsider", () => {
    const { room, internal, player, client, broadcast } = fixture("healer", 140);
    const ally = new PlayerState(); Object.assign(ally, { x: 52, y: 8, z: 50, health: 0 });
    room.state.players.set("ally", ally);
    internal.resurrectionWindows.set("ally", 22_000);
    internal.handleCallingAbilityEquip(client, { abilityId: "healer_resurrection" });
    internal.handleCallingAbility(client, { requestId: "stranger" });
    expect(internal.pendingResurrections.size).toBe(0);
    internal.parties.restore(["hero", "ally"]);
    internal.handleCallingAbility(client, { requestId: "party" });
    player.x += 1;
    internal.resolvePendingResurrections(11_000);
    expect(internal.pendingResurrections.size).toBe(0);
    expect(broadcast).toHaveBeenCalledWith("healer:resurrection-interrupted", { casterId: "hero", targetId: "ally" });
    internal.resolvePendingResurrections(13_000);
    expect(ally.health).toBe(0);
  });

  it("offers a rescue window only when a living Master Healer in the party has Resurrection equipped", () => {
    const { room, internal, client } = fixture("healer", 140);
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    const ally = new PlayerState(); Object.assign(ally, { x: 52, y: 8, z: 50, health: 1 });
    room.state.players.set("ally", ally);
    const allyClient = { sessionId: "ally", send: vi.fn() }; internal.clients.push(allyClient);
    internal.handleCallingAbilityEquip(client, { abilityId: "healer_resurrection" });
    internal.damagePlayer("pursuer", "ally", 5, 10_000, false);
    expect(internal.resurrectionWindows.has("ally")).toBe(false);
    ally.health = 1;
    internal.parties.restore(["hero", "ally"]);
    internal.damagePlayer("pursuer", "ally", 5, 10_100, false);
    expect(internal.resurrectionWindows.get("ally")).toBe(22_100);
    expect(allyClient.send).toHaveBeenCalledWith("player:rescue-window", { until: 22_100 });
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
    expect(client.send).toHaveBeenCalledWith("tank:challenge-targets", {
      casterId: "hero", targetIds: ["northwatch-watchbreaker"],
    });
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

  it("turns Bulwark into a directional wall that protects an ally behind the Tank", () => {
    const { room, internal, player, client, broadcast } = fixture("tank", 70);
    Object.assign(player, { yaw: 0, x: 50, z: 50 });
    const ally = new PlayerState(); Object.assign(ally, { x: 50, y: 8, z: 48, health: 5, maxHealth: 5 });
    room.state.players.set("ally", ally);
    const attacker = new MobState(); Object.assign(attacker, { x: 50, y: 8, z: 53, alive: true });
    room.state.mobs.set("attacker", attacker);
    internal.handleCallingAbility(client, { requestId: "raise-wall" });
    internal.damagePlayer("attacker", "ally", 3, 10_001, false);
    expect(ally.health).toBe(3);
    expect(broadcast).toHaveBeenCalledWith("tank:ally-block-impact", {
      guardId: "hero", allyId: "ally", mobId: "attacker", prevented: 1,
    });

    ally.health = 5; ally.x = 53; ally.z = 50;
    internal.damagePlayer("attacker", "ally", 3, 10_002, false);
    expect(ally.health).toBe(2);
  });

  it("rewards Earthbreaker for interrupting an enemy wind-up", () => {
    const { room, internal, client, broadcast } = fixture("tank", 70);
    const mob = new MobState(); Object.assign(mob, { x: 52, y: 8, z: 50, alive: true,
      health: 20, maxHealth: 20, combatState: "windup", stateUntil: 12_000 });
    room.state.mobs.set("brute", mob);
    internal.handleCallingAbilityEquip(client, { abilityId: "tank_earthbreaker" });
    internal.handleCallingAbility(client, { requestId: "break-windup" });
    expect(mob.combatState).toBe("stagger");
    expect(mob.health).toBeLessThanOrEqual(16);
    expect(broadcast).toHaveBeenCalledWith("tank:earthbreaker-interrupt", {
      casterId: "hero", targetIds: ["brute"], bonusDamage: 2,
    });
    expect(client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({
      abilityId: "tank_earthbreaker", detail: expect.stringContaining("ATTACK BROKEN"),
    }));
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
    expect(broadcast).toHaveBeenCalledWith("healer:field-mend", {
      casterId: "hero", targetId: "ally", restored: 3, staminaRestored: 0,
    });
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

  it("reports every Renewal recipient with the actual health restored", () => {
    const { room, internal, player, client, broadcast } = fixture("healer", 70);
    player.health = 3;
    const ally = new PlayerState(); Object.assign(ally, { x: 52, y: 8, z: 50, health: 1, maxHealth: 5 });
    room.state.players.set("ally", ally);
    internal.handleCallingAbilityEquip(client, { abilityId: "healer_renewal" });
    internal.handleCallingAbility(client, { requestId: "renew-party" });
    expect(broadcast).toHaveBeenCalledWith("healer:renewal-targets", {
      casterId: "hero", targets: [{ targetId: "hero", restored: 2 }, { targetId: "ally", restored: 3 }],
    });
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
    expect(broadcast).toHaveBeenCalledWith("mage:shield-impact", {
      playerId: "hero", mobId: "attacker", prevented: 1, remaining: 2, shattered: false,
    });
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
