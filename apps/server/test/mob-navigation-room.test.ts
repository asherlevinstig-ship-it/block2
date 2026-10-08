import { describe, expect, it } from "vitest";
import { Block, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
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
  it("uses obstacle routing when chasing a player in the room simulation", () => {
    const read: WorldBlockReader = (x, y, z) => y <= 0 || (x === 102 && z >= 99 && z <= 101 && y <= 3) ? Block.Stone : Block.Air;
    const { room, mob, tick } = fixture(read);
    const player = new PlayerState();
    player.x = 106.5; player.y = 1; player.z = 100.5;
    room.state.players.set("player", player);
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
