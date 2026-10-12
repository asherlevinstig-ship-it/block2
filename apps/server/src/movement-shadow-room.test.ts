import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { defineRoom } from "@colyseus/core";
import type { ConfigOptions } from "@colyseus/tools";
import { boot, type ColyseusTestServer } from "@colyseus/testing";
import { WorldRoom } from "./game-room.js";

describe("development shadow in the real world room", () => {
  let testServer: ColyseusTestServer;
  const previousFlag = process.env.MOVEMENT_SHADOW_AB;
  const previousRollback = process.env.MOVEMENT_NETCODE_LEGACY;
  beforeAll(async () => {
    process.env.MOVEMENT_SHADOW_AB = "1";
    delete process.env.MOVEMENT_NETCODE_LEGACY;
    const config = { rooms: {
      shadow_world: defineRoom(WorldRoom, { roomKind: "overworld" }),
      pilot_depths: defineRoom(WorldRoom, { roomKind: "silver-depths" }).filterBy(["instanceKey"]),
    } } as ConfigOptions;
    testServer = await boot(config, 2569);
  });
  afterAll(async () => {
    await testServer?.shutdown();
    if (previousFlag === undefined) delete process.env.MOVEMENT_SHADOW_AB;
    else process.env.MOVEMENT_SHADOW_AB = previousFlag;
    if (previousRollback === undefined) delete process.env.MOVEMENT_NETCODE_LEGACY;
    else process.env.MOVEMENT_NETCODE_LEGACY = previousRollback;
  });

  it("accepts Colyseus input and reports a shadow without changing the player", async () => {
    const serverRoom = await testServer.createRoom<WorldRoom>("shadow_world");
    const clientRoom = await testServer.connectTo(serverRoom);
    const ready = new Promise<{ tickRate: number }>(resolve => clientRoom.onMessage("movement:shadow:ready", resolve));
    clientRoom.send("movement:shadow:hello");
    expect((await ready).tickRate).toBe(30);
    const input = clientRoom.input<{ strafe: number; forward: number; yaw: number }>({ mode: "reliable" });
    expect(input.stepSeconds).toBeCloseTo(1 / 30);
    const initialX = serverRoom.state.players.get(clientRoom.sessionId)!.x;
    input.data.strafe = 1;
    input.data.forward = 0;
    input.data.yaw = 0;
    input.send();
    await serverRoom.waitForNextTimestep();
    const shadow = (serverRoom as unknown as { movementShadows: Map<string, { x: number }> }).movementShadows.get(clientRoom.sessionId);
    expect(shadow?.x).toBeGreaterThan(initialX);
    expect(serverRoom.state.players.get(clientRoom.sessionId)!.x).toBeCloseTo(initialX, 3);
    await clientRoom.leave();
  });

  it("lets the opt-in Colyseus stream control the authoritative player", async () => {
    const serverRoom = await testServer.createRoom<WorldRoom>("shadow_world");
    const clientRoom = await testServer.connectTo(serverRoom);
    const ready = new Promise<{ tickRate: number; control: boolean }>(resolve => clientRoom.onMessage("movement:shadow:ready", resolve));
    clientRoom.send("movement:shadow:hello", { control: true });
    expect((await ready).control).toBe(true);
    const input = clientRoom.input<{ strafe: number; forward: number; yaw: number }>({ mode: "reliable" });
    const initialX = serverRoom.state.players.get(clientRoom.sessionId)!.x;
    input.data.strafe = 1;
    input.data.forward = 0;
    input.data.yaw = 90;
    input.send();
    await vi.waitFor(() => {
      expect(serverRoom.state.players.get(clientRoom.sessionId)!.x).toBeGreaterThan(initialX);
    }, { timeout: 1500 });
    expect(serverRoom.state.players.get(clientRoom.sessionId)!.yaw).toBe(90);
    await clientRoom.leave();
  });

  it("keeps Colyseus movement available in the separate Silver Depths room after a room transfer", async () => {
    const serverRoom = await testServer.createRoom<WorldRoom>("pilot_depths", { instanceKey: "pilot-test", partySize: 1 });
    const clientRoom = await testServer.connectTo(serverRoom, { instanceKey: "pilot-test", partySize: 1 });
    const ready = new Promise<{ control: boolean }>(resolve => clientRoom.onMessage("movement:shadow:ready", resolve));
    clientRoom.send("movement:shadow:hello", { control: true });
    expect((await ready).control).toBe(true);
    const input = clientRoom.input<{ strafe: number; forward: number; yaw: number }>({ mode: "reliable" });
    const player = serverRoom.state.players.get(clientRoom.sessionId)!;
    const spawnX = player.x;
    expect(spawnX).toBeGreaterThan(60);
    input.data.strafe = 1;
    input.data.forward = 0;
    input.data.yaw = 90;
    input.send();
    await vi.waitFor(() => expect(player.x).toBeGreaterThan(spawnX), { timeout: 1500 });

    // A refresh/reconnect keeps the same dungeon seat and must not replay
    // movement buffered before the connection dropped.
    const serverClient = serverRoom.clients.find(client => client.sessionId === clientRoom.sessionId)!;
    const reserve = vi.spyOn(serverRoom, "allowReconnection").mockImplementation(() => ({ catch: () => undefined }) as never);
    serverRoom.onDrop(serverClient);
    expect(reserve).toHaveBeenCalledWith(serverClient, 45);
    expect(serverRoom.state.players.get(clientRoom.sessionId)).toBe(player);
    expect(serverRoom.inputs!.get(clientRoom.sessionId).size).toBe(0);
    serverRoom.onReconnect(serverClient);
    const resumeX = player.x;
    input.send();
    await vi.waitFor(() => expect(player.x).toBeGreaterThan(resumeX), { timeout: 1500 });
    reserve.mockRestore();
    await clientRoom.leave();
  });
});
