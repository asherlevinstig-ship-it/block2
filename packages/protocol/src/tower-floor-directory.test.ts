import { describe, expect, it } from "vitest";
import { towerFloorDirectory, towerFloorUnlocked } from "./tower-floor-directory.js";

describe("tower floor directory", () => {
  it("offers every currently built floor and keeps unbuilt floors visibly locked", () => {
    const directory = towerFloorDirectory({ highestFloorCleared: 0, clearedFloors: [] });
    expect(directory.entries.map(entry => [entry.floor, entry.status])).toEqual([
      [1, "available"], [2, "available"], [3, "construction"],
    ]);
    expect(towerFloorUnlocked({ highestFloorCleared: 0, clearedFloors: [] }, 2)).toBe(true);
  });

  it("allows direct travel to Floor 2 after Floor 1 is cleared", () => {
    const directory = towerFloorDirectory({ highestFloorCleared: 1, clearedFloors: [1] });
    expect(directory.entries[0]).toMatchObject({ floor: 1, cleared: true, unlocked: true, status: "cleared" });
    expect(directory.entries[1]).toMatchObject({ floor: 2, unlocked: true, status: "available" });
    expect(towerFloorUnlocked({ highestFloorCleared: 1, clearedFloors: [1] }, 2)).toBe(true);
  });
});
