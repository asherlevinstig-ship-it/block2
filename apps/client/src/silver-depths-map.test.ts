import { describe, expect, it } from "vitest";
import { silverDepthsRoute } from "./silver-depths-map.js";

describe("Silver Depths route map", () => {
  it("guides through both gallery waves, checkpoint, boss, loot, and extraction", () => {
    expect(silverDepthsRoute(1, true, true)?.active).toBe("seal");
    expect(silverDepthsRoute(2)?.active).toBe("wave-one");
    expect(silverDepthsRoute(3)?.active).toBe("wave-two");
    expect(silverDepthsRoute(4)?.active).toBe("checkpoint");
    expect(silverDepthsRoute(5)?.active).toBe("matriarch");
    expect(silverDepthsRoute(7)?.active).toBe("extraction");
  });
  it("marks each cleared encounter without marking unfinished ones", () => {
    const route = silverDepthsRoute(3)!;
    expect(route.completed.has("entrance")).toBe(true);
    expect(route.completed.has("seal")).toBe(true);
    expect(route.completed.has("wave-one")).toBe(true);
    expect(route.completed.has("wave-two")).toBe(false);
  });
});
