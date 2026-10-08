import { describe, expect, it } from "vitest";
import { Block, playerCollides, type WorldBlockReader } from "@blockcraft/voxel-world";
import { advanceMobGravity, createMobNavigationState, findMobPath, moveMobSafely, navigateMob, walkableMobSpawn } from "../src/mob-navigation.js";
import { pursueTarget } from "../src/combat-rules.js";
import { MobState } from "../src/schema.js";

const flat: WorldBlockReader = (_x, y, _z) => y <= 0 ? Block.Stone : Block.Air;
const wall: WorldBlockReader = (x, y, z) => x === 102 && z >= 99 && z <= 101 && y >= 1 && y <= 3 ? Block.Stone : flat(x, y, z);
const start = { x: 100.5, y: 1, z: 100.5 };

describe("terrain-aware mob navigation", () => {
  it("keeps a usable detour moving when the target crosses a cell before replanning is allowed", () => {
    const nearWall = { x: 101.7, y: 1, z: 100.5 };
    const state = createMobNavigationState();
    state.waypoints = [{ x: 101.7, y: 1, z: 102.5 }];
    state.goalKey = "105,1,100"; state.nextPlanAt = 750;
    const goal = { x: 106.5, y: 1, z: 100.5 };
    const next = navigateMob(nearWall, { x: 101.75, z: 100.5 }, goal, state, 100, wall);
    expect(next.z).toBeGreaterThan(nearWall.z);
    expect(state.waypoints.length).toBe(1);
  });
  it("does not periodically discard a valid route to a stationary target", () => {
    const state = createMobNavigationState();
    state.waypoints = [{ x: 101.7, y: 1, z: 102.5 }];
    state.goalKey = "105,1,100"; state.nextPlanAt = 750;
    const next = navigateMob({ x: 101.7, y: 1, z: 100.5 }, { x: 101.75, z: 100.5 },
      { x: 105.5, y: 1, z: 100.5 }, state, 800, wall);
    expect(next.z).toBeGreaterThan(100.5);
    expect(state.waypoints[0]?.z).toBe(102.5);
  });
  it("accepts live Colyseus schema poses without copying schema internals", () => {
    const mob = new MobState();
    mob.x = start.x; mob.y = start.y; mob.z = start.z;
    expect(moveMobSafely(mob, { x: 0.1, z: 0 }, flat)).toEqual({ x: 100.6, y: 1, z: 100.5 });
    expect(advanceMobGravity(mob, 0, 0.033, flat).y).toBe(1);
  });
  it("sweeps a long lunge instead of tunnelling through a wall", () => {
    const next = moveMobSafely(start, { x: 5, z: 0 }, wall);
    expect(next.x).toBeLessThan(102);
    expect(playerCollides(wall, next.x, next.y, next.z)).toBe(false);
  });
  it("steps onto a supported one-block ledge but not a two-block wall", () => {
    const ledge: WorldBlockReader = (x, y, z) => x >= 101 && y === 1 ? Block.Stone : flat(x, y, z);
    expect(moveMobSafely(start, { x: 1, z: 0 }, ledge).y).toBe(2);
    const tall: WorldBlockReader = (x, y, z) => x >= 101 && y >= 1 && y <= 2 ? Block.Stone : flat(x, y, z);
    expect(moveMobSafely(start, { x: 1, z: 0 }, tall).x).toBeLessThan(101);
  });
  it("does not step up into a low ceiling", () => {
    const low: WorldBlockReader = (x, y, z) => y === 3 || (x >= 101 && y === 1) ? Block.Stone : flat(x, y, z);
    const next = moveMobSafely(start, { x: 1, z: 0 }, low);
    expect(next.y).toBe(1);
    expect(next.x).toBeLessThan(101);
  });
  it("routes around a wall and reaches the target without entering solid blocks", () => {
    const goal = { x: 106.5, y: 1, z: 100.5 };
    const state = createMobNavigationState();
    let pose = { ...start };
    for (let i = 0; i < 240; i += 1) {
      pose = navigateMob(pose, pursueTarget(pose, goal, 0.05, 2, 0.3), goal, state, i * 50, wall);
      expect(playerCollides(wall, pose.x, pose.y, pose.z)).toBe(false);
    }
    expect(Math.hypot(pose.x - goal.x, pose.z - goal.z)).toBeLessThan(0.6);
  });
  it("returns home using the same obstacle route", () => {
    const goal = { ...start };
    let pose = { x: 106.5, y: 1, z: 100.5 };
    const state = createMobNavigationState();
    for (let i = 0; i < 240; i += 1) pose = navigateMob(pose, pursueTarget(pose, goal, 0.05, 2, 0.05), goal, state, i * 50, wall);
    expect(Math.hypot(pose.x - goal.x, pose.z - goal.z)).toBeLessThan(0.2);
  });
  it("rechecks cached routes against newly placed obstacles", () => {
    const state = createMobNavigationState();
    state.waypoints = [{ x: 101.5, y: 1, z: 100.5 }];
    state.goalKey = "103,1,100";
    state.nextPlanAt = 1000;
    const blocked: WorldBlockReader = (x, y, z) => x === 101 && y >= 1 && y <= 3 ? Block.Stone : flat(x, y, z);
    const pose = navigateMob(start, { x: 101.5, z: 100.5 }, { x: 103, y: 1, z: 100 }, state, 100, blocked);
    expect(playerCollides(blocked, pose.x, pose.y, pose.z)).toBe(false);
  });
  it("falls and lands when support is mined away, even without horizontal input", () => {
    const hole: WorldBlockReader = (x, y, z) => x === 100 && z === 100 ? y <= -3 ? Block.Stone : Block.Air : flat(x, y, z);
    let pose = { ...start, velocity: 0 };
    for (let i = 0; i < 100; i += 1) pose = advanceMobGravity(pose, pose.velocity, 0.033, hole);
    expect(pose.y).toBeCloseTo(-2, 1);
    expect(pose.velocity).toBe(0);
  });
  it("avoids deliberately navigating into a deep shaft", () => {
    const hole: WorldBlockReader = (x, y, z) => x === 101 && z === 100 ? y <= -5 ? Block.Stone : Block.Air : flat(x, y, z);
    const path = findMobPath(start, { x: 103.5, y: 1, z: 100.5 }, hole);
    expect(path.length).toBeGreaterThan(0);
    expect(path.some(pose => Math.floor(pose.x) === 101 && Math.floor(pose.z) === 100)).toBe(false);
  });
  it("walks down a one-block ledge and settles with gravity", () => {
    const ledge: WorldBlockReader = (x, y, z) => x < 101 && y === 1 ? Block.Stone : flat(x, y, z);
    let pose = { x: 100.5, y: 2, z: 100.5, velocity: 0 };
    const goal = { x: 103.5, y: 1, z: 100.5 };
    const state = createMobNavigationState();
    for (let i = 0; i < 100; i += 1) {
      pose = advanceMobGravity(pose, pose.velocity, 0.033, ledge);
      const next = navigateMob(pose, pursueTarget(pose, goal, 0.033, 2, 0.1), goal, state, i * 33, ledge);
      pose = { ...next, velocity: pose.velocity };
    }
    expect(pose.y).toBeCloseTo(1, 1);
    expect(pose.x).toBeGreaterThan(103);
  });
  it("respects the town boundary throughout a swept move and path search", () => {
    const allowed = (pose: { x: number }) => pose.x >= 100;
    expect(moveMobSafely(start, { x: -3, z: 0 }, flat, allowed).x).toBeGreaterThanOrEqual(100);
    expect(findMobPath(start, { x: 98, y: 1, z: 100 }, flat, allowed).every(pose => allowed(pose))).toBe(true);
  });
  it("finds a supported spawn outside a blocked home position", () => {
    const blocked: WorldBlockReader = (x, y, z) => x === 100 && z === 100 && y >= 1 && y <= 3 ? Block.Stone : flat(x, y, z);
    const spawn = walkableMobSpawn(start, blocked);
    expect(playerCollides(blocked, spawn.x, spawn.y, spawn.z)).toBe(false);
    expect(spawn.y).toBe(1);
  });
  it("throttles failed path searches rather than retrying every tick", () => {
    const blocked: WorldBlockReader = (x, y, z) => Math.abs(x - 100) === 1 || Math.abs(z - 100) === 1 ? Block.Stone : flat(x, y, z);
    const state = createMobNavigationState();
    const goal = { x: 105, y: 1, z: 100.5 };
    navigateMob(start, { x: 100.7, z: 100.5 }, goal, state, 0, blocked);
    const scheduled = state.nextPlanAt;
    navigateMob(start, { x: 100.7, z: 100.5 }, goal, state, 100, blocked);
    expect(state.nextPlanAt).toBe(scheduled);
  });
});
