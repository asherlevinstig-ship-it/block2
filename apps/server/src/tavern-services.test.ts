import { describe, expect, it } from "vitest";
import { canUseTavernKeeperService, tavernReturnBound, withTavernReturnBound } from "./tavern-services.js";
import { PlayerState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, snapshotPlayerSave } from "./player-save.js";

describe("tavern services", () => {
  it("preserves existing progression while binding the tavern return", () => {
    const source = JSON.stringify({ loadouts: [{ slot: 1 }], buildPath: { selectedPathId: "mage" } });
    const updated = withTavernReturnBound(source);
    expect(tavernReturnBound(updated)).toBe(true);
    expect(JSON.parse(updated)).toMatchObject({ loadouts: [{ slot: 1 }], buildPath: { selectedPathId: "mage" } });
  });

  it("migrates legacy loadout arrays without losing them", () => {
    const updated = withTavernReturnBound(JSON.stringify([{ slot: 1 }]));
    expect(JSON.parse(updated)).toMatchObject({ loadouts: [{ slot: 1 }], tavernReturn: true });
  });

  it("requires the player to stand at Mara's customer side", () => {
    expect(canUseTavernKeeperService({ x: -5.5, y: 9, z: -1.5 })).toBe(true);
    expect(canUseTavernKeeperService({ x: 0, y: 9, z: 1.5 })).toBe(false);
  });

  it("keeps the bound return point across a saved session", () => {
    const player = new PlayerState();
    player.huntLoadoutsJson = withTavernReturnBound("{}");
    const saved = parsePlayerSave(JSON.stringify(snapshotPlayerSave(player)));
    const restored = new PlayerState(); applyPlayerSave(restored, saved!);
    expect(tavernReturnBound(restored.huntLoadoutsJson)).toBe(true);
  });
});
