export type MovementKeyCode = "KeyW" | "KeyA" | "KeyS" | "KeyD";

const MOVEMENT_KEYS = new Set<MovementKeyCode>(["KeyW", "KeyA", "KeyS", "KeyD"]);
const MOVEMENT_KEY_FALLBACKS: Record<string, MovementKeyCode> = {
  w: "KeyW",
  a: "KeyA",
  s: "KeyS",
  d: "KeyD",
};

export function normalizedMovementCode(code: string, key: string): MovementKeyCode | null {
  if (MOVEMENT_KEYS.has(code as MovementKeyCode)) return code as MovementKeyCode;
  return MOVEMENT_KEY_FALLBACKS[key.toLowerCase()] ?? null;
}

export function shouldCaptureMovementKey(code: string, key: string, editableTarget: boolean, editableTargetVisible: boolean): boolean {
  return normalizedMovementCode(code, key) !== null && (!editableTarget || !editableTargetVisible);
}
