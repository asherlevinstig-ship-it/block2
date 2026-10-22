import { describe, expect, it, vi } from "vitest";
import { attunementDustCost, attunementDustYield, keepBetterAffix, parseEquipmentAffixes, parseEquipmentAffixOffers,
  rollEquipmentAffix, rollEquipmentAffixOptions, rollTargetedEquipmentAffix } from "./equipment-affixes.js";
import { WorldRoom } from "./game-room.js";
import { PlayerState, WorldState } from "./schema.js";

describe("equipment affixes", () => {
  it("favours the active Calling while retaining off-build possibilities", () => {
    expect(rollEquipmentAffix("ranger", 2, () => 0)).toEqual({ affixId: "piercing", tier: 2 });
    expect(rollEquipmentAffix("healer", 2, () => 0)).toEqual({ affixId: "mending", tier: 2 });
    expect(rollEquipmentAffix("tank", 9, () => .99).tier).toBe(3);
  });
  it("keeps stronger existing rolls and sanitizes saved data", () => {
    expect(keepBetterAffix({ affixId: "fortified", tier: 3 }, { affixId: "volatile", tier: 2 })).toEqual({ affixId: "fortified", tier: 3 });
    expect(parseEquipmentAffixes({ fang_dagger: { affixId: "precise", tier: 2 }, cheat: { affixId: "bad", tier: 9 } }))
      .toEqual({ fang_dagger: { affixId: "precise", tier: 2 } });
  });
  it("creates three unique boss choices and validates stored offers", () => {
    const choices = rollEquipmentAffixOptions("mage", 3, 3, () => 0);
    expect(choices).toHaveLength(3);
    expect(new Set(choices.map(choice => choice.affixId)).size).toBe(3);
    expect(choices.every(choice => choice.tier === 3)).toBe(true);
    expect(parseEquipmentAffixOffers({ echo_prism: ["echoing", "volatile", "bad"] })).toEqual({ echo_prism: ["echoing", "volatile"] });
  });
  it("improves a pinned trait only in a compatible hunt region and guarantees it in leader choices", () => {
    expect(rollTargetedEquipmentAffix("mage", 2, "volatile", true, () => 0)).toEqual({ affixId: "volatile", tier: 2 });
    expect(rollTargetedEquipmentAffix("mage", 2, "volatile", false, () => 0)).toEqual({ affixId: "echoing", tier: 2 });
    expect(rollEquipmentAffixOptions("mage", 3, 3, () => .9, "volatile").map(choice => choice.affixId)).toContain("volatile");
  });
  it("awards more dust for stronger gear and applies the Calling discount", () => {
    expect([1, 2, 3].map(attunementDustYield)).toEqual([1, 3, 6]);
    expect(attunementDustCost("reroll", 3, false)).toBe(10);
    expect(attunementDustCost("reroll", 3, true)).toBe(8);
    expect(attunementDustCost("focus", 2, false)).toBe(18);
    expect(attunementDustCost("focus", 2, true)).toBe(15);
    expect(attunementDustCost("upgrade", 2, true)).toBe(10);
  });

  it("raises both equipped affixes by one effective tier when their Callings resonate", () => {
    const room = new WorldRoom() as any;
    const player = new PlayerState();
    player.mainHandId = "fang_dagger"; player.armourId = "fangstalker_wrap";
    player.huntLoadoutsJson = JSON.stringify({ affixes: {
      fang_dagger: { affixId: "lethal", tier: 2 },
      fangstalker_wrap: { affixId: "veiled", tier: 1 },
    } });
    expect(room.equipmentAffixTier(player, "lethal")).toBe(3);
    expect(room.equipmentAffixTier(player, "veiled")).toBe(2);
    player.armourId = "iron_armour";
    expect(room.equipmentAffixTier(player, "lethal")).toBe(2);
  });

  it("persists a voluntary target and recommends the nearest compatible region", () => {
    const room = new WorldRoom() as any;
    const player = new PlayerState(); player.x = 8.5; player.z = 8.5;
    room.setEquipmentAffixTarget(player, "precise");
    expect(room.equipmentAffixTarget(player)).toBe("precise");
    expect(room.equipmentHuntTarget(player)).toMatchObject({ affixId: "precise", regionId: "greenwood", chancePercent: 45 });
    room.setEquipmentAttunements(player, {}, 3, {});
    expect(room.equipmentAffixTarget(player)).toBe("precise");
  });

  it("gives Healer attunements reachable hunt regions", () => {
    const room = new WorldRoom() as any;
    const player = new PlayerState(); player.x = 8.5; player.z = 8.5;
    room.setEquipmentAffixTarget(player, "mending");
    expect(room.equipmentHuntTarget(player)).toMatchObject({ affixId: "mending", regionId: "greenwood" });
  });

  it("emits equipped affix procs at the effect position without combat spam", () => {
    const room = new WorldRoom() as any; room.setState(new WorldState());
    const player = new PlayerState();
    player.mainHandId = "fang_dagger";
    player.huntLoadoutsJson = JSON.stringify({ affixes: { fang_dagger: { affixId: "lethal", tier: 2 } } });
    room.state.players.set("hero", player);
    const send = vi.fn(); Object.defineProperty(room, "clients", { value: [{ sessionId: "hero", send }] });
    room.equipmentAffixProc("hero", "lethal", "LETHAL +2", { x: 4, y: 8, z: 6 }, 1_000);
    room.equipmentAffixProc("hero", "lethal", "LETHAL +2", { x: 4, y: 8, z: 6 }, 1_100);
    room.equipmentAffixProc("hero", "lethal", "LETHAL +2", { x: 4, y: 8, z: 6 }, 1_400);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith("equipment:affix-proc",
      { affixId: "lethal", tier: 2, label: "LETHAL +2", x: 4, y: 8, z: 6 });
  });
});
