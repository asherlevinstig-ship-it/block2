import { describe, expect, it, vi } from "vitest";
import { Block, isInStoneBruteArena, STONE_BRUTE_ARENA_HOME, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
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
  it("abandons blocked pursuit without teleporting and does not immediately reacquire", () => {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    try {
      const { room, mob, tick } = fixture((_x, y) => y <= 0 ? Block.Stone : Block.Air);
      const internal = room as any;
      Object.defineProperty(room, "mobPositionAllowed", { value: () => false });
      internal.mobHomes.set("test", { x: 100.5, y: 1, z: 100.5 });
      const player = new PlayerState(); Object.assign(player, { x: 106.5, y: 1, z: 100.5 });
      room.state.players.set("player", player);
      for (let now = 10000; now <= 14500; now += 100) { vi.setSystemTime(now); tick(); }
      expect(mob.awarenessState).toBe("return"); expect(internal.mobAwareness.has("test")).toBe(false);
      expect({ x: mob.x, y: mob.y, z: mob.z }).toEqual({ x: 100.5, y: 1, z: 100.5 });
      expect(internal.mobUnreachableUntil.get("test")).toBe(20500);
      vi.setSystemTime(14600); tick(); expect(mob.awarenessState).toBe("patrol");
      internal.alertHitMob("test", "player", 14600);
      expect(internal.mobUnreachableUntil.has("test")).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it("publishes spotted and searching state without refreshing the alert every tick", () => {
    let covered = false;
    const { room, mob, tick } = fixture((x, y) => y <= 0 || (covered && x === 102 && y <= 3) ? Block.Stone : Block.Air);
    const player = new PlayerState(); Object.assign(player, { x: 106.5, y: 1, z: 100.5 });
    room.state.players.set("player", player); tick();
    expect(mob.awarenessState).toBe("engaged"); expect(mob.alertUntil).toBeGreaterThan(Date.now());
    const alert = mob.alertUntil; tick(); expect(mob.alertUntil).toBe(alert);
    covered = true; tick(); expect(mob.awarenessState).toBe("search");
  });
  it("publishes returning state only while actually returning toward home", () => {
    const { room, mob, tick } = fixture((_x, y) => y <= 0 ? Block.Stone : Block.Air);
    (room as any).mobHomes.set("test", { x: 100.5, y: 1, z: 100.5 });
    mob.x = 106.5; tick(); expect(mob.awarenessState).toBe("return"); expect(mob.x).toBeLessThan(106.5);
    mob.x = 100.5; tick(); expect(mob.awarenessState).toBe("patrol");
  });
  it("allows only two same-tick windups when a whole group reaches one player", () => {
    const { room, tick } = fixture((_x, y) => y <= 0 ? Block.Stone : Block.Air);
    room.state.mobs.clear();
    const player = new PlayerState(); Object.assign(player, { x: 100.5, y: 1, z: 100.5 });
    room.state.players.set("player", player);
    for (const [id, dx, dz] of [["a", 1.6, 0], ["b", -1.6, 0], ["c", 0, 1.6], ["d", 0, -1.6]] as const) {
      const mob = new MobState(); Object.assign(mob, { x: player.x + dx, y: 1, z: player.z + dz });
      room.state.mobs.set(id, mob);
    }
    tick();
    expect([...room.state.mobs.values()].filter(mob => mob.combatState === "windup")).toHaveLength(2);
    expect([...room.state.mobs.values()].filter(mob => mob.combatState === "idle")).toHaveLength(2);
    for (const mob of room.state.mobs.values()) expect(playerCollides((_x, y) => y <= 0 ? Block.Stone : Block.Air, mob.x, mob.y, mob.z)).toBe(false);
  });
  it("holds a third melee attacker back and releases its turn after interruption", () => {
    const { room, mob, tick } = fixture((_x, y) => y <= 0 ? Block.Stone : Block.Air);
    const player = new PlayerState(); Object.assign(player, { x: 101.9, y: 1, z: 100.5 });
    room.state.players.set("player", player);
    for (const id of ["a", "b"]) {
      const peer = new MobState(); Object.assign(peer, { x: 102, y: 1, z: id === "a" ? 99 : 102,
        combatState: "windup", targetId: "player", stateUntil: Date.now() + 60000 });
      room.state.mobs.set(id, peer);
    }
    tick(); expect(mob.combatState).toBe("idle");
    room.state.mobs.get("a")!.combatState = "stagger";
    tick(); expect(mob.combatState).toBe("windup");
    expect([...room.state.mobs.values()].filter(peer => peer.combatState === "windup")).toHaveLength(2);
  });
  it("allows a provoked roaming pack to respond beyond its passive territory corridor", () => {
    const { room, mob } = fixture((_x, y) => y <= 7 ? Block.Stone : Block.Air);
    const id = "outskirts-west-pack:0";
    room.state.mobs.delete("test"); room.state.mobs.set(id, mob);
    Object.assign(mob, { x: -22.5, y: 8, z: -2.5 });
    const player = new PlayerState(); Object.assign(player, { x: -30.5, y: 8, z: -2.5 });
    room.state.players.set("player", player);
    expect((room as any).roamingAllowed(id, player)).toBe(false);
    (room as any).alertHitMob(id, "player", Date.now());
    expect((room as any).roamingAllowed(id, player)).toBe(true);
    expect((room as any).roamingAllowed(id, { x: 8.5, y: 8, z: 8.5 })).toBe(false);
  });
  it("a ranged hit alerts the victim and starts pursuit outside passive aggro range", () => {
    const { room, mob, tick } = fixture((_x, y) => y <= 0 ? Block.Stone : Block.Air);
    const player = new PlayerState(); Object.assign(player, { x: 110.5, y: 1, z: 100.5 });
    room.state.players.set("player", player);
    (room as any).broadcast = () => {};
    (room as any).applyWeaponHit("player", { mainHandId: "bow", step: 1 }, "test", Date.now());
    const before = mob.x; tick();
    expect(mob.x).toBeGreaterThan(before);
  });
  it("detects players outside the safe zone even inside the mob spawn buffer", () => {
    const { room, mob, tick } = fixture((_x, y) => y <= 0 ? Block.Stone : Block.Air);
    Object.assign(mob, { x: 40, z: 8.5 });
    const player = new PlayerState(); Object.assign(player, { x: 35.5, y: 1, z: 8.5 });
    room.state.players.set("player", player); tick();
    expect(mob.x).toBeLessThan(40);
  });
  it("keeps other mobs from chasing or being pushed into the reserved brute arena", () => {
    const read: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
    const { room, mob, tick } = fixture(read);
    mob.x = 34.5; mob.z = 40.5;
    const player = new PlayerState(); player.x = 37.5; player.y = 1; player.z = 40.5;
    room.state.players.set("player", player); tick();
    expect(mob.combatState).toBe("idle");
    const internal = room as any;
    internal.displaceMob("test", mob, { x: 5, z: 0 });
    expect(isInStoneBruteArena(mob.x, mob.z)).toBe(false);
  });
  it("allows the designated brute to pursue inside its arena", () => {
    const read: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
    const { room, mob, tick } = fixture(read);
    room.state.mobs.delete("test"); room.state.mobs.set("stone-brute", mob);
    // Exercise the melee pursuit turn, rather than its new stationary ranged volley.
    Object.assign(mob, { ...STONE_BRUTE_ARENA_HOME, y: 1, archetype: "stone_brute", actionSequence: 1 });
    const player = new PlayerState(); player.x = mob.x + 5; player.y = 1; player.z = mob.z;
    room.state.players.set("player", player); const before = mob.x; tick();
    expect(mob.x).toBeGreaterThan(before);
  });
  it("uses obstacle routing when chasing a player in the room simulation", () => {
    let obstructed = false;
    const read: WorldBlockReader = (x, y, z) => y <= 0 || (obstructed && x === 102 && z >= 99 && z <= 101 && y <= 3) ? Block.Stone : Block.Air;
    const { room, mob, tick } = fixture(read);
    const player = new PlayerState();
    player.x = 106.5; player.y = 1; player.z = 100.5;
    room.state.players.set("player", player);
    tick(); // Acquire while visible, then follow last-seen information around new cover.
    obstructed = true;
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
