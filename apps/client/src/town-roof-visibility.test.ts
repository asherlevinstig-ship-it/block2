import { describe, expect, it } from "vitest";
import { TOWN_BUILDINGS } from "@blockcraft/voxel-world";
import { hidesTownRoof, hidesTownUpperWall, roofCutawayBuilding } from "./town-roof-visibility.js";

describe("town roof visibility", () => {
  const tavern = TOWN_BUILDINGS[0];

  it("opens only the occupied building roof at surface height", () => {
    const occupied = roofCutawayBuilding({ x: 8.5, y: 8, z: 10.5 }, null, TOWN_BUILDINGS, 8);
    expect(occupied).toBe(tavern);
    expect(hidesTownRoof(occupied, 8, 12, 14)).toBe(true);
    expect(hidesTownRoof(occupied, 8, 14, 14)).toBe(true);
    expect(hidesTownRoof(occupied, 8, 11, 14)).toBe(false);
    expect(hidesTownRoof(occupied, 8, 12, 8)).toBe(false);
    expect(roofCutawayBuilding({ x: 8.5, y: 5, z: 10.5 }, null, TOWN_BUILDINGS, 8)).toBeNull();
  });

  it("holds the roof cutaway through small doorway corrections", () => {
    expect(roofCutawayBuilding({ x: 8.5, y: 8, z: 9.5 }, tavern, TOWN_BUILDINGS, 8)).toBe(tavern);
    expect(roofCutawayBuilding({ x: 8.5, y: 8, z: 9.3 }, tavern, TOWN_BUILDINGS, 8)).toBeNull();
  });

  it("opens upper tavern walls but keeps the lower walls and furniture", () => {
    expect(hidesTownUpperWall(tavern, 16, 11, 14)).toBe(true);
    expect(hidesTownUpperWall(tavern, 8, 10, 19)).toBe(true);
    expect(hidesTownUpperWall(tavern, 16, 9, 14)).toBe(false);
    expect(hidesTownUpperWall(tavern, 8, 11, 14)).toBe(false);
    expect(hidesTownUpperWall(null, 16, 11, 14)).toBe(false);
  });
});
