import { describe, expect, it } from "vitest";
import { ashenChainRoute, ashenChainStage, greenwoodChainRoute, greenwoodChainStage, mistfenChainRoute, mistfenChainStage, northwatchChainRoute, northwatchChainStage, quarryChainRoute, quarryChainStage, regionalChainBreadcrumbs,
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

  it("joins every southern quarry discovery into one staged route", () => {
    expect(quarryChainStage("{}")).toBe("find-cart");
    expect(quarryChainStage(JSON.stringify({ roadsideClaims: ["southgate-cart"] }))).toBe("follow-to-survey");
    expect(quarryChainStage(JSON.stringify({ roadsideClaims: ["southgate-cart", "sunfall-survey"] }))).toBe("follow-to-winch");
    expect(quarryChainStage(JSON.stringify({ roadsideClaims: ["southgate-cart", "sunfall-survey", "broken-winch-camp"] }))).toBe("follow-to-lift");
    expect(quarryChainStage(JSON.stringify({ roadsideClaims: ["southgate-cart", "sunfall-survey", "broken-winch-camp", "collapsed-lift"] }))).toBe("follow-to-leader");
    expect(quarryChainStage(JSON.stringify({ roadsideClaims: ["southgate-cart", "sunfall-survey", "broken-winch-camp", "collapsed-lift"],
      quarry: { firstBossDefeated: true } }))).toBe("complete");
  });

  it("keeps the quarry route on authored road turns", () => {
    const route = quarryChainRoute("follow-to-lift")!;
    expect(route).toContainEqual({ x: 9, z: 69 });
    expect(route).toContainEqual({ x: 9, z: 88 });
    expect(regionalPolylineBreadcrumbs(route, 14)).toHaveLength(14);
    expect(regionalPolylineTrailVisible({ x: 9, y: 8, z: 77 }, route)).toBe(true);
  });

  it("opens Northwatch through its paired signals, patrol and watchpost", () => {
    expect(northwatchChainStage("{}")).toBe("find-cart");
    expect(northwatchChainStage(JSON.stringify({ roadsideClaims: ["northwatch-cart"] }))).toBe("follow-to-signals");
    expect(northwatchChainStage(JSON.stringify({ roadsideClaims: ["northwatch-cart", "windworn-shrine"] }))).toBe("clear-patrol");
    expect(northwatchChainStage(JSON.stringify({ roadsideClaims: ["northwatch-cart", "windworn-shrine", "northwatch-watchpost"] }))).toBe("follow-to-leader");
    expect(northwatchChainStage(JSON.stringify({ roadsideClaims: ["northwatch-cart", "windworn-shrine", "northwatch-watchpost"],
      northwatch: { clears: 1 } }))).toBe("complete");
  });

  it("routes Northwatch wind motes along the ridge road", () => {
    const route = northwatchChainRoute("follow-to-signals")!;
    expect(route).toContainEqual({ x: 9, z: -46 });
    expect(route).toContainEqual({ x: 9, z: -54 });
    expect(regionalPolylineTrailVisible({ x: 9, y: 8, z: -50 }, route)).toBe(true);
  });

  it("turns the Ashen landmarks into one first-clear journey", () => {
    expect(ashenChainStage("{}")).toBe("find-pilgrims");
    expect(ashenChainStage(JSON.stringify({ roadsideClaims: ["ashen-pilgrims"] }))).toBe("follow-to-shrine");
    expect(ashenChainStage(JSON.stringify({ roadsideClaims: ["ashen-pilgrims", "emberfall-shrine"] }))).toBe("follow-to-survey");
    expect(ashenChainStage(JSON.stringify({ roadsideClaims: ["ashen-pilgrims", "emberfall-shrine", "ashglass-survey"] }))).toBe("follow-to-camp");
    expect(ashenChainStage(JSON.stringify({ roadsideClaims: ["ashen-pilgrims", "emberfall-shrine", "ashglass-survey", "cindergrave-camp"] }))).toBe("clear-warpack");
    expect(ashenChainStage(JSON.stringify({ roadsideClaims: ["ashen-pilgrims", "emberfall-shrine", "ashglass-survey", "cindergrave-camp"],
      ashenBlueprints: ["cinderfang"] }))).toBe("complete");
  });

  it("takes the Ashen trail through the Scorched Gate and around the basin", () => {
    expect(ashenChainRoute("follow-to-shrine")).toContainEqual({ x: 93, z: 53 });
    const route = ashenChainRoute("follow-to-camp")!;
    expect(route).toContainEqual({ x: 103, z: 73 });
    expect(regionalPolylineTrailVisible({ x: 103, y: 8, z: 73 }, route)).toBe(true);
  });
});
