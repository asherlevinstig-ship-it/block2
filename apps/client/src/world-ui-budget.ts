export const WORLD_UI_SLICE_INTERVAL_MS = 50;
export const WORLD_UI_SLICE_COUNT = 2;

export type WorldUiSchedule = { lastAt: number; current: number; due: number };

/** Spread non-critical world UI work across frames instead of updating every
 * route, map state and nameplate in the same animation frame. */
export function advanceWorldUiSchedule(now: number, lastAt: number, current: number): WorldUiSchedule {
  if (now - lastAt < WORLD_UI_SLICE_INTERVAL_MS) return { lastAt, current, due: -1 };
  const next = (current + 1) % WORLD_UI_SLICE_COUNT;
  return { lastAt: now, current: next, due: next };
}
