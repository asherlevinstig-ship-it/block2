import { describe, expect, it } from "vitest";
import { MAP_DEPOSITS, MAP_SIZE, DISCOVERY_RADIUS, depositKey, discoverDeposits, mapPoint, mapFacing, parseDiscoveries } from "./minimap.js";

describe("north-up explorer minimap", () => {
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
