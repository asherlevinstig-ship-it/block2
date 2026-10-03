import { describe, expect, it } from "vitest";
import { TOWN_LODGES } from "@blockcraft/voxel-world";
import { hidesTownRoof, roofCutawayLodge } from "./town-roof-visibility.js";

describe("town roof visibility", () => {
  const lodge = TOWN_LODGES[0];

  it("opens only the occupied building roof at surface height", () => {
    const occupied = roofCutawayLodge({ x: 5.5, y: 8, z: 6.5 }, null, TOWN_LODGES, 8);
    expect(occupied).toBe(lodge);
    expect(hidesTownRoof(occupied, 3, 10, 5)).toBe(true);
    expect(hidesTownRoof(occupied, 3, 9, 5)).toBe(false);
    expect(hidesTownRoof(occupied, 12, 10, 10)).toBe(false);
    expect(roofCutawayLodge({ x: 5.5, y: 5, z: 6.5 }, null, TOWN_LODGES, 8)).toBeNull();
  });

  it("holds the roof cutaway through small doorway corrections", () => {
    expect(roofCutawayLodge({ x: 6.3, y: 8, z: 6.5 }, lodge, TOWN_LODGES, 8)).toBe(lodge);
    expect(roofCutawayLodge({ x: 6.7, y: 8, z: 6.5 }, lodge, TOWN_LODGES, 8)).toBeNull();
  });
});
