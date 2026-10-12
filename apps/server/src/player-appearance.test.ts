import { describe, expect, it } from "vitest";
import { AppearanceSchema, DEFAULT_APPEARANCE, resolveAppearance } from "@blockcraft/protocol";
import { PlayerState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, snapshotPlayerSave } from "./player-save.js";

describe("player appearance", () => {
  it("accepts only the offered appearance choices", () => {
    expect(AppearanceSchema.safeParse({ skin: "deep", hair: "silver", coat: "rust", hairStyle: "spiked", coatStyle: "long" }).success).toBe(true);
    expect(AppearanceSchema.safeParse({ skin: "deep", hair: "silver", coat: "#ffffff", hairStyle: "spiked", coatStyle: "long" }).success).toBe(false);
    expect(AppearanceSchema.safeParse({ skin: "warm", hair: "dark", coat: "teal", hairStyle: "swept", coatStyle: "explorer", extra: "value" }).success).toBe(false);
  });

  it("round-trips the chosen look through the persistent save", () => {
    const player = new PlayerState();
    Object.assign(player, { appearanceSkin: "deep", appearanceHair: "silver", appearanceCoat: "rust", appearanceHairStyle: "spiked", appearanceCoatStyle: "long" });
    const saved = parsePlayerSave(JSON.stringify(snapshotPlayerSave(player)));
    expect(saved?.appearance).toEqual({ skin: "deep", hair: "silver", coat: "rust", hairStyle: "spiked", coatStyle: "long" });
    const restored = new PlayerState();
    applyPlayerSave(restored, saved!);
    expect([restored.appearanceSkin, restored.appearanceHair, restored.appearanceCoat, restored.appearanceHairStyle, restored.appearanceCoatStyle])
      .toEqual(["deep", "silver", "rust", "spiked", "long"]);
  });

  it("uses safe defaults for older or malformed saves", () => {
    const oldSave = snapshotPlayerSave(new PlayerState());
    delete oldSave.appearance;
    expect(parsePlayerSave(JSON.stringify(oldSave))?.appearance).toEqual(DEFAULT_APPEARANCE);
    expect(resolveAppearance({ skin: "invalid", hair: "dark", coat: "teal" })).toEqual(DEFAULT_APPEARANCE);
    expect(resolveAppearance({ skin: "deep", hair: "silver", coat: "rust" })).toEqual({
      skin: "deep", hair: "silver", coat: "rust", hairStyle: "swept", coatStyle: "explorer",
    });
  });
});
