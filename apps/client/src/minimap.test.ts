import { describe, expect, it } from "vitest";
import { mineralStatusLabel } from "./minimap.js";
import { HOME_WAYPOINT, MAP_DEPOSITS, MAP_SIZE, DISCOVERY_RADIUS, depositKey, discoverDeposits, knownWaypoints, mapPoint, mapFacing, parseDiscoveries, waypointAtMapPoint, waypointDirection } from "./minimap.js";

describe("north-up explorer minimap", () => {
  it("labels available, recovering and occupied deposits", () => {
    expect(mineralStatusLabel({ id: "35,-5", available: 2, total: 18, readyAt: 5000 }, 1000)).toBe("Available · 2/18");
    expect(mineralStatusLabel({ id: "35,-5", available: 0, total: 18, readyAt: 5000 }, 1000)).toBe("Recovering · 4s");
    expect(mineralStatusLabel({ id: "35,-5", available: 0, total: 18, readyAt: 5000 }, 6000)).toContain("waiting for space");
    expect(mineralStatusLabel(undefined, 1000)).toBe("Unknown");
  });
  it("never exposes or selects undiscovered deposits", () => {
    const discovered = new Set<string>();
    expect(knownWaypoints(discovered).map(target => target.id)).toEqual(["home", "smith"]);
    const deposit = MAP_DEPOSITS[0]!;
    const player = { x: deposit.x, z: deposit.z };
    expect(waypointAtMapPoint(player, MAP_SIZE / 2, MAP_SIZE / 2, discovered)).toBeNull();
    discovered.add(depositKey(deposit));
    expect(waypointAtMapPoint(player, MAP_SIZE / 2, MAP_SIZE / 2, discovered)?.id).toBe(depositKey(deposit));
    expect(knownWaypoints(discovered)).toHaveLength(3);
  });
  it("selects known markers on the edge and ignores empty map clicks", () => {
    const player = { x: 200, z: 200 };
    const p = mapPoint(player, HOME_WAYPOINT);
    expect(waypointAtMapPoint(player, p.x, p.y, new Set())?.id).toBe("home");
    expect(waypointAtMapPoint(player, 200, 200, new Set())).toBeNull();
  });
  it("uses a camera-relative guide without changing the north-up map", () => {
    const player = { x: 0, y: 8, z: 0 };
    const target = { ...HOME_WAYPOINT, x: 0, z: -10 };
    const north = waypointDirection(player, target, Math.PI / 2);
    expect(north.angle).toBeCloseTo(0); expect(north.distance).toBe(10);
    expect(north.arrived).toBe(false);
    expect(waypointDirection(player, target, 0).angle).toBeCloseTo(90);
  });
  it("arrives only near the waypoint on its floor, not directly underneath it", () => {
    expect(waypointDirection({ ...HOME_WAYPOINT, x: HOME_WAYPOINT.x + 2 }, HOME_WAYPOINT, 0).arrived).toBe(true);
    expect(waypointDirection({ ...HOME_WAYPOINT, y: 3 }, HOME_WAYPOINT, 0).arrived).toBe(false);
    expect(waypointDirection({ ...HOME_WAYPOINT, x: HOME_WAYPOINT.x + 3 }, HOME_WAYPOINT, 0).arrived).toBe(false);
  });
  it("centres the player and preserves world directions regardless of camera rotation", () => {
    const player = { x: 8.5, z: 8.5 };
    expect(mapPoint(player, player)).toEqual({ x: MAP_SIZE / 2, y: MAP_SIZE / 2, offscreen: false });
    expect(mapPoint(player, { x: 18.5, z: 8.5 }).x).toBeGreaterThan(MAP_SIZE / 2);
    expect(mapPoint(player, { x: 8.5, z: -1.5 }).y).toBeLessThan(MAP_SIZE / 2);
    expect(mapFacing(0).y).toBeCloseTo(1);
    expect(mapFacing(90).x).toBeCloseTo(1);
    expect(mapFacing(180).y).toBeCloseTo(-1);
    expect(mapFacing(-90).x).toBeCloseTo(-1);
    expect(mapFacing(450).x).toBeCloseTo(mapFacing(90).x);
  });
  it("keeps distant town markers on the map edge without reversing their bearing", () => {
    const point = mapPoint({ x: 200, z: 200 }, { x: 8.5, z: 8.5 });
    expect(point.offscreen).toBe(true);
    expect(point.x).toBe(14); expect(point.y).toBe(14);
  });
  it("reveals deposits only nearby at surface height and remembers them after departure", () => {
    const discovered = new Set<string>();
    expect(discoverDeposits({ x: 8.5, y: 8, z: 8.5 }, discovered)).toBe(false);
    const deposit = MAP_DEPOSITS[0]!;
    expect(discoverDeposits({ x: deposit.x, y: 3, z: deposit.z }, discovered)).toBe(false);
    expect(discoverDeposits({ x: deposit.x + DISCOVERY_RADIUS + 0.1, y: 8, z: deposit.z }, discovered)).toBe(false);
    expect(discoverDeposits({ x: deposit.x + DISCOVERY_RADIUS, y: 8, z: deposit.z }, discovered)).toBe(true);
    expect(discovered.has(depositKey(deposit))).toBe(true);
    expect(discoverDeposits({ x: 8.5, y: 8, z: 8.5 }, discovered)).toBe(false);
    expect(discovered.size).toBe(1);
    expect(parseDiscoveries(JSON.stringify([...discovered]))).toEqual(discovered);
  });
  it("rejects corrupt and unknown saved discovery IDs", () => {
    expect(parseDiscoveries("broken").size).toBe(0);
    expect(parseDiscoveries('{"fake":true}').size).toBe(0);
    expect(parseDiscoveries('["secret",123,null]').size).toBe(0);
    expect(parseDiscoveries(JSON.stringify([depositKey(MAP_DEPOSITS[0]!), "fake"])).size).toBe(1);
  });
});
