import { describe, expect, it } from "vitest";
import { InventoryItemState, PlayerState } from "../src/schema.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave, snapshotPlayerSave } from "../src/player-save.js";

describe("player saves", () => {
  it("round-trips inventory, health, and equipped progression", () => {
    const player = new PlayerState();
    const dagger = new InventoryItemState();
    dagger.quantity = 1;
    player.inventory.set("fang_dagger", dagger);
    const ironOre = new InventoryItemState();
    ironOre.quantity = 7;
    player.inventory.set("iron_ore", ironOre);
    player.health = 3;
    player.stamina = 47;
    player.coins = 73;
    player.blacksmithUpgrades = 5;
    player.mainHandId = "fang_dagger";
    player.mainHandTag = "melee";
    player.equippedPower = "seismic_cleave";
    player.seismicMastery = "tectonic_stand";
    player.equippedSpecial = "bramble_snare";
    player.equippedTrait = "executioner";

    const parsed = parsePlayerSave(serializePlayerSave(player, 123));
    expect(parsed).toEqual(snapshotPlayerSave(player, 123));
    const restored = new PlayerState();
    applyPlayerSave(restored, parsed!);
    expect(restored.inventory.get("fang_dagger")?.quantity).toBe(1);
    expect(restored.inventory.get("iron_ore")?.quantity).toBe(7);
    expect(restored.health).toBe(3);
    expect(restored.stamina).toBe(47);
    expect(restored.coins).toBe(73);
    expect(restored.blacksmithUpgrades).toBe(5);
    expect(restored.mainHandId).toBe("fang_dagger");
    expect(restored.equippedPower).toBe("seismic_cleave");
    expect(restored.seismicMastery).toBe("tectonic_stand");
    expect(restored.equippedSpecial).toBe("bramble_snare");
    expect(restored.equippedTrait).toBe("executioner");
  });

  it("rejects corrupt saves and sanitizes unsupported values", () => {
    expect(parsePlayerSave("not json")).toBeNull();
    const parsed = parsePlayerSave(JSON.stringify({
      version: 1,
      health: -20,
      maxHealth: 999,
      inventory: { fang_dagger: 2, exploit_item: 999, stone_core: -2 },
      mainHandId: "exploit_weapon",
      equippedPower: "exploit_power",
    }));
    expect(parsed?.health).toBe(1);
    expect(parsed?.maxHealth).toBe(127);
    expect(parsed?.inventory).toEqual({ fang_dagger: 2 });
    expect(parsed?.mainHandId).toBe("longsword");
    expect(parsed?.equippedPower).toBe("shockwave");
    expect(parsed?.coins).toBe(20);
    expect(parsed?.blacksmithUpgrades).toBe(0);
  });

  it("does not restore a dropped weapon unless it is owned", () => {
    const parsed = parsePlayerSave(JSON.stringify({ version: 1, inventory: {}, mainHandId: "stone_core_hammer" }));
    const player = new PlayerState();
    applyPlayerSave(player, parsed!);
    expect(player.mainHandId).toBe("longsword");
  });
});
