import { describe, expect, it } from "vitest";
import {
  MISTFEN_BOARDWALKS,
  MISTFEN_LANDMARKS,
  MISTFEN_REEDS,
  MISTFEN_ROUTE_NODES,
  MISTFEN_SNAGS,
  MISTFEN_TEXTURE_STYLES,
  MISTFEN_TOXIC_POOLS,
} from "./mistfen-visuals.js";

describe("Mistfen visual composition", () => {
  it("uses textured marsh materials and dense wetland dressing", () => {
    expect(Object.keys(MISTFEN_TEXTURE_STYLES)).toEqual(["marsh", "water", "mud"]);
    expect(MISTFEN_REEDS.length).toBeGreaterThanOrEqual(24);
    expect(MISTFEN_SNAGS.length).toBeGreaterThanOrEqual(9);
  });

  it("separates damaging pools with an authored narrow boardwalk route", () => {
    expect(MISTFEN_TOXIC_POOLS).toHaveLength(7);
    expect(MISTFEN_BOARDWALKS.length).toBeGreaterThanOrEqual(7);
    expect(new Set(MISTFEN_TOXIC_POOLS.map(pool => pool.id)).size).toBe(MISTFEN_TOXIC_POOLS.length);
    expect(MISTFEN_BOARDWALKS.every(walk => walk.width >= 2.2)).toBe(true);
  });

  it("offers three encounters, a cache and the Miremother basin", () => {
    expect(MISTFEN_LANDMARKS.map(landmark => landmark.kind)).toEqual([
      "drowned-camp", "reed-maze", "corrupted-spring", "guarded-cache", "leader-basin",
    ]);
    expect(MISTFEN_LANDMARKS.every(landmark => landmark.radius >= 7)).toBe(true);
  });

  it("connects Greenwood to the future eastern route", () => {
    expect(MISTFEN_ROUTE_NODES[0]).toMatchObject({ id: "greenwood-threshold", x: 153.5 });
    expect(MISTFEN_ROUTE_NODES.at(-1)).toMatchObject({ id: "ashen-threshold", x: 202.5 });
  });
});
