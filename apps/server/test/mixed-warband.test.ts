import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, playerCollides } from "@blockcraft/voxel-world";
import { WorldRoom } from "../src/game-room.js";
import { PlayerState, WorldState } from "../src/schema.js";
import { ATTACK_START_GAP_MS, ATTACK_RELEASE_GAP_MS } from "../src/attack-coordination.js";
import { MIXED_FRONTIER_IDS, MIXED_FRONTIER_SPITTER, mixedFrontierAllows } from "../src/wilderness-encounters.js";
import { isMixedWarbandLeader, warbandCrawlerYaw, warbandCrossfireSite, warbandFormationState } from "../src/mixed-warband.js";
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("mixed frontier warband", () => {
  it("assigns opposite fixed flank and crossfire lanes without dynamic scaling", () => {
    expect(isMixedWarbandLeader("frontier-brute-east")).toBe(true);
    expect(isMixedWarbandLeader("wild-crawler")).toBe(false);
    expect(warbandCrawlerYaw(0, 0)).toBe(38);
    expect(warbandCrossfireSite({ x: 0, y: 8, z: 0 }, 0, 0).x).toBeCloseTo(-2.8);
    expect(warbandFormationState(true, true)).toBe("full");
    expect(warbandFormationState(true, false)).toBe("pin");
    expect(warbandFormationState(false, true)).toBe("crossfire");
  });
  it("places only one support spitter alongside existing crawler and brute, on walkable frontier ground", () => {
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    internal.registerMob("frontier-crawler", "moss_crawler", { x: 63.5, y: 8, z: 35.5 });
    internal.registerMob("frontier-brute-east", "stone_brute", { x: 70.5, y: 8, z: 32.5 });
    internal.registerMob("frontier-support-spitter", "cave_spitter", MIXED_FRONTIER_SPITTER);
    expect(room.state.mobs.size).toBe(3);
    for (const id of MIXED_FRONTIER_IDS) {
      const mob = room.state.mobs.get(id)!;
      expect(mixedFrontierAllows(mob)).toBe(true);
      expect(playerCollides(internal.readWorldBlock, mob.x, mob.y, mob.z)).toBe(false);
    }
    expect(mixedFrontierAllows({ x: 8.5, y: 8, z: 8.5 })).toBe(false);
    expect(mixedFrontierAllows({ ...MIXED_FRONTIER_SPITTER, y: 2 })).toBe(false);
  });
  it("lets all three roles attack over time without simultaneous starts or release pileups", () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y < 8 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    internal.registerMob("frontier-crawler", "moss_crawler", { x: 65.5, y: 8, z: 34.5 });
    internal.registerMob("frontier-support-spitter", "cave_spitter", { x: 66.5, y: 8, z: 40.5 });
    internal.registerMob("frontier-brute-east", "stone_brute", { x: 72.5, y: 8, z: 34.5 });
    const player = new PlayerState(); Object.assign(player, { x: 67.5, y: 8, z: 34.5, health: 10000, maxHealth: 10000 });
    room.state.players.set("p", player);
    const last = new Map<string, number>(), starts: { id: string; at: number; release: number }[] = [];
    for (let now = 10_000; now < 28_000; now += 33) {
      vi.setSystemTime(now); internal.simulatePlayers(.033);
      const peers = [...room.state.mobs.values()];
      for (let a = 0; a < peers.length; a++) for (let b = a + 1; b < peers.length; b++) {
        const left = peers[a]!, right = peers[b]!;
        const minimum = left.archetype === "stone_brute" || right.archetype === "stone_brute" ? 1.15 : .75;
        expect(Math.hypot(left.x - right.x, left.z - right.z)).toBeGreaterThanOrEqual(minimum - .01);
      }
      for (const [id, mob] of room.state.mobs) {
        if (mob.combatState !== "windup" || last.get(id) === mob.attackStartedAt) continue;
        starts.push({ id, at: mob.attackStartedAt, release: mob.attackReleaseAt }); last.set(id, mob.attackStartedAt);
      }
    }
    expect(new Set(starts.map(start => start.id)).size).toBe(3);
    expect(starts.length).toBeGreaterThan(6);
    for (let i = 1; i < starts.length; i++) expect(starts[i]!.at - starts[i - 1]!.at).toBeGreaterThanOrEqual(ATTACK_START_GAP_MS);
    const releases = starts.map(start => start.release).sort((a, b) => a - b);
    for (let i = 1; i < releases.length; i++) expect(releases[i]! - releases[i - 1]!).toBeGreaterThanOrEqual(ATTACK_RELEASE_GAP_MS);
  });

  it("turns a leader charge into centre pressure, a crawler pin and opposite-side crossfire", () => {
    vi.useFakeTimers(); vi.setSystemTime(10_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any; const events: { type: string; payload: any }[] = [];
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y < 8 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation((type, payload) => { events.push({ type, payload }); });
    internal.registerMob("frontier-crawler", "moss_crawler", { x: 65.5, y: 8, z: 34.5 });
    internal.registerMob("frontier-support-spitter", "cave_spitter", { x: 66.5, y: 8, z: 40.5 });
    internal.registerMob("frontier-brute-east", "stone_brute", { x: 72.5, y: 8, z: 34.5 });
    const leader = room.state.mobs.get("frontier-brute-east")!;
    Object.assign(leader, { attackPattern: "charge", combatState: "strike", actionSequence: 2, alive: true });
    internal.launchMixedWarbandPush("frontier-brute-east", leader, "p",
      { x: 68.5, y: 8, z: 34.5, yaw: 0 }, 10_000);
    expect(internal.crawlerRushes.get("frontier-crawler").yaw).toBe(38);
    expect(internal.pendingMobMelee.has("frontier-crawler")).toBe(true);
    const crossfire = [...internal.pendingMobProjectiles.values()].filter((shot: any) => shot.mobId === "frontier-support-spitter");
    expect(crossfire).toHaveLength(1);
    expect(crossfire[0].hazardDurationMs).toBe(2_500);
    expect(events).toContainEqual({ type: "leader:formation",
      payload: expect.objectContaining({ mobId: "frontier-brute-east", state: "full" }) });
    const crawler = room.state.mobs.get("frontier-crawler")!;
    internal.staggerMob("frontier-crawler", crawler, 10_100, 800, true);
    expect(events).toContainEqual({ type: "leader:formation",
      payload: { mobId: "frontier-brute-east", state: "broken", tactic: "breach", durationMs: 2_500 } });
    expect(leader.combatState).toBe("recover");
    expect(internal.warbandDisrupted.has("frontier-brute-east")).toBe(true);
  });

  it("warns during the wind-up and exposes the brute when a role is interrupted", () => {
    vi.useFakeTimers(); vi.setSystemTime(20_000);
    const room = new WorldRoom(); room.setState(new WorldState());
    const internal = room as any; const events: { type: string; payload: any }[] = [];
    vi.spyOn(room, "broadcast").mockImplementation((type, payload) => { events.push({ type, payload }); });
    internal.registerMob("frontier-crawler", "moss_crawler", { x: 65.5, y: 8, z: 34.5 });
    internal.registerMob("frontier-support-spitter", "cave_spitter", { x: 66.5, y: 8, z: 40.5 });
    internal.registerMob("frontier-brute-east", "stone_brute", { x: 72.5, y: 8, z: 34.5 });
    const leader = room.state.mobs.get("frontier-brute-east")!;
    Object.assign(leader, { attackPattern: "charge", combatState: "windup", stateUntil: 21_000, alive: true });
    internal.prepareMixedWarbandPush("frontier-brute-east", leader, 20_000, 1_000);
    expect(events).toContainEqual({ type: "leader:formation", payload: {
      mobId: "frontier-brute-east", state: "forming", tactic: "breach", durationMs: 1_000 } });
    internal.staggerMob("frontier-crawler", room.state.mobs.get("frontier-crawler")!, 20_200, 600, true);
    expect(leader.combatState).toBe("recover");
    expect(leader.stateUntil).toBeGreaterThanOrEqual(22_700);
  });
});
