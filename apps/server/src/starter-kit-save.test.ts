import { describe, expect, it } from "vitest";
import { parsePlayerSave, snapshotPlayerSave } from "./player-save.js";
import { PlayerState } from "./schema.js";

describe("starter kit save repair", () => {
  it("repairs an untouched level-one save incorrectly marked as claimed", () => {
    const stale = {
      ...snapshotPlayerSave(new PlayerState()),
      starterKitClaimed: true,
      level: 1,
      experience: 0,
      blacksmithUpgrades: 0,
      inventory: {},
      storage: {},
      mainHandId: "unarmed",
      armourId: "none",
    };
    expect(parsePlayerSave(JSON.stringify(stale))?.starterKitClaimed).toBe(false);
  });

  it("keeps the claim for a character that has started progressing", () => {
    const progressed = {
      ...snapshotPlayerSave(new PlayerState()),
      starterKitClaimed: true,
      level: 2,
      inventory: {},
      storage: {},
      mainHandId: "unarmed",
    };
    expect(parsePlayerSave(JSON.stringify(progressed))?.starterKitClaimed).toBe(true);
  });
});
