import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defineRoom, defineServer, Room } from "@colyseus/core";
import { schema, t, type SchemaType } from "@colyseus/schema";
import { Predict } from "@colyseus/sdk";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { Block, resolvePlayerMotion } from "@blockcraft/voxel-world";

// Deliberately test-only: this room cannot be joined through the production server.
const PilotInput = schema({ strafe: t.float32(), forward: t.float32() }, "PilotMoveInput");
type PilotCommand = Pick<SchemaType<typeof PilotInput>, "strafe" | "forward">;
const PilotState = schema({
  x: t.float32().default(4.5), y: t.float32().default(2), z: t.float32().default(4.5),
}, "PilotMovementState");
type PilotState = SchemaType<typeof PilotState>;

const readFloor = (_x: number, y: number, _z: number) => y < 1 ? Block.Stone : Block.Air;
const STEP_SECONDS = 1 / 30;
const SPEED = 4.2;

function applyPilotMovement(state: PilotState, input: PilotCommand, dt: number): void {
  const length = Math.max(1, Math.hypot(input.strafe, input.forward));
  const next = resolvePlayerMotion({ x: state.x, y: state.y, z: state.z }, {
    x: input.strafe / length * SPEED * dt,
    y: 0,
    z: input.forward / length * SPEED * dt,
  }, readFloor);
  state.x = next.x; state.y = next.y; state.z = next.z;
}

class MovementPilotRoom extends Room<{ state: PilotState; input: SchemaType<typeof PilotInput> }> {
  override inputs = this.defineInput(PilotInput, {
    sanitize: { strafe: [-1, 1], forward: [-1, 1] },
    bufferMaxSize: 64,
  });

  override onCreate(): void {
    this.setState(new PilotState());
    this.setFixedTimestep(ctx => {
      for (const client of this.clients) {
        const input = this.inputs.get(client.sessionId).next();
        if (input) applyPilotMovement(this.state, input, ctx.dt);
      }
    }, 30);
  }
}

describe("isolated Colyseus movement pilot", () => {
  let testServer: ColyseusTestServer;
  beforeAll(async () => {
    testServer = await boot(defineServer({ rooms: { movement_pilot: defineRoom(MovementPilotRoom) } }));
  });
  afterAll(async () => { await testServer?.shutdown(); });

  it("runs the same voxel collision step on client prediction and the authoritative server", async () => {
    const serverRoom = await testServer.createRoom<MovementPilotRoom>("movement_pilot");
    const clientRoom = await testServer.connectTo(serverRoom);
    const input = clientRoom.input({ type: PilotInput, mode: "reliable" });
    const predict = Predict.get(clientRoom);
    const local = predict.reconciler(clientRoom.state, {
      input,
      fields: ["x", "y", "z"],
      step: (ctx, state, command) => applyPilotMovement(state, command, ctx.dt),
      smoothMs: 65,
    });
    expect(input.stepSeconds).toBeCloseTo(STEP_SECONDS);
    input.data.strafe = 1;
    input.data.forward = 0;
    input.send();
    expect(local.state.x).toBeGreaterThan(4.5);
    await vi.waitFor(() => {
      predict.tick(performance.now());
      expect(serverRoom.state.x).toBeGreaterThan(4.5);
      expect(clientRoom.state.x).toBeCloseTo(serverRoom.state.x, 3);
      expect(local.state.x).toBeCloseTo(serverRoom.state.x, 3);
    }, { timeout: 1500 });
    clientRoom.leave();
  });

  it("compares turns and stops while several inputs are still awaiting authority", async () => {
    const serverRoom = await testServer.createRoom<MovementPilotRoom>("movement_pilot");
    const clientRoom = await testServer.connectTo(serverRoom);
    const input = clientRoom.input({ type: PilotInput, mode: "reliable" });
    const predict = Predict.get(clientRoom);
    const local = predict.reconciler(clientRoom.state, {
      input,
      fields: ["x", "y", "z"],
      step: (ctx, state, command) => applyPilotMovement(state, command, ctx.dt),
      smoothMs: 65,
    });
    const commands = [
      { strafe: 1, forward: 0 },
      { strafe: 1, forward: 0 },
      { strafe: 0, forward: 1 },
      { strafe: 0, forward: 1 },
      { strafe: 0, forward: 0 },
    ];
    let baseline = { x: 4.5, y: 2, z: 4.5 };
    for (const [index, command] of commands.entries()) {
      input.data.strafe = command.strafe;
      input.data.forward = command.forward;
      input.send();
      // Equivalent to the current client's per-frame voxel-motion replay.
      baseline = resolvePlayerMotion(baseline, { x: command.strafe * SPEED * STEP_SECONDS, y: 0,
        z: command.forward * SPEED * STEP_SECONDS }, readFloor);
    }
    expect(local.state.x).toBeCloseTo(baseline.x, 3);
    expect(local.state.z).toBeCloseTo(baseline.z, 3);
    expect(serverRoom.state.x).toBeLessThan(local.state.x);

    // The server consumes one input per fixed step, preserving the turn and stop.
    await vi.waitFor(() => {
      predict.tick(performance.now());
      expect(serverRoom.state.x).toBeCloseTo(baseline.x, 3);
      expect(serverRoom.state.z).toBeCloseTo(baseline.z, 3);
      expect(local.state.x).toBeCloseTo(serverRoom.state.x, 3);
      expect(local.state.z).toBeCloseTo(serverRoom.state.z, 3);
    }, { timeout: 1500 });
    clientRoom.leave();
  });

  it("predicts immediately while outgoing movement is delayed, then converges after delivery", async () => {
    const serverRoom = await testServer.createRoom<MovementPilotRoom>("movement_pilot");
    const clientRoom = await testServer.connectTo(serverRoom);
    const input = clientRoom.input({ type: PilotInput, mode: "reliable" });
    const predict = Predict.get(clientRoom);
    const local = predict.reconciler(clientRoom.state, {
      input,
      fields: ["x", "y", "z"],
      step: (ctx, state, command) => applyPilotMovement(state, command, ctx.dt),
      smoothMs: 65,
    });
    const sendNow = clientRoom.connection.send.bind(clientRoom.connection);
    clientRoom.connection.send = data => { setTimeout(() => sendNow(data), 150); };

    input.data.strafe = 1;
    input.data.forward = 0;
    input.send();
    const predictedX = local.state.x;
    expect(predictedX).toBeGreaterThan(4.5);
    expect(serverRoom.state.x).toBe(4.5);

    await vi.waitFor(() => {
      predict.tick(performance.now());
      expect(serverRoom.state.x).toBeCloseTo(predictedX, 3);
      expect(local.state.x).toBeCloseTo(serverRoom.state.x, 3);
    }, { timeout: 1500 });
    clientRoom.connection.send = sendNow;
    await clientRoom.leave();
  });
});
