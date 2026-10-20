import { describe, expect, it } from "vitest";
import { WORLD_UI_SLICE_INTERVAL_MS, advanceWorldUiSchedule } from "./world-ui-budget.js";

describe("world UI frame budget", () => {
  it("alternates regional and map UI work at a bounded cadence", () => {
    const first = advanceWorldUiSchedule(1_000, -Infinity, -1);
    expect(first).toEqual({ lastAt: 1_000, current: 0, due: 0 });
    expect(advanceWorldUiSchedule(1_000 + WORLD_UI_SLICE_INTERVAL_MS - 1, first.lastAt, first.current).due).toBe(-1);
    const second = advanceWorldUiSchedule(1_000 + WORLD_UI_SLICE_INTERVAL_MS, first.lastAt, first.current);
    expect(second).toEqual({ lastAt: 1_000 + WORLD_UI_SLICE_INTERVAL_MS, current: 1, due: 1 });
  });
});
