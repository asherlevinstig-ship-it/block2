import { describe, expect, it } from "vitest";
import { lootVisibleToPlayer } from "./loot-ownership.js";
describe("personal loot visibility", () => {
  it("shows owned bags and hides other players' bags", () => {
    expect(lootVisibleToPlayer("a", "a")).toBe(true);
    expect(lootVisibleToPlayer("b", "a")).toBe(false);
    expect(lootVisibleToPlayer("a", "b")).toBe(false);
  });
  it("allows explicitly unowned legacy drops", () => {
    expect(lootVisibleToPlayer("", "a")).toBe(true);
    expect(lootVisibleToPlayer(undefined, "a")).toBe(true);
  });
});
