import { describe, expect, it } from "vitest";
import { AppearanceSchema, DEFAULT_APPEARANCE, resolveAppearance } from "@blockcraft/protocol";
import { PlayerState } from "./schema.js";
import { applyPlayerSave, parsePlayerSave, snapshotPlayerSave } from "./player-save.js";

describe("player appearance", () => {
  it("accepts only the offered appearance choices", () => {
    expect(AppearanceSchema.safeParse({ skin: "deep", hair: "silver", coat: "rust" }).success).toBe(true);
    expect(AppearanceSchema.safeParse({ skin: "deep", hair: "silver", coat: "#ffffff" }).success).toBe(false);
    expect(AppearanceSchema.safeParse({ skin: "warm", hair: "dark", coat: "teal", extra: "value" }).success).toBe(false);
  });

  it("round-trips the chosen look through the persistent save", () => {
    const player = new PlayerState();
    Object.assign(player, { appearanceSkin: "deep", appearanceHair: "silver", appearanceCoat: "rust" });
    const saved = parsePlayerSave(JSON.stringify(snapshotPlayerSave(player)));
    expect(saved?.appearance).toEqual({ skin: "deep", hair: "silver", coat: "rust" });
    const restored = new PlayerState();
    applyPlayerSave(restored, saved!);
    expect([restored.appearanceSkin, restored.appearanceHair, restored.appearanceCoat]).toEqual(["deep", "silver", "rust"]);
  });

  it("uses safe defaults for older or malformed saves", () => {
    const oldSave = snapshotPlayerSave(new PlayerState());
    delete oldSave.appearance;
    expect(parsePlayerSave(JSON.stringify(oldSave))?.appearance).toEqual(DEFAULT_APPEARANCE);
    expect(resolveAppearance({ skin: "invalid", hair: "dark", coat: "teal" })).toEqual(DEFAULT_APPEARANCE);
  });
});
