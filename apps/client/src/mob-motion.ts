import { sampleRemotePose, type RemoteSnapshot, type SampledRemotePose } from "./movement-network.js";

/** Store this scalar between frames: an engine Euler Y is ambiguous past 90°. */
export function advanceMobYaw(current: number, target: number, dt: number): number {
  const elapsed = Math.max(0, Math.min(dt, 0.1));
  const angle = ((target - current) % 360 + 540) % 360 - 180;
  const turn = angle * (1 - Math.exp(-14 * elapsed));
  return current + Math.max(-360 * elapsed, Math.min(360 * elapsed, turn));
}

export function mobLocomotionSpeed(snapshots: readonly RemoteSnapshot[], moving: boolean): number {
  if (!moving || snapshots.length < 2) return 0;
  const last = snapshots[snapshots.length - 1]!;
  const previous = snapshots[snapshots.length - 2]!;
  if (Math.hypot(last.x - previous.x, last.z - previous.z) < 0.0001) return 0;
  const first = snapshots.find(sample => sample.receivedAt >= last.receivedAt - 180) ?? previous;
  const duration = last.receivedAt - first.receivedAt;
  return duration > 0 ? Math.min(2.2, Math.hypot(last.x - first.x, last.z - first.z) * 1000 / duration) : 0;
}

/** Never turn network catch-up into extra footsteps, or run in place while the
 * rendered mob is standing still. */
export function visibleMobGaitSpeed(authoritativeSpeed: number, visibleTravel: number, dt: number): number {
  if (dt <= 0 || authoritativeSpeed <= 0 || visibleTravel <= 0) return 0;
  return Math.min(authoritativeSpeed, visibleTravel / dt);
}

export function mobGaitTargets(kind: string, awareness: string, speed: number, windup: number, stagger: number, defeat: number) {
  const activity = (1 - Math.min(1, windup + stagger)) * (1 - defeat);
  const urgent = awareness === "engaged" || awareness === "search";
  const walking = Math.min(1, Math.max(0, speed) / (kind === "stone_brute" ? 0.85 : 1.4)) * activity;
  return {
    walking,
    pursuit: urgent ? activity : 0,
    cadence: Math.min(Math.max(0, speed), 6) * (kind === "stone_brute" ? 3.5 : kind === "cave_spitter" ? 6.5 : 8) * activity * (urgent ? 1.08 : 1),
  };
}

/** Art-only body follow-through; attack-facing remains authoritative. */
export function advanceMobTurnLean(previous: number, oldYaw: number, newYaw: number, dt: number, aimLocked: boolean): number {
  if (aimLocked) return 0;
  const elapsed = Math.max(0, Math.min(dt, 0.1));
  if (elapsed === 0) return previous;
  const delta = ((newYaw - oldYaw + 540) % 360) - 180;
  const target = Math.max(-1, Math.min(1, delta / (360 * elapsed)));
  return previous + (target - previous) * (1 - Math.exp(-14 * elapsed));
}

/** Bound packet catch-up independently from gait. Never use a correction as a footstep. */
export function advanceMobMotion(current: SampledRemotePose, previousGait: number,
  snapshots: readonly RemoteSnapshot[], now: number, dt: number, moving: boolean, impulse: boolean) {
  const target = sampleRemotePose(snapshots, now - 50, moving ? 180 : 0, 2.2) ?? current;
  const elapsed = Math.max(0, Math.min(dt, 0.1));
  const speed = mobLocomotionSpeed(snapshots, moving);
  const gaitSpeed = previousGait + (speed - previousGait) * (1 - Math.exp(-12 * elapsed));
  const dx = target.x - current.x; const dz = target.z - current.z;
  const distance = Math.hypot(dx, dz);
  if (distance > 2.5) return { pose: target, gaitSpeed: 0 };
  const alpha = 1 - Math.exp(-(impulse ? 35 : 24) * elapsed);
  const maximumTravel = (impulse ? 12 : Math.max(speed, gaitSpeed) + 1.2) * elapsed;
  const scale = distance > 0 ? Math.min(alpha, maximumTravel / distance) : 0;
  return { pose: { x: current.x + dx * scale, z: current.z + dz * scale,
    y: current.y + (target.y - current.y) * alpha, yaw: advanceMobYaw(current.yaw, target.yaw, elapsed) }, gaitSpeed };
}

export function trimMobSnapshots(snapshots: RemoteSnapshot[], now: number): void {
  while (snapshots.length > 2 && snapshots[1]!.receivedAt < now - 600) snapshots.shift();
  if (snapshots.length > 30) snapshots.splice(0, snapshots.length - 30);
}
