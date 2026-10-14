import { describe, expect, it } from "vitest";
import { REGIONAL_FORGE_RECIPES, RegionalForgeSchema } from "@blockcraft/protocol";
import { PlayerState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, snapshotPlayerSave } from "./player-save.js";

describe("regional forging", () => {
  it("defines mastery-gated legendary recipes with five-victory bad-luck protection", () => {
    expect(REGIONAL_FORGE_RECIPES.greenwood).toMatchObject({ itemId: "rootstalker_wrap", marks: 5, rankName: "Rootslayer" });
    expect(REGIONAL_FORGE_RECIPES.mistfen).toMatchObject({ itemId: "mirebreaker_mantle", marks: 5, rankName: "Mirebreaker" });
    expect(REGIONAL_FORGE_RECIPES.greenwood.materials.length).toBeGreaterThanOrEqual(3);
    expect(REGIONAL_FORGE_RECIPES.mistfen.materials.length).toBeGreaterThanOrEqual(3);
    expect(RegionalForgeSchema.safeParse({ region: "mistfen" }).success).toBe(true);
    expect(RegionalForgeSchema.safeParse({ region: "frontier" }).success).toBe(false);
  });

  it("persists bound regional marks without consuming inventory slots", () => {
    const player = new PlayerState();
    player.huntLoadoutsJson = JSON.stringify({
      greenwood: { points: 150, discovered: true, marks: 4 },
      mistfen: { points: 90, discovered: true, marks: 2 },
    });
    const saved = parsePlayerSave(JSON.stringify(snapshotPlayerSave(player)));
    expect(saved).toMatchObject({ greenwoodMarks: 4, mistfenMarks: 2 });
    const restored = new PlayerState();
    applyPlayerSave(restored, saved!);
    expect(JSON.parse(restored.huntLoadoutsJson)).toMatchObject({
      greenwood: { points: 150, discovered: true, marks: 4 },
      mistfen: { points: 90, discovered: true, marks: 2 },
    });
    expect(restored.inventory.size).toBe(0);
  });
});
