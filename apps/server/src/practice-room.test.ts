import { describe, expect, it, vi } from "vitest";
import { CALLING_ABILITY_OPTIONS } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { effectiveBuildPathRank, parseBuildPathState } from "./build-paths.js";

describe("private Calling practice", () => {
  function fixture() {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    internal.roomKind = "practice";
    const player = new PlayerState();
    Object.assign(player, { x: 99.5, y: 8, z: 106.5, level: 10 });
    room.state.players.set("trainee", player);
    const client = { sessionId: "trainee", send: vi.fn() };
    return { room, internal, player, client };
  }

  it.each(CALLING_ABILITY_OPTIONS)("temporarily equips $id at Master rank", option => {
    const { internal, player, client } = fixture();
    internal.selectPracticeAbility(client, { abilityId: option.id });
    const state = parseBuildPathState(player.huntLoadoutsJson);
    expect(state.selectedPathId).toBe(option.pathId);
    expect(state.callingAbilities[option.pathId]).toBe(option.id);
    expect(effectiveBuildPathRank(state, option.pathId)).toBe(4);
    expect(player.mainHandTag).toBe(option.pathId === "ranger" ? "ranged"
      : option.pathId === "mage" || option.pathId === "healer" ? "focus" : "melee");
    expect(client.send).toHaveBeenCalledWith("practice:state", expect.objectContaining({ active: true, abilityId: option.id }));
  });

  it("never saves practice changes or produces loot from a training kill", async () => {
    const { room, internal, player } = fixture();
    internal.profileTokens.set("trainee", "test-profile");
    await expect(internal.persistPlayer("trainee", player, true)).resolves.toBeUndefined();
    const mob = new MobState(); Object.assign(mob, { alive: true, health: 1, maxHealth: 10 });
    room.state.mobs.set("practice-crawler", mob);
    internal.defeatMob("practice-crawler", mob, "trainee", 10_000);
    expect(mob.alive).toBe(false);
    expect(mob.respawnAt).toBe(13_000);
    expect(room.state.lootDrops.size).toBe(0);
  });
});
