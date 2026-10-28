import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { type BuildPathId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, grantBuildPathXp, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(path: BuildPathId = "mage", wall = false) {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
  internal.roomKind = "practice"; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number) => y <= 7 || wall && x === 331 && y < 12 ? Block.Stone : Block.Air });
  vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
  const broadcast = vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState(); Object.assign(player, { x: 330, y: 8, z: 105, level: 5, health: 20, maxHealth: 30, stamina: 98 });
  const state = grantBuildPathXp(chooseBuildPath(parseBuildPathState("{}"), path), 140).state;
  player.huntLoadoutsJson = serializeBuildPathState(state);
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() }; internal.clients.push(client);
  const mob = new MobState(); Object.assign(mob, { x: 332, y: 8, z: 105, health: 100, maxHealth: 100, armor: 0, targetId: "hero" });
  room.state.mobs.set("target", mob);
  const cast = (slot: "power" | "special" = "power", requestId = "cast") => internal.handleCallingAbility(client, { requestId, slot, yaw: 90 });
  return { room, internal, player, client, mob, cast, broadcast };
}

describe("Calling effects audit regressions", () => {
  it.each(["tank", "mage", "assassin", "thief", "ranger", "healer"] as const)("rejects %s effects from a defeated caster", path => {
    const f = fixture(path); f.player.health = 0; f.cast(); f.cast("special");
    expect(f.client.send).not.toHaveBeenCalledWith("calling:ability", expect.anything());
    expect(f.internal.callingAbilityReadyAt.size).toBe(0); expect(f.mob.health).toBe(100);
  });
  it.each(["mage", "tank", "thief"] as const)("does not let %s area effects reach through a wall", path => {
    const f = fixture(path, true);
    const state = parseBuildPathState(f.player.huntLoadoutsJson);
    if (path === "tank") state.callingAbilities.tank = "tank_earthbreaker";
    f.player.huntLoadoutsJson = serializeBuildPathState(state);
    f.internal.mobAwareness.set("target", { targetId: "hero" }); f.cast();
    expect(f.mob.health).toBe(100);
    if (path === "thief") expect(f.internal.mobAwareness.has("target")).toBe(true);
  });
  it("advances the real F cooldown with Temporal Flux and sends its new recovery time", () => {
    const f = fixture(); const state = parseBuildPathState(f.player.huntLoadoutsJson);
    state.callingAugments.mage_arcane_surge = "surge_temporal_flux";
    f.player.huntLoadoutsJson = serializeBuildPathState(state);
    f.internal.callingSpecialReadyAt.set("hero", 30_000); f.cast();
    expect(f.internal.callingSpecialReadyAt.get("hero")).toBe(26_000);
    expect(f.client.send).toHaveBeenCalledWith("calling:recovery", { slot: "special", cooldownUntil: 26_000 });
  });
  it("reports actual resource recovery and the server's range and cast identity", () => {
    const f = fixture(); f.cast();
    expect(f.client.send).toHaveBeenCalledWith("calling:ability", expect.objectContaining({ detail: expect.stringContaining("+2 STAMINA") }));
    expect(f.broadcast).toHaveBeenCalledWith("calling:ability:effect", expect.objectContaining({ effectId: "cast", radius: 4.5, yaw: 90, x: 330 }));
    expect(f.client.send).not.toHaveBeenCalledWith("calling:ability:effect", expect.anything());
  });
  it("keeps Disengage shots distinct from Volley Focus and credits its own trial", () => {
    const f = fixture("ranger"); f.player.mainHandTag = "ranged";
    const state = parseBuildPathState(f.player.huntLoadoutsJson); state.specializations.ranger = "marksman"; state.mastered.push("marksman");
    f.player.huntLoadoutsJson = serializeBuildPathState(state);
    const other = new MobState(); Object.assign(other, { x: 333, y: 8, z: 105, health: 100, maxHealth: 100 }); f.room.state.mobs.set("other", other);
    f.cast("special");
    expect(f.internal.rangerCallingFocus.get("hero").abilityId).toBe("ranger_disengage");
    f.internal.buildPathDamageBonus(f.player, f.mob, "target", "hero", 10_000, "weapon");
    expect(other.health).toBe(100);
    expect(parseBuildPathState(f.player.huntLoadoutsJson).callingAugmentProgress.disengage_evasive_roll).toBe(1);
    expect(f.broadcast).not.toHaveBeenCalledWith("ranger:volley-split", expect.anything());
  });
  it("does not shorten Bulwark or grant Challenge the ally-protection wall", () => {
    const f = fixture("tank"); f.cast(); const until = f.internal.tankBulwarkUntil.get("hero");
    f.cast("special"); expect(f.internal.tankBulwarkUntil.get("hero")).toBe(until);
    expect(f.internal.tankChallengeUntil.get("hero")).toBe(13_000);
    f.internal.tankBulwarkUntil.delete("hero");
    const ally = new PlayerState(); Object.assign(ally, { x: 328, y: 8, z: 105, health: 20, maxHealth: 30 }); f.room.state.players.set("ally", ally);
    f.internal.damagePlayer("target", "ally", 3, 10_000, false);
    expect(ally.health).toBe(17);
  });
  it("clears buffs and pending spell effects on death", () => {
    const f = fixture(); f.cast("special");
    f.internal.pendingMageOverloads.set("blast", { ownerId: "hero" });
    f.internal.renewalFields.set("field", { ownerId: "hero" });
    f.internal.damagePlayer("target", "hero", 1000, 10_000, false);
    expect(f.player.health).toBe(0); expect(f.internal.mageBarrierHits.has("hero")).toBe(false);
    expect(f.internal.pendingMageOverloads.size).toBe(0); expect(f.internal.renewalFields.size).toBe(0);
    expect(f.broadcast).toHaveBeenCalledWith("calling:reset", { playerId: "hero" });
  });
  it("immediately clears Resurrection's channel effect when damage interrupts it", () => {
    const f = fixture("healer"); f.internal.pendingResurrections.set("hero", { targetId: "fallen", health: 20 });
    f.internal.damagePlayer("target", "hero", 2, 10_000, false);
    expect(f.internal.pendingResurrections.has("hero")).toBe(false);
    expect(f.broadcast).toHaveBeenCalledWith("healer:resurrection-interrupted", { casterId: "hero", targetId: "fallen" });
    expect(f.broadcast).toHaveBeenCalledWith("calling:state", expect.objectContaining({ abilityId: "healer_resurrection", phase: "clear" }));
  });
  it("lets normal-range Deadeye hits earn Eagle Eye without needing Eagle Eye first", () => {
    const f = fixture("ranger"); const state = parseBuildPathState(f.player.huntLoadoutsJson);
    state.specializations.ranger = "marksman"; state.mastered.push("marksman"); state.callingAbilities.ranger = "ranger_deadeye";
    f.player.huntLoadoutsJson = serializeBuildPathState(state); f.cast();
    expect(parseBuildPathState(f.player.huntLoadoutsJson).callingAugmentProgress.deadeye_eagle_eye).toBe(1);
  });
  it("clears Death Mark's persistent effect when the marked enemy is defeated", () => {
    const f = fixture("assassin"); f.cast("special");
    f.internal.defeatMob("target", f.mob, "hero", 10_100);
    expect(f.internal.specialMarks.has("hero")).toBe(false);
    expect(f.broadcast).toHaveBeenCalledWith("calling:state", expect.objectContaining({ abilityId: "assassin_death_mark", phase: "clear" }));
  });
});
