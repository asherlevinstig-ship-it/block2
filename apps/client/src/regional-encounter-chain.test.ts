import { describe, expect, it } from "vitest";
import { greenwoodChainRoute, greenwoodChainStage, mistfenChainRoute, mistfenChainStage, regionalChainBreadcrumbs,
  regionalChainTrailVisible, regionalPolylineBreadcrumbs, regionalPolylineTrailVisible } from "./regional-encounter-chain.js";

describe("regional encounter chains", () => {
  it("advances Greenwood from discovery to camp to leader without a quest state", () => {
    expect(greenwoodChainStage("{}")).toBe("find-discovery");
    expect(greenwoodChainStage(JSON.stringify({ roadsideClaims: ["greenwood-forager-camp"] }))).toBe("follow-to-camp");
    expect(greenwoodChainStage(JSON.stringify({ roadsideClaims: ["greenwood-forager-camp", "greenwood-rootwatch-camp"] }))).toBe("follow-to-leader");
    expect(greenwoodChainStage(JSON.stringify({ roadsideClaims: ["greenwood-forager-camp", "greenwood-rootwatch-camp"],
      greenwood: { firstBossGearClaimed: true } }))).toBe("complete");
  });

  it("lays an organic physical trail only near a surface player", () => {
    const route = greenwoodChainRoute("follow-to-camp")!;
    const points = regionalChainBreadcrumbs(route, 9);
    expect(points).toHaveLength(9);
    expect(points[0]!.x).toBeGreaterThan(route.from.x);
    expect(points.at(-1)!.x).toBeLessThan(route.to.x);
    expect(regionalChainTrailVisible({ x: 35, y: 8, z: -2 }, route)).toBe(true);
    expect(regionalChainTrailVisible({ x: 35, y: 3, z: -2 }, route)).toBe(false);
    expect(regionalChainTrailVisible({ x: 4, y: 8, z: 40 }, route)).toBe(false);
  });

  it("advances Mistfen through the cart and shrine before exposing Mireback", () => {
    expect(mistfenChainStage("{}")).toBe("find-discovery");
    expect(mistfenChainStage(JSON.stringify({ roadsideClaims: ["mistfen-cart"] }))).toBe("follow-to-shrine");
    expect(mistfenChainStage(JSON.stringify({ roadsideClaims: ["mistfen-cart", "mistfen-shrine"] }))).toBe("follow-to-leader");
    expect(mistfenChainStage(JSON.stringify({ roadsideClaims: ["mistfen-cart", "mistfen-shrine"],
      mistfen: { firstBossDefeated: true } }))).toBe("complete");
  });

  it("routes Mistfen lanterns along the raised boardwalks", () => {
    const route = mistfenChainRoute("follow-to-leader")!;
    expect(route).toContainEqual({ x: -29.5, z: -26.5 });
    expect(route).toContainEqual({ x: -47.5, z: -26.5 });
    expect(regionalPolylineBreadcrumbs(route, 12)).toHaveLength(12);
    expect(regionalPolylineTrailVisible({ x: -35, y: 8, z: -26.5 }, route)).toBe(true);
    expect(regionalPolylineTrailVisible({ x: 20, y: 8, z: 20 }, route)).toBe(false);
  });
});
