import { describe, expect, it } from "vitest";
import { parseTowerProgress, withTowerFloorCleared } from "./tower-progress.js";

describe("tower progress", () => {
  it("records a first clear and preserves unrelated player data", () => {
    const result = withTowerFloorCleared('{"starterKitClaimed":true,"gold":2}', 1);
    expect(result.firstClear).toBe(true);
    expect(result.progress).toEqual({ highestFloorCleared: 1, clearedFloors: [1] });
    expect(JSON.parse(result.json)).toMatchObject({ starterKitClaimed: true, gold: 2 });
  });

  it("does not celebrate a repeated clear", () => {
    const first = withTowerFloorCleared("{}", 1);
    const repeat = withTowerFloorCleared(first.json, 1);
    expect(repeat.firstClear).toBe(false);
    expect(repeat.progress).toEqual({ highestFloorCleared: 1, clearedFloors: [1] });
  });

  it("repairs malformed and inconsistent stored progress", () => {
    expect(parseTowerProgress("bad")).toEqual({ highestFloorCleared: 0, clearedFloors: [] });
    expect(parseTowerProgress('{"towerProgress":{"highestFloorCleared":2,"clearedFloors":[1,3,3,-1]}}'))
      .toEqual({ highestFloorCleared: 3, clearedFloors: [1, 3] });
  });

  it("recognizes legacy Crownkeeper fragments as proof that Floor 1 was cleared", () => {
    expect(parseTowerProgress('{"crownkeeperFragments":2}')).toEqual({
      highestFloorCleared: 1,
      clearedFloors: [1],
    });
  });
});
