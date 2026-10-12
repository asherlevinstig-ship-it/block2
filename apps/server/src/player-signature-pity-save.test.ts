import { describe, expect, it } from "vitest";
import { PlayerState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, snapshotPlayerSave } from "./player-save.js";
import { parseSignaturePity } from "./signature-loot.js";

describe("signature pity persistence", () => {
  it("round-trips protection and accepts older saves", () => {
    const player = new PlayerState(); player.signaturePityJson = '{"matriarch_edge":3}';
    const saved = parsePlayerSave(JSON.stringify(snapshotPlayerSave(player)));
    const restored = new PlayerState(); applyPlayerSave(restored, saved!);
    expect(parseSignaturePity(restored.signaturePityJson)).toEqual({ matriarch_edge: 3 });
    const old = snapshotPlayerSave(new PlayerState()); delete old.signaturePity;
    expect(parsePlayerSave(JSON.stringify(old))?.signaturePity).toEqual({});
  });
});
