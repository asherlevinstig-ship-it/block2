const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export function shouldCaptureMovementKey(code: string, editableTarget: boolean, editableTargetVisible: boolean): boolean {
  return MOVEMENT_KEYS.has(code) && (!editableTarget || !editableTargetVisible);
}
