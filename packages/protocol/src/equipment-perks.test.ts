import { describe, expect, it } from "vitest";
import { EQUIPMENT_AFFIX_RESONANCE, equipmentAffixResonanceForLoadout, equipmentPerkStats } from "./index.js";

describe("fixed equipment perks", () => {
  it("scales weapon identity with reforge rank", () => {
    expect(equipmentPerkStats("stone_core_hammer", 0)).toMatchObject({ id: "core_quake", name: "Core Quake" });
    expect(equipmentPerkStats("stone_core_hammer", 3)?.detail).toContain("2 damage within 2.15m");
    expect(equipmentPerkStats("matriarch_edge", 3)?.detail).toContain("3 damage within 3.15m");
    expect(equipmentPerkStats("echo_prism", 3)?.detail).toContain("3 damage within 4.25m");
  });

  it("scales armour identity and rejects ordinary gear", () => {
    expect(equipmentPerkStats("rootguard_armour", 2)?.detail).toContain("12 stamina");
    expect(equipmentPerkStats("bastion_plate", 3)?.detail).toContain("every 11s");
    expect(equipmentPerkStats("forged_sword", 3)).toBeNull();
  });

  it("activates a named resonance only when weapon and armour affixes share a Calling", () => {
    expect(equipmentAffixResonanceForLoadout("fang_dagger", "fangstalker_wrap", {
      fang_dagger: { affixId: "lethal", tier: 2 },
      fangstalker_wrap: { affixId: "veiled", tier: 1 },
    })).toBe("assassin");
    expect(EQUIPMENT_AFFIX_RESONANCE.assassin.name).toBe("Nightfall");
    expect(equipmentAffixResonanceForLoadout("fang_dagger", "fangstalker_wrap", {
      fang_dagger: { affixId: "lethal", tier: 2 },
      fangstalker_wrap: { affixId: "elusive", tier: 1 },
    })).toBeNull();
  });
});
