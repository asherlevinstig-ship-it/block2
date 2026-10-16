import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function fixture() {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  vi.spyOn(room, "broadcast").mockImplementation(() => {});
  const player = new PlayerState(); Object.assign(player, { x: 70.5, y: 8, z: 40.5, stamina: 100, maxStamina: 100 });
  const mob = new MobState(); Object.assign(mob, { x: 72.5, y: 8, z: 40.5, attackDamage: 2 });
  room.state.players.set("hero", player); room.state.mobs.set("enemy", mob);
  const client = { sessionId: "hero", send: vi.fn() } as any;
  room.clients.push(client);
  const internal = room as any;
  return { room, player, client, internal };
}

describe("bounded incoming-hit confirmation", () => {
  it("waits 100ms, then accepts a dodge pressed before contact", () => {
    const { player, client, internal } = fixture();
    internal.queueIncomingHit("enemy", "hero", 2, Date.now());
    expect(player.health).toBe(5);
    vi.setSystemTime(10_050);
    internal.handleDodge(client, { requestId: "dodge-1", strafe: 1, forward: 0, yaw: 90, actionAt: 9_990 });
    internal.resolvePendingIncomingHits(10_099);
    expect(player.health).toBe(5);
    internal.resolvePendingIncomingHits(10_100);
    expect(player.health).toBe(5);
    expect(internal.pendingIncomingHits).toHaveLength(0);
    expect(internal.dodgeCounterUntil.get("hero")).toBeGreaterThan(10_100);
  });

  it("does not let a dodge pressed after contact erase the hit", () => {
    const { player, client, internal } = fixture();
    internal.queueIncomingHit("enemy", "hero", 2, Date.now());
    vi.setSystemTime(10_050);
    internal.handleDodge(client, { requestId: "dodge-1", strafe: 1, forward: 0, yaw: 90, actionAt: 10_020 });
    internal.resolvePendingIncomingHits(10_100);
    expect(player.health).toBe(3);
  });

  it("applies an unavoided hit once and ignores a guard raised after contact", () => {
    const { player, internal } = fixture();
    internal.queueIncomingHit("enemy", "hero", 2, Date.now());
    player.defending = true;
    player.defenseStartedAt = 10_050;
    internal.resolvePendingIncomingHits(10_100);
    internal.resolvePendingIncomingHits(10_200);
    expect(player.health).toBe(3);
  });

  it("keeps a guard that was active at contact even if released before confirmation", () => {
    const { player, internal } = fixture();
    player.defending = true; player.defenseStartedAt = 9_700; player.yaw = 90;
    internal.queueIncomingHit("enemy", "hero", 2, Date.now());
    player.defending = false;
    internal.resolvePendingIncomingHits(10_100);
    expect(player.health).toBe(4);
  });
});
