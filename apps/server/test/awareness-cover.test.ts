import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";
import { createMobAwareness, provokeMob } from "../src/mob-awareness.js";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number) => y <= 0 || x === 103 && y < 4 ? Block.Stone : Block.Air });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const mob = new MobState(); Object.assign(mob, { x: 100.5, y: 1, z: 100.5, archetype: "cave_spitter" });
  const player = new PlayerState(); Object.assign(player, { x: 105.5, y: 1, z: 102.5 });
  room.state.mobs.set("m", mob); room.state.players.set("p", player);
  internal.mobHomes.set("m", { x: 100.5, y: 1, z: 100.5 });
  return { room, internal, mob, player };
}
describe("authoritative awareness around cover", () => {
  it("investigates a delayed projectile's launch point without discovering the hidden attacker", () => {
    const { internal, mob, player } = fixture();
    internal.alertHitMob("m", "p", 10000, { x: 101.5, y: 1, z: 100.5 });
    expect(internal.mobAwareness.get("m").lastSeen).toEqual({ x: 101.5, y: 1, z: 100.5 });
    expect(mob.awarenessState).toBe("search");
    player.z = 105.5; internal.simulatePlayers(.033);
    expect(internal.mobAwareness.get("m").lastSeen.z).toBe(100.5);
    expect(mob.combatState).toBe("idle");
  });
  it("freezes windup aim when the player moves behind a wall, then resumes only with sight", () => {
    const { internal, mob, player } = fixture();
    Object.assign(mob, { combatState: "windup", targetId: "p", yaw: 90, stateUntil: 11000 });
    internal.mobCommittedAim.set("m", { x: 105.5, y: 1, z: 100.5, yaw: 90 });
    internal.simulatePlayers(.033);
    expect(mob.yaw).toBe(90); expect(internal.mobCommittedAim.get("m").z).toBe(100.5);
    Object.assign(player, { x: 101.5, z: 102.5 });
    vi.setSystemTime(10100); internal.simulatePlayers(.033);
    expect(mob.yaw).not.toBe(90); expect(internal.mobCommittedAim.get("m").z).toBe(102.5);
  });
  it("returns home after search memory expires rather than adopting a new patrol near the player", () => {
    const { internal, mob, player } = fixture();
    mob.z = 102.5;
    const awareness = createMobAwareness(); provokeMob(awareness, { ...player, id: "p" }, 6000);
    internal.mobAwareness.set("m", awareness);
    internal.simulatePlayers(.1);
    expect(mob.awarenessState).toBe("return");
    expect(mob.z).toBeLessThan(102.5); expect(internal.mobReturning.has("m")).toBe(true);
    expect(mob.combatState).toBe("idle");
  });
});
