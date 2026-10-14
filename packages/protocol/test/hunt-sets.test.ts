import { describe, expect, it } from "vitest";
import { HUNT_EQUIPMENT_SETS, equipmentPerkStats, huntSetForItem, huntSetForLoadout } from "../src/index.js";

describe("Hunt equipment sets", () => {
  it("activates only when the matching weapon and armour are equipped", () => {
    expect(huntSetForLoadout("fang_dagger", "fangstalker_wrap")).toBe("fang");
    expect(huntSetForLoadout("acid_gland_focus", "venomweave_mantle")).toBe("venom");
    expect(huntSetForLoadout("stone_core_hammer", "worldsplitter_plate")).toBe("crusher");
    expect(huntSetForLoadout("fang_dagger", "venomweave_mantle")).toBeNull();
  });

  it("publishes pairing and mechanical details for inventory presentation", () => {
    expect(huntSetForItem("worldsplitter_plate")).toBe("crusher");
    expect(huntSetForItem("iron_armour")).toBeNull();
    expect(equipmentPerkStats("fangstalker_wrap")).toMatchObject({ id: "fang_set", stamina: 12, damage: 2 });
    expect(equipmentPerkStats("venomweave_mantle")).toMatchObject({ durationMs: 3_000, cooldownMs: 1_500 });
    expect(HUNT_EQUIPMENT_SETS.crusher.bonus).toContain("+1 armour");
  });
});
