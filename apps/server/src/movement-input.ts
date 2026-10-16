import type { MoveRequest } from "@blockcraft/protocol";

// Bridge short delivery stalls without cancelling held movement every 200 ms.
// Explicit stop messages still stop immediately; disconnects retain a bounded
// half-second timeout instead of running indefinitely.
export const MOVEMENT_INPUT_TIMEOUT_MS = 500;
export const MOVEMENT_RATE_WINDOW_MS = 1_000;
export const MOVEMENT_RATE_LIMIT = 30;
export const MAX_STOP_POSITION_CORRECTION = 1.25;
const FREE_STOP_POSITION_CORRECTION = 0.45;

export interface StoredMovementInput {
  request: MoveRequest;
  receivedAt: number;
}

export interface MovementRateWindow {
  startedAt: number;
  count: number;
}

export const idleMovementInput = (sequence = 0, yaw = 0): MoveRequest => ({
  sequence,
  strafe: 0,
  forward: 0,
  yaw,
});

export function activeMovementInput(stored: StoredMovementInput | undefined, now: number, yaw = 0): MoveRequest {
  if (!stored || now - stored.receivedAt > MOVEMENT_INPUT_TIMEOUT_MS) {
    return idleMovementInput(stored?.request.sequence ?? 0, stored?.request.yaw ?? yaw);
  }
  return stored.request;
}

export function recordMovementMessage(
  window: MovementRateWindow | undefined,
  now: number,
): { window: MovementRateWindow; allowed: boolean } {
  const current = !window || now - window.startedAt >= MOVEMENT_RATE_WINDOW_MS
    ? { startedAt: now, count: 0 }
    : window;
  current.count += 1;
  return { window: current, allowed: current.count <= MOVEMENT_RATE_LIMIT };
}

export function requestedStopPosition(
  previous: StoredMovementInput | undefined,
  next: MoveRequest,
  authoritative: { x: number; y: number; z: number },
): { x: number; y: number; z: number } | null {
  if (!previous) return null;
  const previousMoving = Math.hypot(previous.request.strafe, previous.request.forward) > 0.01;
  const nextMoving = Math.hypot(next.strafe, next.forward) > 0.01;
  if (!previousMoving || nextMoving || next.stopX === undefined || next.stopY === undefined || next.stopZ === undefined) return null;
  const distance = Math.hypot(
    next.stopX - authoritative.x,
    next.stopY - authoritative.y,
    next.stopZ - authoritative.z,
  );
  if (distance > MAX_STOP_POSITION_CORRECTION) return null;
  if (distance > FREE_STOP_POSITION_CORRECTION) {
    // A delayed stop can reach the server after it has advanced several more
    // ticks on the last held input. Only rewind along that input; never allow a
    // larger sideways, upward, or forward client-proposed teleport.
    const speed = Math.hypot(previous.request.strafe, previous.request.forward);
    const directionX = previous.request.strafe / speed;
    const directionZ = previous.request.forward / speed;
    const aheadX = authoritative.x - next.stopX;
    const aheadZ = authoritative.z - next.stopZ;
    const forwardGap = aheadX * directionX + aheadZ * directionZ;
    const lateralGap = Math.abs(aheadX * directionZ - aheadZ * directionX);
    if (forwardGap <= 0 || lateralGap > 0.2 || Math.abs(next.stopY - authoritative.y) > 0.2) return null;
  }
  return { x: next.stopX, y: next.stopY, z: next.stopZ };
}

export function isExplicitStopTransition(previous: StoredMovementInput | undefined, next: MoveRequest): boolean {
  return Boolean(previous && Math.hypot(previous.request.strafe, previous.request.forward) > 0.01
    && Math.hypot(next.strafe, next.forward) <= 0.01);
}
