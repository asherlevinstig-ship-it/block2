import { describe, expect, it } from "vitest";
import { TAVERN_INN_POINTS, canUseTavernInnPoint, tavernRoomFurnitureCellSolid } from "./index.js";

describe("tavern furniture collision", () => {
  it("blocks major furnishings without sealing the entrance or Mara's customer side", () => {
    expect(tavernRoomFurnitureCellSolid(-8, 8, -2)).toBe(true);
    expect(tavernRoomFurnitureCellSolid(3, 8, -7)).toBe(true);
    expect(tavernRoomFurnitureCellSolid(0, 8, 7)).toBe(false);
    expect(tavernRoomFurnitureCellSolid(-6, 8, -2)).toBe(false);
  });
  it("supports a solid upper floor with an open guest-room doorway", () => {
    expect(tavernRoomFurnitureCellSolid(0, 14, 0)).toBe(true);
    expect(tavernRoomFurnitureCellSolid(-4, 15, 2)).toBe(true);
    expect(tavernRoomFurnitureCellSolid(0, 15, 2)).toBe(false);
  });
  it("authorizes inn interactions only beside their furnishings", () => {
    expect(canUseTavernInnPoint({ x: TAVERN_INN_POINTS.rest.x, y: 15, z: TAVERN_INN_POINTS.rest.z }, "rest")).toBe(true);
    expect(canUseTavernInnPoint({ x: 8, y: 9, z: 6 }, "rest")).toBe(false);
    expect(canUseTavernInnPoint({ x: -6.2, y: 15, z: -4.8 }, "storage")).toBe(true);
  });
});
