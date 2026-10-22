import { describe, expect, it } from "vitest";
import { miniBossCoverSites, miniBossPressureSites, regionalLeaderArenaMechanic } from "./mini-boss-arena.js";

describe("dynamic mini-boss arenas", () => {
  it("places symmetric cover for ranged and heavy leaders only", () => {
    const cover = miniBossCoverSites({ x: 50.5, y: 8, z: 25.5 }, "cave_spitter");
    expect(cover).toEqual([
      { x: 47, y: 8, z: 22 }, { x: 53, y: 8, z: 22 },
      { x: 47, y: 8, z: 28 }, { x: 53, y: 8, z: 28 },
    ]);
    expect(miniBossCoverSites({ x: 0, y: 8, z: 0 }, "moss_crawler")).toEqual([]);
  });

  it("tightens later phases while preserving opposite safe gaps", () => {
    expect(miniBossPressureSites({ x: 0, y: 8, z: 0 }, 1, 0)).toEqual([]);
    const phaseTwo = miniBossPressureSites({ x: 0, y: 8, z: 0 }, 2, 1);
    const phaseThree = miniBossPressureSites({ x: 0, y: 8, z: 0 }, 3, 2);
    expect(phaseTwo).toHaveLength(4);
    expect(phaseThree).toHaveLength(6);
    expect(phaseThree.some(site => site.x > 3.5)).toBe(false);
    expect(phaseThree.some(site => site.x < -3.5)).toBe(false);
  });

  it("gives every collection leader a distinct readable arena mechanic", () => {
    const ids = ["wild-crawler", "mistfen-behemoth", "south-quarrymaster",
      "northwatch-watchbreaker", "frontier-brute-east", "ashglass-sentry-east"];
    const mechanics = ids.map(id => regionalLeaderArenaMechanic(id, { x: 0, y: 8, z: 0 }, 2, 1)!);
    expect(mechanics.every(Boolean)).toBe(true);
    expect(new Set(mechanics.map(mechanic => mechanic.cue)).size).toBe(ids.length);
    expect(mechanics.map(mechanic => mechanic.kind)).toEqual([
      "root", "toxic-cloud", "pressure", "pressure", "pressure", "fire-trail",
    ]);
    expect(regionalLeaderArenaMechanic("wild-crawler", { x: 0, y: 8, z: 0 }, 1, 0)).toBeNull();
    expect(regionalLeaderArenaMechanic("ordinary-mob", { x: 0, y: 8, z: 0 }, 3, 0)).toBeNull();
    expect(regionalLeaderArenaMechanic("northwatch-watchbreaker", { x: 0, y: 8, z: 0 }, 3, 0)!.sites).toHaveLength(7);
  });
});
