import type { MoveRequest } from "@blockcraft/protocol";

export const MOVEMENT_INPUT_TIMEOUT_MS = 200;
export const MOVEMENT_RATE_WINDOW_MS = 1_000;
export const MOVEMENT_RATE_LIMIT = 30;

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
