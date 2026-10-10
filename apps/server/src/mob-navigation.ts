import {
  GRAVITY, TERMINAL_VELOCITY, isPlayerSupported, playerCollides,
  resolvePlayerMotion, type WorldBlockReader,
} from "@blockcraft/voxel-world";
import type { Position } from "./action-rules.js";

export interface MobNavigationState {
  waypoints: Position[];
  goalKey: string;
  nextPlanAt: number;
  heading?: number;
}
export const createMobNavigationState = (): MobNavigationState => ({ waypoints: [], goalKey: "", nextPlanAt: 0 });
type AllowedPosition = (position: Position) => boolean;
const anywhere: AllowedPosition = () => true;
const horizontalDistance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.z - b.z);
const copyPose = (pose: Position): Position => ({ x: pose.x, y: pose.y, z: pose.z });
const hasSafeLanding = (pose: Position, read: WorldBlockReader): boolean => {
  if (isPlayerSupported(read, pose.x, pose.y, pose.z)) return true;
  const settled = resolvePlayerMotion(pose, { x: 0, y: -1, z: 0 }, read);
  return settled.grounded;
};

/** Shortcuts must check the entire corridor, not just the landing beyond a hole. */
export function safeMobCorridor(start: Position, goal: Position, read: WorldBlockReader, allowed = anywhere): boolean {
  const distance = horizontalDistance(start, goal);
  const steps = Math.max(1, Math.ceil(distance / .2));
  let pose = copyPose(start);
  for (let i = 1; i <= steps; i++) {
    const x = start.x + (goal.x - start.x) * i / steps;
    const z = start.z + (goal.z - start.z) * i / steps;
    const next = moveMobSafely(pose, { x: x - pose.x, z: z - pose.z }, read, allowed);
    if (Math.hypot(next.x - x, next.z - z) > .03 || !allowed(next) || !hasSafeLanding(next, read)) return false;
    const settled = resolvePlayerMotion(next, { x: 0, y: -1, z: 0 }, read);
    pose = settled.grounded ? copyPose(settled) : next;
  }
  return Math.abs(pose.y - goal.y) <= 1.05;
}

/** Sweep every displacement, including lunges, to avoid tunnelling through voxels. */
export function moveMobSafely(start: Position, delta: { x: number; z: number }, read: WorldBlockReader, allowed = anywhere): Position {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / 0.2));
  let position = copyPose(start);
  for (let i = 0; i < steps; i += 1) {
    const next = resolvePlayerMotion(position, { x: delta.x / steps, y: 0, z: delta.z / steps }, read);
    if (!allowed(next)) break;
    position = { x: next.x, y: next.y, z: next.z };
  }
  return position;
}

export function advanceMobGravity(start: Position, velocity: number, dt: number, read: WorldBlockReader): Position & { velocity: number } {
  const boundedDt = Math.max(0, Math.min(dt, 0.1));
  const grounded = isPlayerSupported(read, start.x, start.y, start.z);
  const nextVelocity = grounded && velocity <= 0 ? 0 : Math.max(-TERMINAL_VELOCITY, velocity - GRAVITY * boundedDt);
  const next = resolvePlayerMotion(copyPose(start), { x: 0, y: nextVelocity * boundedDt, z: 0 }, read);
  return { x: next.x, y: next.y, z: next.z, velocity: next.grounded || next.hitVertical ? 0 : nextVelocity };
}

