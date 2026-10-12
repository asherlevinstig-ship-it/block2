import { describe, expect, it } from "vitest";
import { PlayerState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, snapshotPlayerSave } from "./player-save.js";
import { equipmentReforgeRank, withReforgeRank } from "./equipment-reforge.js";

describe("reforge persistence", () => {
  it("round-trips equipment ranks and accepts older saves without them", () => {
    const player = new PlayerState();
    player.reforgeRanksJson = withReforgeRank("{}", "stone_core_hammer", 3);
    const saved = parsePlayerSave(JSON.stringify(snapshotPlayerSave(player)));
    const restored = new PlayerState(); applyPlayerSave(restored, saved!);
    expect(equipmentReforgeRank(restored.reforgeRanksJson, "stone_core_hammer")).toBe(3);

    const old = snapshotPlayerSave(new PlayerState()); delete old.reforgeRanks;
    expect(parsePlayerSave(JSON.stringify(old))?.reforgeRanks).toEqual({});
  });
});
