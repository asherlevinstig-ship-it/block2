import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, type WorldBlockReader } from "@blockcraft/voxel-world";
import type { MainHandId, PowerId } from "@blockcraft/protocol";
import { MOB_ARCHETYPES } from "../src/mob-archetypes.js";
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
  pendingMobMelee: Map<string, { targetId: string; yaw: number; impactAt: number }>;
  resolveMobMelee(now: number): void;
  resolvePendingAttacks(now: number): void;
  resolveWeaponProjectiles(now: number): void;
  resolveMobProjectiles(now: number): void;
  resolvePendingPowers(now: number): void;
  simulatePlayers(dt: number): void;
  handleMove(client: { sessionId: string }, payload: unknown): void;
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
  it.each(["moss_crawler", "briar_crawler"] as const)("%s bites once, freezes its aim, and leaves a harmless recovery window", archetype => {
    const { player, mob, internal, events } = fixture();
    mob.archetype = archetype; mob.x = player.x - 1.3;
    internal.simulatePlayers(0.033);
    const release = mob.attackReleaseAt;
    vi.setSystemTime(release - 550); internal.simulatePlayers(0.033);
    expect(mob.aimCommitted).toBe(true); const yaw = mob.yaw;
    player.z += 0.1;
    vi.setSystemTime(release - 100); internal.simulatePlayers(0.033); expect(mob.yaw).toBe(yaw);
    vi.setSystemTime(release); internal.simulatePlayers(0.033);
    const contactEnd = mob.attackContactEndAt; const recoveryEnd = mob.attackRecoveryEndAt;
    vi.setSystemTime(contactEnd); internal.simulatePlayers(0.033);
    expect(player.health).toBe(4); expect(mob.combatState).toBe("recover");
    expect(recoveryEnd - contactEnd).toBe(MOB_ARCHETYPES[archetype].recoverMs);
    vi.setSystemTime(recoveryEnd - 1); internal.simulatePlayers(0.033);
    expect(player.health).toBe(4); expect(mob.combatState).toBe("recover");
    expect(events.filter(e => e.type === "combat:player-hit")).toHaveLength(1);
  });
  it.each(["moss_crawler", "briar_crawler"].flatMap(archetype => [-1, 1].map(side => [archetype, side] as const)))(
    "%s permits walking sidestep %s after commitment with 300 ms RTT and 100 ms reaction", (archetype, side) => {
      const { player, mob, internal } = fixture(); mob.archetype = archetype; mob.x = player.x - 1.3;
      internal.simulatePlayers(0.033);
      const release = mob.attackReleaseAt; const moveAt = release - 550 + 150 + 100 + 150;
      let sequence = 0;
      for (let now = 10_033; now < release + 600; now += 33) {
        vi.setSystemTime(now);
        if (now >= moveAt && sequence % 2 === 0) internal.handleMove({ sessionId: "player" },
          { sequence: sequence + 1, strafe: 0, forward: side, yaw: 90 });
        sequence++; internal.simulatePlayers(0.033);
      }
      expect(player.health).toBe(5);
    });
  it.each([1.2, 3.05].flatMap(distance => [-1, 1].map(side => [distance, side] as const)))(
    "allows a walking escape at distance %s in direction %s with 300 ms RTT and 100 ms reaction", (distance, side) => {
      const { player, mob, internal } = fixture();
      mob.archetype = "stone_brute"; mob.x = player.x - distance;
      mob.combatState = "windup"; mob.stateUntil = 11_150; mob.targetId = "player";
      mob.attackStartedAt = 10_000;
      internal.mobCommittedAim.set("mob", { x: player.x, y: player.y, z: player.z, yaw: 90 });
      let sequence = 0;
      // Aim lock: 10500. Cue delivery + human reaction + return trip: 400 ms.
      // Initial 3.05 minus the 0.45 lunge leaves 2.6 at contact: outer reach.
      for (let now = 10_000; now < 12_000; now += 33) {
        vi.setSystemTime(now);
        if (now >= 10_900 && now < 11_650 && sequence % 2 === 0) {
          internal.handleMove({ sessionId: "player" }, { sequence: sequence + 1, strafe: 0, forward: side, yaw: 90 });
        }
        sequence++;
        internal.simulatePlayers(0.033);
      }
      expect(player.health).toBe(5);
      expect(Math.abs(player.z - 100.5)).toBeGreaterThan(1.5);
    });
  it("still hits a stationary target and publishes the collision-safe landing marker", () => {
    const { player, mob, internal } = fixture(); mob.archetype = "stone_brute"; mob.x = 99.2;
    internal.simulatePlayers(0.033);
    expect(mob.attackStrikeX).toBeGreaterThan(mob.x);
    vi.setSystemTime(10_550); internal.simulatePlayers(0.033); expect(mob.aimCommitted).toBe(true);
    vi.setSystemTime(11_150); internal.simulatePlayers(0.033);
    expect(mob.attackStrikeX).toBeCloseTo(mob.x);
    vi.setSystemTime(11_500); internal.simulatePlayers(0.033);
    expect(player.health).toBeLessThan(5);
  });
  it("publishes the brute timeline during windup and recovers only after contact closes", () => {
    const { mob, internal } = fixture(); mob.archetype = "stone_brute"; mob.x = 99.2;
    internal.simulatePlayers(0.033);
    expect(mob.combatState).toBe("windup");
    expect(mob.attackStartedAt).toBe(10_000);
    expect(mob.attackReleaseAt).toBe(11_150);
    expect(mob.attackContactAt).toBe(11_430);
    expect(mob.attackContactEndAt).toBe(11_530);
    expect(mob.attackRecoveryEndAt).toBe(12_380);
    vi.setSystemTime(10_950); internal.simulatePlayers(0.033); expect(mob.aimCommitted).toBe(true);
    const lockedYaw = mob.yaw;
    vi.setSystemTime(11_150); internal.simulatePlayers(0.033);
    expect(mob.combatState).toBe("strike"); expect(mob.aimCommitted).toBe(true); expect(mob.yaw).toBe(lockedYaw);
    vi.setSystemTime(11_500); internal.simulatePlayers(0.033); expect(mob.combatState).toBe("strike");
    vi.setSystemTime(11_550); internal.simulatePlayers(0.033);
    expect(mob.combatState).toBe("recover"); expect(mob.aimCommitted).toBe(false); expect(mob.stateUntil).toBe(12_380);
    vi.setSystemTime(12_400); internal.simulatePlayers(0.033);
    expect(mob.combatState).toBe("idle"); expect(mob.attackStartedAt).toBe(0);
  });
  it("clears a cancelled timeline so it cannot produce a phantom strike", () => {
    const { mob, internal } = fixture(); mob.archetype = "stone_brute"; mob.x = 99.2;
    internal.simulatePlayers(0.033);
    expect(mob.attackContactAt).toBeGreaterThan(0);
    internal.staggerMob("mob", mob, 10_200, 650, true);
    expect(mob.attackStartedAt).toBe(0); expect(mob.attackContactAt).toBe(0);
    expect(mob.aimCommitted).toBe(false);
  });
  it("only damages during the blade contact window and never twice", () => {
    const { mob, internal } = fixture(); mob.x = 102;
    internal.pendingAttacks.set("player", { requestId: "sweep", mainHandId: "longsword", step: 1, yaw: 90, impactAt: 10_135 });
    internal.resolvePendingAttacks(10_090); expect(mob.health).toBe(30);
    internal.resolvePendingAttacks(10_225); expect(mob.health).toBe(29);
    internal.resolvePendingAttacks(10_500); expect(mob.health).toBe(29);
    expect(internal.pendingAttacks.size).toBe(0);
  });
  it("ends a missed swing without recovery damage", () => {
    const { mob, internal, release, events } = fixture();
    release("longsword"); internal.resolvePendingAttacks(10_090);
    expect(events.filter(event => event.type === "combat:miss")).toHaveLength(1);
    mob.x = 102; internal.resolvePendingAttacks(10_300);
    expect(mob.health).toBe(30);
  });
  it("delays enemy melee contact until its strike and consumes it once", () => {
    const { player, mob, internal } = fixture(); mob.x = 99.2; mob.combatState = "strike";
    internal.pendingMobMelee.set("mob", { targetId: "player", yaw: 90, impactAt: 10_150 });
    internal.resolveMobMelee(10_090); expect(player.health).toBe(5);
    internal.resolveMobMelee(10_235); expect(player.health).toBe(4);
    internal.resolveMobMelee(10_300); expect(player.health).toBe(4);
  });
  it("lets a sidestep or stagger cancel an enemy contact", () => {
    const { player, mob, internal } = fixture(); mob.x = 99.2; mob.combatState = "strike";
    internal.pendingMobMelee.set("mob", { targetId: "player", yaw: 90, impactAt: 10_150 });
    player.z += 2; internal.resolveMobMelee(10_235); expect(player.health).toBe(5);
    player.z -= 2;
    internal.pendingMobMelee.set("mob", { targetId: "player", yaw: 90, impactAt: 10_150 });
    internal.staggerMob("mob", mob, 10_000, 650);
    internal.resolveMobMelee(10_235); expect(player.health).toBe(5);
    expect(internal.pendingMobMelee.size).toBe(0);
  });
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
    internal.resolveMobMelee(11_050);
    expect(player.health).toBe(5);
  });
});
