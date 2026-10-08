import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import type { MainHandId, PowerId } from "@blockcraft/protocol";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";

type Pose = { x: number; y: number; z: number };
interface Internals {
  pendingAttacks: Map<string, { requestId: string; mainHandId: MainHandId; yaw: number; step: 1 | 2 | 3; impactAt: number }>;
  pendingPowers: Map<string, { requestId: string; powerId: PowerId; yaw: number; impactAt: number }>;
  pendingWeaponProjectiles: Map<string, { end: Pose }>;
  pendingMobProjectiles: Map<string, { end: Pose }>;
  mobHazards: Map<string, unknown>;
  mobCommittedAim: Map<string, Pose & { yaw: number }>;
  resolvePendingAttacks(now: number): void;
  resolveWeaponProjectiles(now: number): void;
  resolveMobProjectiles(now: number): void;
  resolvePendingPowers(now: number): void;
  simulatePlayers(dt: number): void;
  staggerMob(id: string, mob: MobState, now: number, duration: number, force?: boolean): boolean;
}
const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
function fixture(read = flat) {
  vi.useFakeTimers(); vi.setSystemTime(10_000);
  const room = new WorldRoom(); room.setState(new WorldState());
  Object.defineProperty(room, "readWorldBlock", { value: read });
  const events: { type: string; payload: any }[] = [];
  vi.spyOn(room, "broadcast").mockImplementation((type, payload) => { events.push({ type: String(type), payload }); });
  const player = new PlayerState(); player.x = 100.5; player.y = 1; player.z = 100.5;
  const mob = new MobState(); mob.x = 105.5; mob.y = 1; mob.z = 100.5; mob.health = 30; mob.maxHealth = 30;
  room.state.players.set("player", player); room.state.mobs.set("mob", mob);
  const internal = room as unknown as Internals;
  const release = (mainHandId: MainHandId = "bow", step: 1 | 2 | 3 = 1) => {
    internal.pendingAttacks.set("player", { requestId: "test", mainHandId, step, yaw: 90, impactAt: Date.now() });
    internal.resolvePendingAttacks(Date.now());
  };
  return { room, player, mob, internal, events, release };
}
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("authoritative combat impacts", () => {
  it("deals no projectile damage at release or before contact, then damages exactly once on contact", () => {
    const { mob, internal, release } = fixture();
    release(); expect(mob.health).toBe(30);
    internal.resolveWeaponProjectiles(10_060); expect(mob.health).toBe(30);
    internal.resolveWeaponProjectiles(10_180); expect(mob.health).toBe(29);
    internal.resolveWeaponProjectiles(10_300); expect(mob.health).toBe(29);
  });
  it.each(["bow", "magic_focus", "acid_gland_focus"] as const)("blocks %s projectile damage with terrain", weapon => {
    const { mob, internal, events, release } = fixture((x, y, z) => x === 102 && y >= 1 && y <= 3 ? Block.Stone : flat(x, y, z));
    release(weapon); internal.resolveWeaponProjectiles(10_400);
    expect(mob.health).toBe(30);
    expect(events.some(event => event.type === "combat:projectile-resolved" && event.payload.reason === "terrain")).toBe(true);
  });
  it("checks new walls during flight rather than only at launch", () => {
    let blocked = false;
    const { mob, internal, release } = fixture((x, y, z) => blocked && x === 102 && y >= 1 ? Block.Stone : flat(x, y, z));
    release(); blocked = true; internal.resolveWeaponProjectiles(10_200);
    expect(mob.health).toBe(30);
  });
  it("allows moving targets to evade a non-homing shot", () => {
    const { mob, internal, release } = fixture();
    release(); mob.z += 3; internal.resolveWeaponProjectiles(10_300);
    expect(mob.health).toBe(30);
  });
  it("does not damage an already defeated target at projectile arrival", () => {
    const { mob, internal, release } = fixture();
    release(); mob.alive = false; internal.resolveWeaponProjectiles(10_300);
    expect(mob.health).toBe(30);
  });
  it("expires a disconnected owner’s shot without damage", () => {
    const { room, mob, internal, release } = fixture();
    release(); room.state.players.delete("player"); internal.resolveWeaponProjectiles(10_300);
    expect(mob.health).toBe(30); expect(internal.pendingWeaponProjectiles.size).toBe(0);
  });
  it("hits the intervening mob instead of the originally aimed target", () => {
    const { room, mob, internal, release } = fixture();
    release();
    const interceptor = new MobState(); interceptor.x = 103.5; interceptor.y = 1; interceptor.z = 100.5;
    room.state.mobs.set("interceptor", interceptor);
    internal.resolveWeaponProjectiles(10_200);
    expect(interceptor.health).toBe(7); expect(mob.health).toBe(30);
  });
  it("blocks basic melee damage through a wall", () => {
    const { mob, release } = fixture((x, y, z) => x === 101 && y >= 1 ? Block.Stone : flat(x, y, z));
    mob.x = 102.5; release("longsword"); expect(mob.health).toBe(30);
  });
  it("blocks power damage through a wall", () => {
    const { mob, internal } = fixture((x, y, z) => x === 101 && y >= 1 ? Block.Stone : flat(x, y, z));
    mob.x = 102.5;
    internal.pendingPowers.set("player", { requestId: "power", powerId: "shockwave", yaw: 90, impactAt: 10_000 });
    internal.resolvePendingPowers(10_000); expect(mob.health).toBe(30);
  });
  it("light hits hurt without cancelling windup; a finisher can interrupt", () => {
    const { mob, release } = fixture(); mob.x = 102; mob.combatState = "windup"; mob.stateUntil = 11_000;
    release("longsword", 1); expect(mob.health).toBeLessThan(30); expect(mob.combatState).toBe("windup");
    release("longsword", 3); expect(mob.combatState).toBe("stagger");
  });
  it("prevents repeated stagger extension, but preserves a deliberate perfect parry", () => {
    const { mob, internal } = fixture();
    expect(internal.staggerMob("mob", mob, 10_000, 650)).toBe(true);
    expect(internal.staggerMob("mob", mob, 10_500, 850)).toBe(false);
    expect(mob.stateUntil).toBe(10_650);
    expect(internal.staggerMob("mob", mob, 10_700, 850)).toBe(false);
    expect(internal.staggerMob("mob", mob, 10_700, 1400, true)).toBe(true);
  });
  it("locks melee aim before release and lets a late sidestep escape", () => {
    const { player, mob, internal } = fixture(); mob.x = 99.2;
    internal.simulatePlayers(0.033); expect(mob.combatState).toBe("windup");
    vi.setSystemTime(10_300); internal.simulatePlayers(0.033);
    const yaw = mob.yaw;
    vi.setSystemTime(10_420); player.z = 102; internal.simulatePlayers(0.033);
    expect(mob.aimCommitted).toBe(true); expect(mob.yaw).toBe(yaw);
    vi.setSystemTime(10_700); internal.simulatePlayers(0.033);
    expect(player.health).toBe(5); expect(mob.actionSequence).toBe(1);
  });
  it("locks the spitter endpoint and delays damage until its travelling shot contacts a body", () => {
    const { player, mob, internal } = fixture(); mob.archetype = "cave_spitter"; mob.x = 106.5;
    internal.simulatePlayers(0.033); expect(mob.combatState).toBe("windup");
    vi.setSystemTime(10_600); internal.simulatePlayers(0.033);
    vi.setSystemTime(10_700); player.z = 103; internal.simulatePlayers(0.033);
    expect(mob.aimCommitted).toBe(true);
    vi.setSystemTime(10_950); internal.simulatePlayers(0.033);
    const shot = [...internal.pendingMobProjectiles.values()][0]!;
    expect(shot.end.z).toBe(100.5); expect(player.health).toBe(5);
    internal.resolveMobProjectiles(11_700); expect(player.health).toBe(5);
  });
  it("blocks enemy shots without spawning acid beyond the wall", () => {
    let blocked = false;
    const { player, mob, internal } = fixture((x, y, z) => blocked && x === 103 && y >= 1 ? Block.Stone : flat(x, y, z));
    mob.archetype = "cave_spitter"; mob.x = 106.5;
    internal.simulatePlayers(0.033);
    vi.setSystemTime(10_950); internal.simulatePlayers(0.033);
    blocked = true; internal.resolveMobProjectiles(11_700);
    expect(player.health).toBe(5); expect(internal.mobHazards.size).toBe(0);
  });
  it("enemy projectiles hurt on body contact, not at release", () => {
    const { player, mob, internal } = fixture(); mob.archetype = "cave_spitter"; mob.x = 106.5;
    internal.simulatePlayers(0.033);
    vi.setSystemTime(10_950); internal.simulatePlayers(0.033);
    expect(player.health).toBe(5);
    internal.resolveMobProjectiles(11_150); expect(player.health).toBe(5);
    internal.resolveMobProjectiles(11_700); expect(player.health).toBe(4);
    expect(internal.mobHazards.size).toBe(1);
  });
  it("a wall added during enemy melee windup stops the released attack", () => {
    let blocked = false;
    const { player, mob, internal } = fixture((x, y, z) => blocked && x === 101 && y >= 1 ? Block.Stone : flat(x, y, z));
    mob.x = 102.5; mob.combatState = "windup"; mob.stateUntil = 10_700; mob.targetId = "player";
    internal.simulatePlayers(0.033);
    expect(mob.combatState).toBe("windup");
    blocked = true; vi.setSystemTime(10_800); internal.simulatePlayers(0.033);
    expect(player.health).toBe(5);
  });
});
