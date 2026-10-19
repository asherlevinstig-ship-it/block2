import { describe, expect, it } from "vitest";
import { discoveryBreadcrumbs, discoverySignalKind } from "./discovery-signals.js";

describe("world discovery signals", () => {
  it("gives each landmark family a distinct distant silhouette", () => {
    expect(discoverySignalKind("camp")).toBe("smoke");
    expect(discoverySignalKind("shrine")).toBe("beacon");
    expect(discoverySignalKind("ruin")).toBe("omens");
    expect(discoverySignalKind("cart")).toBe("glint");
    expect(discoverySignalKind("camp", "trail")).toBe("trail");
    expect(discoverySignalKind("camp", "hunt")).toBe("trail");
    expect(discoverySignalKind("ruin", "cache")).toBe("glint");
  });

  it("lays a staggered physical trail between the clue and its hidden stash", () => {
    const marks = discoveryBreadcrumbs(10, 20, -6, 2);
    expect(marks).toHaveLength(4);
    expect(marks[0]!.x).toBeLessThan(10);
    expect(marks.at(-1)!.x).toBeGreaterThan(4);
    expect(new Set(marks.map(mark => mark.yaw))).toHaveLength(2);
    expect(discoveryBreadcrumbs(0, 0, 0, 0)).toEqual([]);
  });
});

