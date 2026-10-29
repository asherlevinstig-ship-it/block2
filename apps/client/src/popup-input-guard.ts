export type PopupInputGuard = { readyAt: number; pointerId: number | null };
export type PopupInputEvent = { type: "pointerdown" | "pointerup" | "pointercancel" | "click";
  now: number; pointerId?: number; clickDetail?: number };

export function createPopupInputGuard(now: number, delayMs: number): PopupInputGuard {
  return { readyAt: now + delayMs, pointerId: null };
}

/** A modal opened during combat requires a fresh press after its safety delay. */
export function popupInputBlocked(guard: PopupInputGuard, event: PopupInputEvent): boolean {
  const early = event.now < guard.readyAt;
  if (event.type === "pointerdown" && !early) {
    guard.pointerId = event.pointerId ?? 0;
    return false;
  }
  if (event.type === "pointercancel") guard.pointerId = null;
  const clickWithoutFreshPress = event.type === "click" && (event.clickDetail ?? 0) > 0 && guard.pointerId === null;
  if (!early && !clickWithoutFreshPress) {
    if (event.type === "click") guard.pointerId = null;
    return false;
  }
  return true;
}
