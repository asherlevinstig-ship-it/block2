import { afterEach, describe, expect, it, vi } from "vitest";
import { Block } from "@blockcraft/voxel-world";
import type { MainHandId } from "@blockcraft/protocol";
import { WorldRoom } from "./game-room.js";
import { MobState, PlayerState, WorldState } from "./schema.js";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function fixture(wallX?: number) {
  vi.useFakeTimers(); vi.setSystemTime(10000);
  const room = new WorldRoom(); room.setState(new WorldState());
  const internal = room as any; internal.rapidPractice = true;
  Object.defineProperty(room, "readWorldBlock", { value: (x: number, y: number) =>
    y <= 0 || x === wallX ? Block.Stone : Block.Air });
  const events: { type: string; payload: any }[] = [];
  vi.spyOn(room, "broadcast").mockImplementation((type, payload) => { events.push({ type: String(type), payload }); });
  const player = new PlayerState(); Object.assign(player, { x: 200, y: 1, z: 200, mainHandId: "forged_sword" });
  room.state.players.set("hero", player);
  const client = { sessionId: "hero", send: vi.fn() } as any; room.clients.push(client);
  const addMob = (id: string, x: number) => {
    const mob = new MobState(); Object.assign(mob, { x, y: 1, z: 200, health: 30, maxHealth: 30 });
    room.state.mobs.set(id, mob); return mob;
  };
  const release = (weapon: MainHandId = "forged_sword") => {
    internal.pendingAttacks.set("hero", { requestId: "attack-1", mainHandId: weapon, step: 1, yaw: 90, impactAt: 10000 });
    internal.resolvePendingAttacks(10000);
    for (let now = 10020; now <= 10200; now += 20) internal.resolveWeaponProjectiles(now);
  };
  return { room, internal, events, player, client, addMob, release };
}

describe("fast sword combat consistency", () => {
  it.each(["longsword", "forged_sword", "matriarch_edge", "cinderfang_blade"] as const)(
    "%s reaches a target at 3m without reporting MISS after the successful pierce", weapon => {
      const { addMob, release, events } = fixture(); const mob = addMob("target", 203);
      release(weapon);
      expect(mob.health).toBeLessThan(30);
      expect(events.filter(event => event.type === "combat:hit")).toHaveLength(1);
      expect(events.filter(event => event.type === "combat:miss")).toHaveLength(0);
      expect(events.find(event => event.type === "combat:projectile-resolved")?.payload).toMatchObject({ hitCount: 1 });
    });
  it("distinguishes an empty flight from a wall encountered after hitting", () => {
    const empty = fixture(); empty.release();
    expect(empty.events.filter(event => event.type === "combat:miss")).toHaveLength(1);
    const blocked = fixture(204); const mob = blocked.addMob("target", 203); blocked.release();
    expect(mob.health).toBe(28);
    expect(blocked.events.filter(event => event.type === "combat:miss")).toHaveLength(0);
    expect(blocked.events.find(event => event.type === "combat:projectile-resolved")?.payload).toMatchObject({ reason: "terrain", hitCount: 1 });
  });
  it("still lets walls block a crescent before it damages an enemy", () => {
    const { addMob, release, events } = fixture(201); const mob = addMob("target", 203); release();
    expect(mob.health).toBe(30);
    expect(events.find(event => event.type === "combat:projectile-resolved")?.payload).toMatchObject({ reason: "terrain", hitCount: 0 });
  });
  it("pierces up to three distinct enemies without duplicate damage", () => {
    const { addMob, release, events } = fixture();
    const mobs = [201.2, 202.2, 203.2].map((x, index) => addMob(`mob-${index}`, x));
    release(); expect(mobs.map(mob => mob.health)).toEqual([28, 28, 28]);
    expect(events.filter(event => event.type === "combat:hit")).toHaveLength(3);
    expect(events.filter(event => event.type === "combat:miss")).toHaveLength(0);
  });
  it("returns the true combo and recovery on a jitter-induced rejected second attack", () => {
    const { internal, client } = fixture();
    vi.setSystemTime(10180); internal.handleAttack(client, { requestId: "attack-1", yaw: 90, actionAt: 10000 });
    vi.setSystemTime(10306); internal.handleAttack(client, { requestId: "attack-2", yaw: 90, actionAt: 10266 });
    expect(client.send).toHaveBeenCalledWith("attack:state", expect.objectContaining({
      requestId: "attack-2", accepted: false, comboStep: 1, recoveryUntil: 10346,
    }));
    vi.setSystemTime(10593); internal.handleAttack(client, { requestId: "attack-3", yaw: 90, actionAt: 10553 });
    expect(client.send).toHaveBeenCalledWith("attack:state", expect.objectContaining({
      requestId: "attack-3", accepted: true, comboStep: 2,
    }));
  });
});
