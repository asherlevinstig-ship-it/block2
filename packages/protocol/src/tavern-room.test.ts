import { describe, expect, it } from "vitest";
import { tavernRoomFurnitureCellSolid } from "./index.js";

describe("tavern furniture collision", () => {
  it("blocks major furnishings without sealing the entrance or Mara's customer side", () => {
    expect(tavernRoomFurnitureCellSolid(-8, 8, -2)).toBe(true);
    expect(tavernRoomFurnitureCellSolid(3, 8, -7)).toBe(true);
    expect(tavernRoomFurnitureCellSolid(0, 8, 7)).toBe(false);
    expect(tavernRoomFurnitureCellSolid(-6, 8, -2)).toBe(false);
  });
});
