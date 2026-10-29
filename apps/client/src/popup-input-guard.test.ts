import { describe, expect, it } from "vitest";
import { createPopupInputGuard, popupInputBlocked } from "./popup-input-guard.js";

describe("choice popup input guard", () => {
  it("blocks combat clicks during the opening delay", () => {
    const guard = createPopupInputGuard(1_000, 900);
    expect(popupInputBlocked(guard, { type: "pointerdown", now: 1_100, pointerId: 4 })).toBe(true);
    expect(popupInputBlocked(guard, { type: "click", now: 1_120, clickDetail: 1 })).toBe(true);
  });

  it("rejects release-click from a button held before the popup appeared", () => {
    const guard = createPopupInputGuard(1_000, 900);
    expect(popupInputBlocked(guard, { type: "pointerup", now: 2_000, pointerId: 4 })).toBe(false);
    expect(popupInputBlocked(guard, { type: "click", now: 2_001, clickDetail: 1 })).toBe(true);
  });

  it("accepts one deliberate fresh press after the delay", () => {
    const guard = createPopupInputGuard(1_000, 900);
    expect(popupInputBlocked(guard, { type: "pointerdown", now: 2_000, pointerId: 7 })).toBe(false);
    expect(popupInputBlocked(guard, { type: "pointerup", now: 2_020, pointerId: 7 })).toBe(false);
    expect(popupInputBlocked(guard, { type: "click", now: 2_021, clickDetail: 1 })).toBe(false);
    expect(guard.pointerId).toBeNull();
  });

  it("allows deliberate keyboard activation after the delay", () => {
    const guard = createPopupInputGuard(1_000, 900);
    expect(popupInputBlocked(guard, { type: "click", now: 2_000, clickDetail: 0 })).toBe(false);
  });
});