function steerMob(start: Position, destination: Position, state: MobNavigationState,
  read: WorldBlockReader, allowed: AllowedPosition, smooth = true): Position {
  const distance = horizontalDistance(start, destination);
  const desiredHeading = Math.atan2(destination.x - start.x, destination.z - start.z);
  const oldHeading = state.heading ?? desiredHeading;
  const angle = ((desiredHeading - oldHeading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const heading = oldHeading + Math.min(Math.abs(angle), Math.max(.025, distance * 4)) * Math.sign(angle);
  const curved = { x: start.x + Math.sin(heading) * distance, y: start.y,
    z: start.z + Math.cos(heading) * distance };
  // Terrain wins over smoothing: never arc into a wall, shaft, or protected area.
  const endpoint = smooth && safeMobCorridor(start, curved, read, allowed) ? curved : destination;
  const next = moveMobSafely(start, { x: endpoint.x - start.x, z: endpoint.z - start.z }, read, allowed);
  if (horizontalDistance(start, next) > .00001) state.heading = Math.atan2(next.x - start.x, next.z - start.z);
  return next;
}

/** Local A*: at most 128 expansions within eight blocks. No world-wide scans. */
export function findMobPath(start: Position, goal: Position, read: WorldBlockReader, allowed = anywhere): Position[] {
  interface Node { pose: Position; cost: number; parent: Node | null }
  const key = (pose: Position) => `${Math.round(pose.x - start.x)},${Math.round(pose.z - start.z)},${Math.round(pose.y)}`;
  const first: Node = { pose: copyPose(start), cost: 0, parent: null };
  const open: Node[] = [first];
  const costs = new Map([[key(start), 0]]);
  let best = first;
  for (let expanded = 0; open.length && expanded < 128; expanded += 1) {
    open.sort((a, b) => a.cost + horizontalDistance(a.pose, goal) - b.cost - horizontalDistance(b.pose, goal));
    const node = open.shift()!;
    if (node.cost > (costs.get(key(node.pose)) ?? Infinity)) continue;
    if (horizontalDistance(node.pose, goal) < horizontalDistance(best.pose, goal)) best = node;
    if (horizontalDistance(node.pose, goal) < 0.8 && Math.abs(node.pose.y - goal.y) <= 1.1) { best = node; break; }
    for (const [x, z] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      let next = moveMobSafely(node.pose, { x, z }, read, allowed);
      if (Math.abs(next.x - node.pose.x - x) > 0.05 || Math.abs(next.z - node.pose.z - z) > 0.05) continue;
      // A route can descend one block, but should not deliberately lead into a shaft.
      if (!isPlayerSupported(read, next.x, next.y, next.z)) {
        const settled = resolvePlayerMotion(next, { x: 0, y: -1, z: 0 }, read);
        next = { x: settled.x, y: settled.y, z: settled.z };
      }
      if (!isPlayerSupported(read, next.x, next.y, next.z) || !allowed(next)
        || Math.abs(next.y - node.pose.y) > 1.05
        || Math.abs(next.x - start.x) > 8 || Math.abs(next.z - start.z) > 8) continue;
      const cost = node.cost + 1 + Math.abs(next.y - node.pose.y) * 0.25;
      if (cost >= (costs.get(key(next)) ?? Infinity)) continue;
      costs.set(key(next), cost);
      open.push({ pose: next, cost, parent: node });
    }
  }
  if (horizontalDistance(best.pose, goal) >= horizontalDistance(start, goal) - 0.25) return [];
  const path: Position[] = [];
  for (let node: Node | null = best; node?.parent; node = node.parent) path.unshift(node.pose);
  return path;
}

export function navigateMob(start: Position, desired: { x: number; z: number }, goal: Position,
  state: MobNavigationState, now: number, read: WorldBlockReader, allowed = anywhere): Position {
  const travel = Math.hypot(desired.x - start.x, desired.z - start.z);
  if (travel < 0.00001 || !isPlayerSupported(read, start.x, start.y, start.z)) return copyPose(start);
  const goalKey = `${Math.floor(goal.x)},${Math.floor(goal.y)},${Math.floor(goal.z)}`;
  // A moving target must not discard a usable detour and then wait for the
  // planner cooldown. Keep walking it until a replacement can be computed.
  state.goalKey = goalKey;
  while (state.waypoints[0] && horizontalDistance(start, state.waypoints[0]) < 0.12) state.waypoints.shift();
  if (!state.waypoints.length) {
    const direct = moveMobSafely(start, { x: desired.x - start.x, z: desired.z - start.z }, read, allowed);
    if (horizontalDistance(start, direct) >= travel * 0.8 && hasSafeLanding(direct, read)) {
      // Finish an arrival precisely instead of orbiting within the turn radius.
      return steerMob(start, direct, state, read, allowed, horizontalDistance(start, goal) > .6);
    }
    if (now < state.nextPlanAt) return copyPose(start);
    state.nextPlanAt = now + 250;
    state.waypoints = findMobPath(start, goal, read, allowed);
  }
  // Look ahead over nearby corners only. Existing collision/landing checks remain authoritative.
  for (let i = Math.min(3, state.waypoints.length - 1); i > 0; i--) {
    const candidate = state.waypoints[i]!;
    if (horizontalDistance(start, candidate) <= 2 && safeMobCorridor(start, candidate, read, allowed)) {
      state.waypoints.splice(0, i); break;
    }
  }
  const waypoint = state.waypoints[0];
  if (!waypoint) return copyPose(start);
  const distance = horizontalDistance(start, waypoint);
  const scale = Math.min(travel, distance) / Math.max(distance, 0.00001);
  const next = steerMob(start, { x: start.x + (waypoint.x - start.x) * scale, y: start.y,
    z: start.z + (waypoint.z - start.z) * scale }, state, read, allowed, distance > .35);
  if (horizontalDistance(start, next) < travel * 0.25 || !hasSafeLanding(next, read)) {
    state.waypoints = [];
    return copyPose(start);
  }
  return next;
}

/** Keep spawn/home points out of newly mined holes or solid tree trunks. */
export function walkableMobSpawn(spawn: Position, read: WorldBlockReader, allowed = anywhere): Position {
  for (let radius = 0; radius <= 4; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) for (let z = -radius; z <= radius; z += 1) {
      if (Math.max(Math.abs(x), Math.abs(z)) !== radius) continue;
      for (const y of [0, 1, -1]) {
        const candidate = { x: spawn.x + x, y: spawn.y + y, z: spawn.z + z };
        if (allowed(candidate) && !playerCollides(read, candidate.x, candidate.y, candidate.z)
          && isPlayerSupported(read, candidate.x, candidate.y, candidate.z)) return candidate;
      }
    }
  }
  return { ...spawn };
}
