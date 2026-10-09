import { afterEach, describe, expect, it, vi } from "vitest";
import { Block, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
import { createSpitterPositioning, positionSpitter } from "../src/spitter-positioning.js";
import { WorldRoom } from "../src/game-room.js";
import { MobState, PlayerState, WorldState } from "../src/schema.js";

const flat: WorldBlockReader = (_x, y) => y <= 0 ? Block.Stone : Block.Air;
const home = { x: 100.5, y: 1, z: 100.5 };
const target = { x: 102.5, y: 1, z: 100.5 };
const anywhere = () => true;
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("controlled spitter positioning", () => {
  it("takes a speed-limited step away and keeps its escape goal when the player circles", () => {
    const state = createSpitterPositioning();
    const first = positionSpitter(home, target, home, state, 10000, .1, 1.05, flat, anywhere);
    expect(first.x).toBeLessThan(home.x);
    expect(Math.hypot(first.x - home.x, first.z - home.z)).toBeCloseTo(.105);
    const goal = state.goal;
    positionSpitter(home, { ...target, x: 100.5, z: 102.5 }, home, state, 10100, .1, 1.05, flat, anywhere);
    expect(state.goal).toBe(goal);
  });
  it("ends each escape with a pause even if the player keeps closing", () => {
    const state = createSpitterPositioning();
    positionSpitter(home, target, home, state, 10000, .1, 1.05, flat, anywhere);
    const paused = positionSpitter(home, target, home, state, 11600, .1, 1.05, flat, anywhere);
    expect(state.goal).toBeNull(); expect(paused.x).toBe(home.x);
    expect(positionSpitter(home, target, home, state, 12600, .1, 1.05, flat, anywhere).retreating).toBe(false);
  });
  it("holds its ground across the old minimum-range boundary", () => {
    const state = createSpitterPositioning();
    for (const distance of [4.59, 4.61, 4.55, 4.65, 7.01, 6.99]) {
      const next = positionSpitter(home, { ...target, x: home.x + distance }, home, state, 10000, .1, 1.05, flat, anywhere);
      expect(next.x).toBe(home.x); expect(next.z).toBe(home.z);
    }
  });
  it("approaches only beyond 7.5 and settles at 6.6", () => {
    const state = createSpitterPositioning();
    expect(positionSpitter(home, { ...target, x: 109 }, home, state, 10000, .1, 1.05, flat, anywhere).x).toBeGreaterThan(home.x);
    positionSpitter(home, { ...target, x: 107 }, home, state, 10100, .1, 1.05, flat, anywhere);
    expect(state.approaching).toBe(false);
  });
  it("will not flee through walls, into shafts or past encounter boundaries", () => {
    const state = createSpitterPositioning();
    const next = positionSpitter(home, target, home, state, 10000, .1, 1.05, flat, () => false);
    expect(next.retreating).toBe(false);
    const shaft: WorldBlockReader = (x, y, z) => x === 100 && z === 100 && y <= 0 ? Block.Stone : Block.Air;
    const shaftState = createSpitterPositioning();
    positionSpitter(home, target, home, shaftState, 10000, .1, 1.05, shaft, anywhere);
    expect(shaftState.goal).toBeNull();
    const wall: WorldBlockReader = (x, y, z) => y <= 0 || (x < 100 || z < 100 || z > 100) && y <= 3 ? Block.Stone : Block.Air;
    expect(positionSpitter(home, target, home, createSpitterPositioning(), 10000, .1, 1.05, wall, anywhere).retreating).toBe(false);
  });
  it("does not kite beyond six blocks of its home", () => {
    const mob = { ...home, x: home.x - 5.9 };
    expect(positionSpitter(mob, { ...mob, x: mob.x + 2 }, home, createSpitterPositioning(), 10000, .1, 1.05, flat, anywhere).retreating).toBe(false);
  });
  it("caps a delayed simulation step and handles coincident positions", () => {
    const next = positionSpitter(home, home, home, createSpitterPositioning(), 10000, 1, 1.05, flat, anywhere);
    expect(Number.isFinite(next.yaw)).toBe(true);
    expect(Math.hypot(next.x - home.x, next.z - home.z)).toBeLessThanOrEqual(.106);
  });
  it("uses retreat in the authoritative room without moving during a committed shot", () => {
    vi.useFakeTimers(); vi.setSystemTime(10000);
    const room = new WorldRoom(); room.setState(new WorldState());
    Object.defineProperty(room, "readWorldBlock", { value: flat });
    vi.spyOn(room, "broadcast").mockImplementation(() => {});
    const mob = new MobState(); Object.assign(mob, home, { archetype: "cave_spitter" });
    const player = new PlayerState(); Object.assign(player, target);
    room.state.mobs.set("spitter", mob); room.state.players.set("player", player);
    const internal = room as any; internal.mobHomes.set("spitter", home);
    internal.simulatePlayers(.1);
    expect(internal.spitterPositioning.get("spitter")).toMatchObject({ goal: { x: 98.9 } });
    expect(mob.x).toBeLessThan(home.x); expect(playerCollides(flat, mob.x, mob.y, mob.z)).toBe(false);
    mob.combatState = "windup"; mob.targetId = "player"; mob.stateUntil = 12000;
    const before = { x: mob.x, z: mob.z };
    for (let i = 1; i <= 10; i++) { vi.setSystemTime(10000 + i * 100); internal.simulatePlayers(.1); }
    expect(mob.x).toBe(before.x); expect(mob.z).toBe(before.z);
  });
});
