import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, stepPlayerNetcode } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";

const readBlock = (x: number, y: number, z: number) => y <= 7 ? Block.Stone
  : Math.floor(x) === 10 && Math.floor(z) === 30 && y <= 9 ? Block.Stone : Block.Air;

describe("ordered movement near a gate post", () => {
  afterEach(() => vi.restoreAllMocks());

  function fixture() {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: readBlock });
    const player = new PlayerState();
    Object.assign(player, { x: 9.3, y: 8, z: 28.5, equippedTrait: "momentum" });
    room.state.players.set("hero", player);
    const client = { sessionId: "hero", send: vi.fn() };
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    return { room, internal, player, client, advance: (ms: number) => { now += ms; } };
  }

  it("replays each turn in packet order, not the final held direction", () => {
    const { internal, player, client, advance } = fixture();
    const steps = [
      { strafe: 0, forward: 1, dtMs: 50 },
      { strafe: 0, forward: 1, dtMs: 50 },
      { strafe: -1, forward: 0, dtMs: 50 },
      { strafe: -1, forward: 0, dtMs: 50 },
    ];
    let expected = { x: player.x, y: player.y, z: player.z, verticalVelocity: 0 };
    for (const step of steps) expected = stepPlayerNetcode(expected, step, 4.2, .05, readBlock);
    internal.handleMove(client, { sequence: 1, strafe: -1, forward: 0, yaw: 270, steps });
    expect(player.x).toBeCloseTo(expected.x, 5);
    expect(player.z).toBeCloseTo(expected.z, 5);
    expect(player.lastProcessedInput).toBe(1);
    advance(1_000); // A delayed next packet must not replay the old direction.
    const before = { x: player.x, z: player.z };
    internal.handleMove(client, { sequence: 2, strafe: 0, forward: 0, yaw: 270, steps: [] });
    expect(player.x).toBe(before.x);
    expect(player.z).toBe(before.z);
  });

  it("rejects movement time that exceeds elapsed real time", () => {
    const { internal, player, client } = fixture();
    const steps = Array.from({ length: 6 }, () => ({ strafe: 1, forward: 0, dtMs: 50 }));
    internal.handleMove(client, { sequence: 1, strafe: 1, forward: 0, yaw: 90, steps });
    const acceptedX = player.x;
    internal.handleMove(client, { sequence: 2, strafe: 1, forward: 0, yaw: 90, steps });
    expect(player.x).toBe(acceptedX);
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ action: "move", reason: "rate" }));
  });

  it("caps empty ordered packets without blocking a delayed movement burst", () => {
    const { internal, player, client } = fixture();
    for (let sequence = 1; sequence <= 121; sequence += 1)
      internal.handleMove(client, { sequence, strafe: 0, forward: 0, yaw: 0, steps: [] });
    expect(player.lastProcessedInput).toBe(120);
    expect(client.send).toHaveBeenCalledWith("action:rejected", expect.objectContaining({ action: "move", reason: "rate" }));
  });

  it("accepts a burst of ordered turns after a 1.2-second delivery stall", () => {
    const { internal, player, client, advance } = fixture();
    internal.handleMove(client, { sequence: 1, strafe: 0, forward: 0, yaw: 0,
      steps: [{ strafe: 0, forward: 0, dtMs: 50 }] });
    advance(1_200);
    let expected = { x: player.x, y: player.y, z: player.z, verticalVelocity: 0 };
    for (let sequence = 2; sequence <= 21; sequence += 1) {
      const step = { strafe: sequence < 12 ? -1 : 0, forward: sequence < 12 ? 0 : 1, dtMs: 50 };
      expected = stepPlayerNetcode(expected, step, 4.2, .05, readBlock);
      internal.handleMove(client, { sequence, strafe: step.strafe, forward: step.forward, yaw: 0, steps: [step] });
    }
    expect(player.x).toBeCloseTo(expected.x, 5);
    expect(player.z).toBeCloseTo(expected.z, 5);
    expect(player.lastProcessedInput).toBe(21);
    expect(client.send).not.toHaveBeenCalledWith("action:rejected", expect.anything());
  });
});
