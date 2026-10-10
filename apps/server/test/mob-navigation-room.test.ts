import { describe, expect, it } from "vitest";
import { Block, isInStoneBruteArena, STONE_BRUTE_ARENA_HOME, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";

function fixture(read: WorldBlockReader) {
  const room = new WorldRoom();
  room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: read });
  const internals = room as unknown as { simulatePlayers: (dt: number) => void };
  const mob = new MobState();
  mob.x = 100.5; mob.y = 1; mob.z = 100.5;
  room.state.mobs.set("test", mob);
  return { room, mob, tick: () => internals.simulatePlayers(0.1) };
}

describe("mob navigation in the authoritative room", () => {
  it("keeps other mobs from chasing or being pushed into the reserved brute arena", () => {
    const read: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
    const { room, mob, tick } = fixture(read);
    mob.x = 34.5; mob.z = 40.5;
    const player = new PlayerState(); player.x = 37.5; player.y = 1; player.z = 40.5;
    room.state.players.set("player", player); tick();
    expect(mob.combatState).toBe("idle");
    const internal = room as any;
    internal.displaceMob("test", mob, { x: 5, z: 0 });
    expect(isInStoneBruteArena(mob.x, mob.z)).toBe(false);
  });
  it("allows the designated brute to pursue inside its arena", () => {
    const read: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
    const { room, mob, tick } = fixture(read);
    room.state.mobs.delete("test"); room.state.mobs.set("stone-brute", mob);
    Object.assign(mob, { ...STONE_BRUTE_ARENA_HOME, y: 1, archetype: "stone_brute" });
    const player = new PlayerState(); player.x = mob.x + 5; player.y = 1; player.z = mob.z;
    room.state.players.set("player", player); const before = mob.x; tick();
    expect(mob.x).toBeGreaterThan(before);
  });
  it("uses obstacle routing when chasing a player in the room simulation", () => {
    let obstructed = false;
    const read: WorldBlockReader = (x, y, z) => y <= 0 || (obstructed && x === 102 && z >= 99 && z <= 101 && y <= 3) ? Block.Stone : Block.Air;
    const { room, mob, tick } = fixture(read);
    const player = new PlayerState();
    player.x = 106.5; player.y = 1; player.z = 100.5;
    room.state.players.set("player", player);
    tick(); // Acquire while visible, then follow last-seen information around new cover.
    obstructed = true;
    for (let i = 0; i < 120; i += 1) {
      tick();
      expect(playerCollides(read, mob.x, mob.y, mob.z)).toBe(false);
    }
    expect(mob.x).toBeGreaterThan(103);
  });
  it.each(["windup", "stagger", "recover"])("keeps gravity active during %s", combatState => {
    const read: WorldBlockReader = (_x, y, _z) => y <= -3 ? Block.Stone : Block.Air;
    const { mob, tick } = fixture(read);
    mob.combatState = combatState;
    mob.stateUntil = Date.now() + 60_000;
    tick();
    expect(mob.y).toBeLessThan(1);
    for (let i = 0; i < 30; i += 1) tick();
    expect(mob.y).toBeCloseTo(-2, 1);
  });
});
