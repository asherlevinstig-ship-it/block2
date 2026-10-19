import { describe, expect, it } from "vitest";
import { greenwoodChainRoute, greenwoodChainStage, regionalChainBreadcrumbs, regionalChainTrailVisible } from "./regional-encounter-chain.js";

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
});
