import { describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { chooseBuildPath, grantBuildPathXp, parseBuildPathState, serializeBuildPathState } from "./build-paths.js";
import type { BuildPathId, MainHandId } from "@blockcraft/protocol";

function fixture(pathId: BuildPathId, xp: number, mainHandId: MainHandId, mainHandTag: "melee" | "ranged" | "focus") {
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState();
  Object.assign(player, { x: 10, y: 8, z: 10, health: 10, maxHealth: 10, level: 10, mainHandId, mainHandTag });
  player.huntLoadoutsJson = serializeBuildPathState(grantBuildPathXp(
    chooseBuildPath(parseBuildPathState("{}"), pathId), xp).state);
  room.state.players.set("hero", player);
  internal.clients.push({ sessionId: "hero", send: vi.fn() });
  const mob = new MobState();
  Object.assign(mob, { x: 12, y: 8, z: 10, health: 20, maxHealth: 20, alive: true, combatState: "windup" });
  room.state.mobs.set("target", mob);
  return { room, internal, player, mob };
}

describe("authoritative Calling weapon progression", () => {
  it("rewards a Veteran Tank for striking a windup", () => {
    const f = fixture("tank", 70, "forged_sword", "melee");
    expect(f.internal.buildPathDamageBonus(f.player, f.mob, "target", "hero", 10_000, "weapon")).toBe(2);
  });

  it("surges every third Adept Mage focus hit", () => {
    const f = fixture("mage", 30, "forged_focus", "focus");
    expect([1, 2, 3].map(() => f.internal.buildPathDamageBonus(
      f.player, f.mob, "target", "hero", 10_000, "weapon"))).toEqual([0, 0, 1]);
  });

  it("rewards a Veteran Thief for attacking a distracted target", () => {
    const f = fixture("thief", 70, "fang_dagger", "melee");
    f.mob.targetId = "someone-else";
    expect(f.internal.buildPathDamageBonus(f.player, f.mob, "target", "hero", 10_000, "weapon")).toBe(2);
  });

  it("pulses two healing after three Master Healer focus hits", () => {
    const f = fixture("healer", 140, "forged_focus", "focus");
    const mastery = parseBuildPathState(f.player.huntLoadoutsJson);
    mastery.specializations.healer = "lifebinder";
    mastery.mastered.push("lifebinder");
    f.player.huntLoadoutsJson = serializeBuildPathState(mastery);
    f.player.health = 4;
    f.internal.applyCallingWeaponSupport("hero", f.player, 10_000);
    f.internal.applyCallingWeaponSupport("hero", f.player, 10_001);
    expect(f.player.health).toBe(4);
    f.internal.applyCallingWeaponSupport("hero", f.player, 10_002);
    expect(f.player.health).toBe(6);
  });
});
