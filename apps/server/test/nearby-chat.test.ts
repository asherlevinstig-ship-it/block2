import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatSendSchema, PlayerNameSchema } from "@blockcraft/protocol";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { hearsNearbyChat } from "../src/nearby-chat.js";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  const sender = { sessionId: "sender", send: vi.fn() }, near = { sessionId: "near", send: vi.fn() }, far = { sessionId: "far", send: vi.fn() }, below = { sessionId: "below", send: vi.fn() };
  for (const [client, x, y] of [[sender, 0, 8], [near, 24, 8], [far, 25, 8], [below, 0, 3]] as const) {
    const player = new PlayerState(); Object.assign(player, { x, y, z: 0, name: client.sessionId }); room.state.players.set(client.sessionId, player);
    room.clients.push(client as any);
  }
  const send = (payload: unknown) => (room as any).handleNearbyChat(sender, payload);
  return { room, sender, near, far, below, send };
}
describe("server-authoritative nearby chat", () => {
  it("delivers only to sender and nearby same-level players using authoritative names", () => {
    const { sender, near, far, below, send } = fixture(); send({ phraseId: "hello" });
    expect(sender.send).toHaveBeenCalledWith("chat:message", { senderId: "sender", name: "sender", text: "Hello!" });
    expect(near.send).toHaveBeenCalledTimes(1); expect(far.send).not.toHaveBeenCalled(); expect(below.send).not.toHaveBeenCalled();
  });
  it("rate limits repeated sends and accepts the next message after the interval", () => {
    const { near, sender, send } = fixture(); send({ phraseId: "hello" }); send({ phraseId: "help" });
    expect(near.send).toHaveBeenCalledTimes(1); expect(sender.send).toHaveBeenCalledWith("chat:notice", expect.any(String));
    vi.advanceTimersByTime(1200); send({ phraseId: "retreat" }); expect(near.send).toHaveBeenCalledTimes(2);
  });
  it("rejects invalid, oversized and empty messages", () => {
    const { near, send } = fixture();
    for (const payload of [null, { text: "typed chat" }, { phraseId: "arbitrary" }, { phraseId: "hello", text: "injected" }]) send(payload);
    expect(near.send).not.toHaveBeenCalled();
  });
  it("accepts only preset callouts", () => {
    expect(ChatSendSchema.safeParse({ phraseId: "hello" }).success).toBe(true);
    expect(ChatSendSchema.safeParse({ text: "Hi" }).success).toBe(false);
  });
  it("bounds display names and prevents markup in names", () => {
    for (const name of ["A", "a".repeat(21), "<img src=x>", "\n"]) expect(PlayerNameSchema.safeParse(name).success).toBe(false);
    expect(PlayerNameSchema.parse("  Ash_85  ")).toBe("Ash_85");
  });
  it("enforces radius and vertical boundaries", () => {
    expect(hearsNearbyChat({ x: 0, y: 8, z: 0 }, { x: 24, y: 10.5, z: 0 })).toBe(true);
    expect(hearsNearbyChat({ x: 0, y: 8, z: 0 }, { x: 24.01, y: 8, z: 0 })).toBe(false);
    expect(hearsNearbyChat({ x: 0, y: 8, z: 0 }, { x: 0, y: 5.49, z: 0 })).toBe(false);
  });
});
