import { describe, expect, it } from "vitest";
import { InventoryItemState, PlayerState } from "../src/schema.js";
import { applyPlayerSave, parsePlayerSave, serializePlayerSave, snapshotPlayerSave } from "../src/player-save.js";
import { parseNorthwatchProgress, withNorthwatchProgress } from "../src/northwatch-progress.js";
import { starterKitClaimed, withStarterKitClaimed } from "../src/starter-kit.js";

describe("player saves", () => {
  it("keeps starter supplies pending for new and untouched legacy characters", () => {
    const player = new PlayerState();
    expect(parsePlayerSave(serializePlayerSave(player))?.starterKitClaimed).toBe(false);
    const restored = new PlayerState();
    applyPlayerSave(restored, parsePlayerSave(serializePlayerSave(player))!);
    expect(starterKitClaimed(restored.huntLoadoutsJson)).toBe(false);
    player.huntLoadoutsJson = withStarterKitClaimed(player.huntLoadoutsJson);
    // A level-one, zero-XP, empty character is repaired as untouched even if
    // an old client accidentally persisted the claimed marker.
    expect(parsePlayerSave(serializePlayerSave(player))?.starterKitClaimed).toBe(false);
    const legacy = parsePlayerSave(JSON.stringify({ version: 1, inventory: {}, mainHandId: "longsword" }))!;
    expect(legacy.starterKitClaimed).toBe(false);
    expect(legacy.mainHandId).toBe("unarmed");
    applyPlayerSave(restored, legacy);
    expect(starterKitClaimed(restored.huntLoadoutsJson)).toBe(false);
  });
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
    player.blacksmithUpgrades = 5 | 16 | 256 | 512 | 1024;
    player.silverDepthsBestTimeMs = 184_000;
    player.miningExpeditionStage = 6;
    player.huntLoadoutsJson = withNorthwatchProgress(player.huntLoadoutsJson, { clears: 3, marks: 2 });
    Object.assign(player, { level: 6, experience: 31, unspentStatPoints: 1, powerPoints: 2, vitalityPoints: 1, agilityPoints: 1, miningPoints: 0 });
    player.mainHandId = "fang_dagger";
    player.mainHandTag = "melee";
    player.equippedPower = "seismic_cleave";
    player.equippedPowerSecondary = "lunge_strike";
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
    expect(restored.blacksmithUpgrades).toBe(5 | 16 | 256 | 512 | 1024);
    expect(restored.silverDepthsBestTimeMs).toBe(184_000);
    expect(restored.miningExpeditionStage).toBe(6);
    expect(parseNorthwatchProgress(restored.huntLoadoutsJson)).toEqual({ clears: 3, marks: 2 });
    expect([restored.level, restored.experience, restored.unspentStatPoints]).toEqual([6, 31, 1]);
    expect([restored.powerPoints, restored.vitalityPoints, restored.agilityPoints, restored.miningPoints]).toEqual([2, 1, 1, 0]);
    expect(restored.mainHandId).toBe("fang_dagger");
    expect(restored.equippedPower).toBe("seismic_cleave");
    expect(restored.equippedPowerSecondary).toBe("lunge_strike");
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

  it("resumes legacy lantern owners at the return-to-blacksmith step", () => {
    const parsed = parsePlayerSave(JSON.stringify({ version: 1, inventory: { miners_lantern: 1 }, mainHandId: "longsword" }));
    expect(parsed?.miningExpeditionStage).toBe(7);
  });

  it("migrates existing Northwatch owners and clamps corrupt patrol progress", () => {
    expect(parsePlayerSave(JSON.stringify({ version: 1, inventory: { northwatch_cloak: 1 } }))?.northwatchClears).toBe(1);
    expect(parsePlayerSave(JSON.stringify({ version: 1, storage: { watchbreaker_crest: 1 } }))?.northwatchClears).toBe(1);
    const parsed = parsePlayerSave(JSON.stringify({ version: 1, northwatchClears: 999, northwatchPatrolMarks: 255 }));
    expect(parsed?.northwatchClears).toBe(5);
    expect(parsed?.northwatchPatrolMarks).toBe(3);
  });

  it("persists validated hunt loadouts and the collection reward", () => {
    const player = new PlayerState();
    player.huntLoadoutsJson = JSON.stringify({ loadouts: [{ slot: 1, name: "Fang Rush", mainHandId: "fang_dagger", armourId: "fangstalker_wrap",
      equippedPower: "seismic_cleave", equippedPowerSecondary: "lunge_strike", equippedSpecial: "hunters_mark",
      equippedTrait: "momentum", seismicMastery: "advancing_fault" }], buildPath: { selectedPathId: "assassin", xp: { assassin: 70, mage: 9 }, specializations: { assassin: "executioner" }, callingAbilities: { assassin: "assassin_death_mark" }, callingAugments: { assassin_death_mark: "mark_lingering_sentence" }, callingAugmentProgress: { mark_lingering_sentence: 12 }, masteredCallingAugments: ["mark_lingering_sentence"], trials: { executioner: 7 }, mastered: [] },
      affixes: { fang_dagger: { affixId: "executioner", tier: 2 } }, dust: 7,
      offers: { fangstalker_wrap: ["lethal", "veiled", "executioner"] } });
    player.huntCollectionRewardClaimed = true;
    const parsed = parsePlayerSave(serializePlayerSave(player, 456));
    expect(parsed?.huntLoadouts?.[0]).toMatchObject({ slot: 1, name: "Fang Rush", mainHandId: "fang_dagger", armourId: "fangstalker_wrap" });
    expect(parsed?.huntCollectionRewardClaimed).toBe(true);
    expect(parsed?.buildPath).toEqual({ selectedPathId: "assassin", xp: { assassin: 70, mage: 9 }, specializations: { assassin: "executioner" }, callingAbilities: { assassin: "assassin_death_mark" }, callingAugments: { assassin_death_mark: "mark_lingering_sentence" }, callingAugmentProgress: { mark_lingering_sentence: 12 }, masteredCallingAugments: ["mark_lingering_sentence"], trials: { executioner: 7 }, mastered: [] });
    expect(parsed?.equipmentAffixes).toEqual({ fang_dagger: { affixId: "executioner", tier: 2 } });
    expect(parsed?.attunementDust).toBe(7);
    expect(parsed?.attunementOffers).toEqual({ fangstalker_wrap: ["lethal", "veiled", "executioner"] });
    const restored = new PlayerState(); applyPlayerSave(restored, parsed!);
    expect(JSON.parse(restored.huntLoadoutsJson).loadouts[0].name).toBe("Fang Rush");
    expect(restored.huntCollectionRewardClaimed).toBe(true);
    expect(JSON.parse(restored.huntLoadoutsJson).buildPath).toEqual({ selectedPathId: "assassin", xp: { assassin: 70, mage: 9 }, specializations: { assassin: "executioner" }, callingAbilities: { assassin: "assassin_death_mark" }, callingAugments: { assassin_death_mark: "mark_lingering_sentence" }, callingAugmentProgress: { mark_lingering_sentence: 12 }, masteredCallingAugments: ["mark_lingering_sentence"], trials: { executioner: 7 }, mastered: [] });
    expect(JSON.parse(restored.huntLoadoutsJson).affixes).toEqual({ fang_dagger: { affixId: "executioner", tier: 2 } });
    expect(JSON.parse(restored.huntLoadoutsJson).dust).toBe(7);
    expect(JSON.parse(restored.huntLoadoutsJson).offers).toEqual({ fangstalker_wrap: ["lethal", "veiled", "executioner"] });
  });
  it("round-trips a saved Healer Calling and loadout", () => {
    const player = new PlayerState();
    player.huntLoadoutsJson = JSON.stringify({
      loadouts: [{ slot: 1, name: "Medic", mainHandId: "longsword", armourId: "none",
        equippedPower: "seismic_cleave", equippedPowerSecondary: "lunge_strike", equippedSpecial: "hunters_mark",
        equippedTrait: "momentum", seismicMastery: "advancing_fault", buildPathId: "healer" }],
      buildPath: { selectedPathId: "healer", xp: { healer: 70 }, specializations: { healer: "lifebinder" },
        callingAbilities: { healer: "healer_field_mend" } },
    });
    const parsed = parsePlayerSave(serializePlayerSave(player))!;
    expect(parsed.buildPath.selectedPathId).toBe("healer");
    expect(parsed.huntLoadouts?.[0]?.buildPathId).toBe("healer");
    const restored = new PlayerState(); applyPlayerSave(restored, parsed);
    expect(JSON.parse(restored.huntLoadoutsJson).buildPath.selectedPathId).toBe("healer");
    expect(JSON.parse(restored.huntLoadoutsJson).loadouts[0].buildPathId).toBe("healer");
  });
});
