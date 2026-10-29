import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { CALLING_ABILITY_OPTIONS, type BuildPathId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, chooseBuildSpecialization, grantBuildPathXp, parseBuildPathState, selectedCallingAbility, serializeBuildPathState } from "./build-paths.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(path: BuildPathId = "mage", spec?: "arcanist" | "elementalist" | "spellguard") {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState(); Object.assign(player, { x: 99.5, y: 8, z: 106.5, level: 5, health: 20, maxHealth: 30 });
  let state = grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), path), 140).state;
  if (spec) state = chooseBuildSpecialization(state, "mage", spec);
  player.huntLoadoutsJson = serializeBuildPathState(state);
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() }; internal.clients.push(client);
  const mob = new MobState(); Object.assign(mob, { x: 101, y: 8, z: 106.5, health: 100, maxHealth: 100, armor: 0, targetId: "hero" });
  room.state.mobs.set("target", mob);
  const cast = () => { internal.callingAbilityReadyAt.delete("hero"); internal.handleCallingAbility(client, { requestId: "cast", yaw: 90 }); };
  return { room, internal, player, client, mob, cast };
}

describe("Fast World Calling progression", () => {
  it("allows a bound Calling and Veteran specialisation to change in Town, then blocks field changes", () => {
    const f = fixture();
    f.internal.handleBuildPath(f.client, { action: "specialize", specializationId: "arcanist" });
    expect(parseBuildPathState(f.player.huntLoadoutsJson).specializations.mage).toBe("arcanist");
    f.internal.handleBuildPath(f.client, { action: "choose", pathId: "tank" });
    expect(parseBuildPathState(f.player.huntLoadoutsJson).selectedPathId).toBe("tank");
    f.player.x = 330;
    f.internal.handleBuildPath(f.client, { action: "choose", pathId: "thief" });
    expect(parseBuildPathState(f.player.huntLoadoutsJson).selectedPathId).toBe("tank");
    expect(f.client.send.mock.lastCall?.[1]).toMatchObject({ inTown: false, canChoose: false });
  });
  it.each(CALLING_ABILITY_OPTIONS.filter(option => option.category === "Utility"))("keeps saved $id on F and preserves its earned upgrade", option => {
    const f = fixture(option.pathId);
    const state = parseBuildPathState(f.player.huntLoadoutsJson); state.callingAbilities[option.pathId] = option.id;
    f.player.huntLoadoutsJson = serializeBuildPathState(state);
    f.internal.handleCallingAbilityEquip(f.client, { abilityId: option.id });
    expect(selectedCallingAbility(parseBuildPathState(f.player.huntLoadoutsJson), option.pathId)).not.toBe(option.id);
    expect(f.client.send.mock.lastCall?.[1].message).toContain("F Special");
  });
  it("makes every third damaging Mage spell echo and advance the Arcanist trial", () => {
    const f = fixture("mage", "arcanist"); f.cast(); f.cast(); expect(f.mob.health).toBe(96);
    f.cast(); expect(f.mob.health).toBe(92);
    expect(parseBuildPathState(f.player.huntLoadoutsJson).trials.arcanist).toBe(1);
    expect(f.client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({ cooldownUntil: 23_600 }));
  });
  it("does not farm Arcane Echo from empty casts", () => {
    const f = fixture("mage", "arcanist"); f.mob.x = 200;
    f.cast(); f.cast(); f.cast(); expect(f.internal.mageCallingCasts.has("hero")).toBe(false);
    expect(parseBuildPathState(f.player.huntLoadoutsJson).trials.arcanist).toBeUndefined();
  });
  it("echoes an Overload once across multiple targets without counting its aftershock as another cast", () => {
    const f = fixture("mage", "arcanist"); f.cast(); f.cast();
    const state = parseBuildPathState(f.player.huntLoadoutsJson);
    state.callingAbilities.mage = "mage_overload";
    state.callingAugments.mage_overload = "overload_residual_charge";
    f.player.huntLoadoutsJson = serializeBuildPathState(state);
    const other = new MobState(); Object.assign(other, { x: 102, y: 8, z: 106.5, health: 100, maxHealth: 100 });
    f.room.state.mobs.set("other", other);
    f.cast(); f.internal.resolveMageOverloads(10_850);
    expect(f.mob.health).toBe(87); expect(other.health).toBe(91);
    f.internal.resolveMageOverloads(11_600);
    expect(f.mob.health).toBe(84); expect(other.health).toBe(88);
    expect(parseBuildPathState(f.player.huntLoadoutsJson).trials.arcanist).toBe(1);
    expect(f.internal.mageCallingCasts.get("hero")).toBe(0);
  });
  it("slows spell survivors and credits a slowed kill once in Fast World", () => {
    const f = fixture("mage", "elementalist"); f.cast();
    expect(f.internal.rangerSlows.get("target")).toMatchObject({ until: 12_000, multiplier: .78 });
    f.internal.defeatMob("target", f.mob, "hero", 10_500);
    f.internal.defeatMob("target", f.mob, "hero", 10_500);
    expect(parseBuildPathState(f.player.huntLoadoutsJson).trials.elementalist).toBe(1);
    expect(f.internal.masterTrialMobTags.has("target")).toBe(false);
  });
  it("does not award Elementalist mastery after the slow has expired", () => {
    const f = fixture("mage", "elementalist"); f.cast();
    f.internal.defeatMob("target", f.mob, "hero", 12_001);
    expect(parseBuildPathState(f.player.huntLoadoutsJson).trials.elementalist).toBeUndefined();
  });
  it("makes Spellguard a defensive Mage branch with an Aegis Shatter capstone", () => {
    const f = fixture("mage", "spellguard");
    expect(parseBuildPathState(f.player.huntLoadoutsJson).specializations.mage).toBe("spellguard");
    f.internal.handleCallingAbility(f.client, { requestId: "shield", slot: "special" });
    expect(f.internal.mageBarrierHits.get("hero")).toBe(4);
    f.internal.damagePlayer("target", "hero", 3, 10_001, false);
    expect(f.player.health).toBe(19);
    expect(parseBuildPathState(f.player.huntLoadoutsJson).trials.spellguard).toBe(2);
    const state = parseBuildPathState(f.player.huntLoadoutsJson);
    state.mastered.push("spellguard"); f.player.huntLoadoutsJson = serializeBuildPathState(state);
    f.internal.mageBarrierHits.set("hero", 1);
    f.internal.damagePlayer("target", "hero", 3, 10_002, false);
    expect(f.player.invulnerableUntil).toBe(12_002);
    expect(f.room.broadcast).toHaveBeenCalledWith("calling:combo", expect.objectContaining({ comboId: "aegis_shatter" }));
  });
  it("allows mastered F augments to equip in Town without replacing G", () => {
    const f = fixture(); const state = parseBuildPathState(f.player.huntLoadoutsJson);
    state.masteredCallingAugments.push("shield_prismatic_layers"); f.player.huntLoadoutsJson = serializeBuildPathState(state);
    f.internal.handleCallingAugmentEquip(f.client, { augmentId: "shield_prismatic_layers" });
    const result = parseBuildPathState(f.player.huntLoadoutsJson);
    expect(result.callingAugments.mage_mana_shield).toBe("shield_prismatic_layers");
    expect(selectedCallingAbility(result, "mage")).toBe("mage_arcane_surge");
    expect(f.client.send.mock.lastCall?.[1].selectedSpecialCallingAugmentId).toBe("shield_prismatic_layers");
  });
  it("replaces Thief healing with concealment and retains the earned augment", () => {
    const f = fixture("thief"); const state = parseBuildPathState(f.player.huntLoadoutsJson);
    state.specializations.thief = "trickster"; state.mastered.push("trickster");
    state.callingAbilities.thief = "thief_escape_artist";
    state.callingAugments.thief_escape_artist = "escape_clean_getaway";
    state.masteredCallingAugments.push("escape_clean_getaway");
    f.player.huntLoadoutsJson = serializeBuildPathState(state); f.cast();
    expect(f.player.health).toBe(20); expect(f.internal.pathConcealedUntil.get("hero")).toBe(11_500);
    expect(parseBuildPathState(f.player.huntLoadoutsJson).masteredCallingAugments).toContain("escape_clean_getaway");
  });
});
