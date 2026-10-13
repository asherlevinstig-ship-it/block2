import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import { MobState, PlayerState, WorldState } from "./schema.js";
import { WorldRoom } from "./game-room.js";

afterEach(() => vi.useRealTimers());

function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
  const player = new PlayerState(); Object.assign(player, { x: 70.5, y: 8, z: 40.5, stamina: 100, maxStamina: 100 });
  room.state.players.set("hero", player);
  const sent: { type: string; value: any }[] = [];
  const client = { sessionId: "hero", send: (type: string, value: unknown) => sent.push({ type, value }) };
  const dodge = (requestId: string) => (room as any).handleDodge(client, { requestId, strafe: 1, forward: 0, yaw: 90 });
  return { room, player, sent, dodge };
}

describe("authoritative dodge pressure", () => {
  it("charges more for a consecutive dodge and enforces exhaustion", () => {
    const { player, sent, dodge } = fixture();
    dodge("one");
    expect(player.stamina).toBe(65);
    vi.advanceTimersByTime(400);
    dodge("two");
    expect(player.stamina).toBe(20);
    expect(sent.at(-1)).toMatchObject({ type: "dodge:pressure", value: { phase: "exhausted", cost: 45, chain: 1 } });
    vi.advanceTimersByTime(400);
    dodge("three");
    expect(player.stamina).toBe(20);
    expect(sent.at(-1)).toMatchObject({ type: "action:rejected", value: { action: "dodge", reason: "rate" } });
  });

  it("rewards an actual avoided collision and resets dodge pressure", () => {
    const { room, player, dodge } = fixture();
    dodge("one");
    vi.advanceTimersByTime(100);
    expect((room as any).damagePlayer("test-mob", "hero", 2, Date.now())).toBe(false);
    expect(player.health).toBe(5);
    expect(player.stamina).toBe(80);
    expect((room as any).dodgeCounterUntil.get("hero")).toBeGreaterThan(Date.now());
    expect((room as any).dodgePressure.get("hero").chain).toBe(0);
  });

  it("consumes the perfect-dodge counter on the next confirmed weapon hit", () => {
    const { room } = fixture();
    const mob = new MobState(); Object.assign(mob, { x: 71.5, y: 8, z: 40.5, health: 8, maxHealth: 8, armor: 0 });
    room.state.mobs.set("target", mob);
    (room as any).dodgeCounterUntil.set("hero", Date.now() + 1_000);
    (room as any).applyWeaponHit("hero", { requestId: "counter", mainHandId: "longsword", yaw: 90, step: 1, impactAt: Date.now() }, "target", Date.now());
    expect(mob.health).toBe(6);
    expect((room as any).dodgeCounterUntil.has("hero")).toBe(false);
  });
});
