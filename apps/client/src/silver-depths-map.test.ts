import { describe, expect, it } from "vitest";
import { silverDepthsRoute } from "./silver-depths-map.js";

describe("Silver Depths route map", () => {
  it("guides through the seal, individual guards, boss, loot, and extraction", () => {
    expect(silverDepthsRoute(1, true, true)?.active).toBe("seal");
    expect(silverDepthsRoute(2, true, true)?.active).toBe("guard-a");
    expect(silverDepthsRoute(2, false, true)?.active).toBe("guard-b");
    expect(silverDepthsRoute(3, false, false)?.active).toBe("matriarch");
    expect(silverDepthsRoute(5, false, false)?.active).toBe("extraction");
  });
  it("marks each cleared encounter without marking unfinished ones", () => {
    const route = silverDepthsRoute(2, false, true)!;
    expect(route.completed.has("entrance")).toBe(true);
    expect(route.completed.has("seal")).toBe(true);
    expect(route.completed.has("guard-a")).toBe(true);
    expect(route.completed.has("guard-b")).toBe(false);
  });
});
