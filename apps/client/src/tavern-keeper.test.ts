import { describe, expect, it } from "vitest";
import { canTalkToTavernKeeper, TAVERN_KEEPER } from "./tavern-keeper.js";

describe("tavernkeeper interaction", () => {
  it("can be reached from the customer side of the bar", () => {
    expect(canTalkToTavernKeeper({ x: 5.1, y: 8, z: 16.8 }, true)).toBe(true);
  });

  it("does not interact from across the hall, underground, or when hidden", () => {
    expect(canTalkToTavernKeeper({ x: 8.5, y: 8, z: 14 }, true)).toBe(false);
    expect(canTalkToTavernKeeper({ x: TAVERN_KEEPER.x, y: 5, z: TAVERN_KEEPER.z }, true)).toBe(false);
    expect(canTalkToTavernKeeper({ x: TAVERN_KEEPER.x, y: 8, z: TAVERN_KEEPER.z }, false)).toBe(false);
  });
});
