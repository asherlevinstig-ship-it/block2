import { describe, expect, it } from "vitest";
import { canPlayAtTavernTable, canTalkToTavernKeeper, TAVERN_KEEPER,
  TAVERN_ROOM_KEEPER, TAVERN_ROOM_QUIZ_TABLE } from "./tavern-keeper.js";

describe("tavernkeeper interaction", () => {
  it("can be reached from the customer side of the bar", () => {
    expect(canTalkToTavernKeeper({ x: 5.1, y: 8, z: 22.8 }, true)).toBe(true);
  });

  it("does not interact from across the hall, underground, or when hidden", () => {
    expect(canTalkToTavernKeeper({ x: 8.5, y: 8, z: 20 }, true)).toBe(false);
    expect(canTalkToTavernKeeper({ x: TAVERN_KEEPER.x, y: 5, z: TAVERN_KEEPER.z }, true)).toBe(false);
    expect(canTalkToTavernKeeper({ x: TAVERN_KEEPER.x, y: 8, z: TAVERN_KEEPER.z }, false)).toBe(false);
  });

  it("supports Mara's dedicated tavern-room station", () => {
    expect(canTalkToTavernKeeper({ x: -5.6, y: 9, z: -1.5 }, true, TAVERN_ROOM_KEEPER)).toBe(true);
  });
});

describe("tavern quiz table interaction", () => {
  it("can be reached from the open aisle beside the table", () => {
    expect(canPlayAtTavernTable({ x: 10.8, y: 8, z: 22.5 }, true)).toBe(true);
  });

  it("does not open at Mara, underground, or while tavern art is hidden", () => {
    expect(canPlayAtTavernTable({ x: 5.1, y: 8, z: 22.5 }, true)).toBe(false);
    expect(canPlayAtTavernTable({ x: 12.5, y: 5, z: 22.5 }, true)).toBe(false);
    expect(canPlayAtTavernTable({ x: 12.5, y: 8, z: 22.5 }, false)).toBe(false);
  });

  it("supports the dedicated room's blue-and-gold table", () => {
    expect(canPlayAtTavernTable({ x: 3.6, y: 8, z: .5 }, true, TAVERN_ROOM_QUIZ_TABLE)).toBe(true);
  });
});
