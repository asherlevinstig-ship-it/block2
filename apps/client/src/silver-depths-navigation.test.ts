import { describe, expect, it } from "vitest";
import { CLOSED_DEPTHS_GATES, silverDepthsBreadcrumbPositions, silverDepthsMapRoute, silverDepthsWalkableCell } from "./silver-depths-navigation.js";

describe("Silver Depths gate-aware minimap route", () => {
  const entry = { x: 63.5, z: 12.5 };
  it("stops at the closed Moonstone seal, then passes through after it opens", () => {
    const target = { x: 94.5, z: 14.5 };
    const closed = silverDepthsMapRoute(entry, target, CLOSED_DEPTHS_GATES)!;
    expect(closed.reachesObjective).toBe(false);
    expect(closed.points.every(point => point.x < 82)).toBe(true);
    const open = silverDepthsMapRoute(entry, target, { ...CLOSED_DEPTHS_GATES, seal: true })!;
    expect(open.reachesObjective).toBe(true);
    expect(open.points.some(point => point.x >= 82.5)).toBe(true);
  });

  it("uses only the chosen wing opening and never crosses solid gate cells", () => {
    const fromGallery = { x: 94.5, z: 14.5 };
    const iron = { x: 103.5, z: -7.5 };
    const closed = silverDepthsMapRoute(fromGallery, iron, { ...CLOSED_DEPTHS_GATES, seal: true })!;
    expect(closed.reachesObjective).toBe(false);
    const gates = { ...CLOSED_DEPTHS_GATES, seal: true, iron: true };
    const open = silverDepthsMapRoute(fromGallery, iron, gates)!;
    expect(open.reachesObjective).toBe(true);
    expect(open.points.some(point => point.z < 3)).toBe(true);
    expect(silverDepthsWalkableCell(98, 3, gates)).toBe(true);
    expect(silverDepthsWalkableCell(90, 3, gates)).toBe(false);
    expect(silverDepthsWalkableCell(98, 26, gates)).toBe(false);
  });

  it("opens the gallery and boss routes only when those gates open", () => {
    const gallery = { x: 102.5, z: 14.5 };
    const checkpoint = { x: 112.5, z: 14.5 };
    const boss = { x: 131.5, z: 14.5 };
    const before = { ...CLOSED_DEPTHS_GATES, seal: true };
    expect(silverDepthsMapRoute(gallery, checkpoint, before)?.reachesObjective).toBe(false);
    const afterGallery = { ...before, gallery: true };
    expect(silverDepthsMapRoute(gallery, checkpoint, afterGallery)?.reachesObjective).toBe(true);
    expect(silverDepthsMapRoute(checkpoint, boss, afterGallery)?.reachesObjective).toBe(false);
    expect(silverDepthsMapRoute(checkpoint, boss, { ...afterGallery, boss: true })?.reachesObjective).toBe(true);
  });

  it("never routes through cover or outside authored rooms", () => {
    expect(silverDepthsWalkableCell(105, 13, { ...CLOSED_DEPTHS_GATES, seal: true })).toBe(false);
    expect(silverDepthsWalkableCell(75, -10, { ...CLOSED_DEPTHS_GATES, seal: true })).toBe(false);
    const route = silverDepthsMapRoute({ x: 102.5, z: 12.5 }, { x: 106.5, z: 14.5 }, CLOSED_DEPTHS_GATES)!;
    expect(route.reachesObjective).toBe(true);
    expect(route.points.every(point => silverDepthsWalkableCell(Math.floor(point.x), Math.floor(point.z), CLOSED_DEPTHS_GATES))).toBe(true);
  });
  it("places nearby world breadcrumbs along the route and never through a locked gate", () => {
    const player = { x: 94.5, z: 14.5 }, target = { x: 112.5, z: 14.5 };
    const locked = silverDepthsMapRoute(player, target, CLOSED_DEPTHS_GATES)!;
    const lockedCrystals = silverDepthsBreadcrumbPositions(player, locked, 12, 1.5);
    expect(lockedCrystals.length).toBeGreaterThan(0);
    expect(lockedCrystals.every(point => point.x < 108)).toBe(true);
    const openGates = { ...CLOSED_DEPTHS_GATES, gallery: true };
    const open = silverDepthsMapRoute(player, target, openGates)!;
    const openCrystals = silverDepthsBreadcrumbPositions(player, open, 12, 1.5);
    expect(openCrystals.some(point => point.x > 108)).toBe(true);
    expect(openCrystals.every(point => silverDepthsWalkableCell(Math.floor(point.x), Math.floor(point.z), openGates))).toBe(true);
  });
  it("keeps breadcrumbs close to the player and hides them at the endpoint", () => {
    const player = { x: 63.5, z: 12.5 };
    const longRoute = silverDepthsMapRoute(player, { x: 131.5, z: 14.5 },
      { seal: true, iron: true, silver: false, gallery: true, boss: true })!;
    const crystals = silverDepthsBreadcrumbPositions(player, longRoute);
    expect(crystals).toHaveLength(6);
    expect(Math.hypot(crystals[0]!.x - player.x, crystals[0]!.z - player.z)).toBeCloseTo(2.4);
    expect(silverDepthsBreadcrumbPositions({ x: 131.5, z: 14.5 },
      silverDepthsMapRoute({ x: 131.5, z: 14.5 }, { x: 131.5, z: 14.5 }, CLOSED_DEPTHS_GATES))).toEqual([]);
  });
});
