import type { Position } from "./action-rules.js";
export interface MobProgress { anchor: Position; since: number; sampledAt: number; retried: boolean }
/** Measure real displacement over active walking time, not animation or route intent. */
export function checkMobProgress(state: MobProgress | undefined, before: Position, after: Position, now: number, walking: boolean) {
  if (!walking) return { state: undefined, action: "none" as const };
  if (!state || now - state.sampledAt > 300 || now < state.sampledAt) {
    state = { anchor: { x: before.x, y: before.y, z: before.z }, since: now, sampledAt: now, retried: false };
  }
  state.sampledAt = now;
  if (Math.hypot(after.x - state.anchor.x, after.z - state.anchor.z) >= .15 || Math.abs(after.y - state.anchor.y) >= .5) {
    state = { anchor: { x: after.x, y: after.y, z: after.z }, since: now, sampledAt: now, retried: false };
  }
  const stalled = now - state.since;
  if (stalled >= 4500) return { state: undefined, action: "abandon" as const };
  if (stalled >= 1200 && !state.retried) {
    state.retried = true;
    return { state, action: "replan" as const };
  }
  return { state, action: "none" as const };
}
