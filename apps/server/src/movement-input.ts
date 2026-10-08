import type { MoveRequest } from "@blockcraft/protocol";

// Bridge short delivery stalls without cancelling held movement every 200 ms.
// Explicit stop messages still stop immediately; disconnects retain a bounded
// half-second timeout instead of running indefinitely.
export const MOVEMENT_INPUT_TIMEOUT_MS = 500;
export const MOVEMENT_RATE_WINDOW_MS = 1_000;
export const MOVEMENT_RATE_LIMIT = 30;
export const MAX_STOP_POSITION_CORRECTION = 0.45;

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
  return { x: next.stopX, y: next.stopY, z: next.stopZ };
}
