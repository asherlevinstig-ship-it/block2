import { describe, expect, it } from "vitest";
import { LOOT_HOLD_MS, lootHoldProgress, lootHoldSourceForPointer } from "./loot-hold.js";

describe("hold to collect loot", () => {
  it("requires a deliberate short hold and resets when the target changes", () => {
    const hold = { dropId: "bag-a", startedAt: 1_000, source: "keyboard" as const };
    expect(LOOT_HOLD_MS).toBe(750);
    expect(lootHoldProgress(hold, 1_375, "bag-a")).toBeCloseTo(.5);
    expect(lootHoldProgress(hold, 1_750, "bag-a")).toBe(1);
    expect(lootHoldProgress(hold, 1_600, "bag-b")).toBe(0);
    expect(lootHoldProgress(null, 1_600, "bag-a")).toBe(0);
  });

  it("never starts collection from a mouse or pen click", () => {
    expect(lootHoldSourceForPointer("mouse")).toBeNull();
    expect(lootHoldSourceForPointer("pen")).toBeNull();
    expect(lootHoldSourceForPointer("touch")).toBe("touch");
  });
});
