import { describe, expect, it } from "vitest";
import { WildernessEventCycle } from "./wilderness-event.js";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";
import { Block } from "@blockcraft/voxel-world";
import { vi } from "vitest";
import { nearbyObjective } from "./world-objectives.js";
import { MATRIARCH_PHASE, matriarchEnraged, matriarchPattern, spitterShotEndpoints } from "@blockcraft/protocol";
describe("shared wilderness event", () => {
  it("enrages strictly below half health and alternates aimed shots with double fans", () => {
    expect(matriarchEnraged(12, 24)).toBe(false);
    expect(matriarchEnraged(11, 24)).toBe(true);
    expect(matriarchPattern(0, true)).toBe("aimed");
    expect(matriarchPattern(1, true)).toBe("double-fan");
    expect(matriarchPattern(1, false)).toBe("fan");
    expect(spitterShotEndpoints({ x: 0, y: 8, z: 0 }, 0, "double-fan")).toHaveLength(4);
  });
  it("releases the second volley only when due, from the committed origin, and gives longer recovery", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    internal.registerMob("greenwood-venom-matriarch", "cave_spitter", { x: 43, y: 8, z: 18 });
    const mob = room.state.mobs.get("greenwood-venom-matriarch")!;
    Object.assign(mob, { isChampion: true, enraged: true, attackPattern: "double-fan", combatState: "recover" });
    internal.setMobAttackTimeline(mob, 1000, 2400, "greenwood-venom-matriarch");
    expect(mob.attackContactEndAt).toBe(2900);
    expect(mob.attackRecoveryEndAt).toBe(5500);
    const origin = { x: 43, y: 8, z: 18 }, shots = spitterShotEndpoints(origin, 0, "double-fan");
    internal.delayedMatriarchVolleys.set("greenwood-venom-matriarch", { origin, shots, releaseAt: 2900, damage: 1, travelMs: 1250 });
    internal.resolveMobProjectiles(2899); expect(room.broadcast).not.toHaveBeenCalled();
    mob.x = 45;
    internal.resolveMobProjectiles(2900); expect(room.broadcast).toHaveBeenCalledTimes(4);
    expect((room.broadcast as any).mock.calls[0][1].x).toBe(43);
    expect((room.broadcast as any).mock.calls[0][1].releasedAt).toBe(2900);
    internal.resolveMobProjectiles(2901); expect(room.broadcast).toHaveBeenCalledTimes(4);
    internal.delayedMatriarchVolleys.set("greenwood-venom-matriarch", { origin, shots, releaseAt: 3000, damage: 1, travelMs: 1250 });
    mob.alive = false; internal.resolveMobProjectiles(3000);
    expect(internal.delayedMatriarchVolleys.size).toBe(0);
    expect(MATRIARCH_PHASE.recoveryMs).toBeGreaterThan(1900);
  });
  const clear = (cycle: WildernessEventCycle, now: number, active = false) => {
    cycle.record("wild-crawler", now, active);
    cycle.record("greenwood-briar", now, active);
    return cycle.record("greenwood-briar-north", now, active);
  };
  it("arms once and gives eight seconds of warning", () => {
    const cycle = new WildernessEventCycle();
    expect(clear(cycle, 10000)).toBe(true);
    expect(clear(cycle, 10001)).toBe(false);
    expect(cycle.release(17999)).toBe(false);
    expect(cycle.release(18000)).toBe(true);
    expect(cycle.release(18001)).toBe(false);
  });
  it("requires a fresh full clear", () => {
    const cycle = new WildernessEventCycle();
    cycle.record("wild-crawler", 1000, false);
    cycle.record("greenwood-briar", 1000, false);
    expect(cycle.record("greenwood-briar-north", 62000, false)).toBe(false);
  });
  it("blocks duplicates while active and during cooldown", () => {
    const cycle = new WildernessEventCycle();
    expect(clear(cycle, 1000, true)).toBe(false);
    expect(clear(cycle, 1000)).toBe(true);
    cycle.release(9000);
    expect(clear(cycle, 10000)).toBe(false);
    expect(clear(cycle, 121000)).toBe(true);
  });
  it("shows the local arrival countdown, not a distant event", () => {
    const player = { x: 43, y: 8, z: 18, health: 5, inventory: new Map() };
    expect(nearbyObjective("a", player, [], [], [], 1000, null, 9000).title).toContain("8s");
    expect(nearbyObjective("a", { ...player, x: 90 }, [], [], [], 1000, null, 9000).objectiveId).toBe("explore");
  });
  it("spawns once after a real camp clear and grants each contributor their own equipment", () => {
    const room = new WorldRoom(); room.setState(new WorldState()); const internal = room as any;
    Object.defineProperty(room, "readWorldBlock", { value: (_x: number, y: number) => y <= 7 ? Block.Stone : Block.Air });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    vi.spyOn(internal, "persistPlayer").mockResolvedValue(undefined);
    for (const id of ["a", "b"]) { const player = new PlayerState(); Object.assign(player, { x: 43, y: 8, z: 18 }); room.state.players.set(id, player); }
    for (const id of ["wild-crawler", "greenwood-briar", "greenwood-briar-north"]) {
      internal.registerMob(id, "moss_crawler", { x: 43, y: 8, z: 18 });
      internal.defeatMob(id, room.state.mobs.get(id), "a", 1000);
    }
    internal.advanceWildernessEvent(8999);
    expect(room.state.mobs.has("greenwood-venom-matriarch")).toBe(false);
    internal.advanceWildernessEvent(9000);
    const boss = room.state.mobs.get("greenwood-venom-matriarch")!;
    expect(boss.maxHealth).toBe(24); expect(boss.isChampion).toBe(true);
    internal.advanceWildernessEvent(10000);
    expect(room.state.mobs.get("greenwood-venom-matriarch")).toBe(boss);
    for (const id of ["a", "b"]) internal.combatContributions.record("greenwood-venom-matriarch", id, 12, 10000);
    internal.defeatMob("greenwood-venom-matriarch", boss, "a", 10000);
    const drops = [...room.state.lootDrops.values()].filter(drop => drop.itemId === "venom_focus");
    expect(drops.map(drop => drop.ownerId).sort()).toEqual(["a", "b"]);
  });
});
