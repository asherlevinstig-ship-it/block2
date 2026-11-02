import { describe, expect, it } from "vitest";
import { TOWN_NPCS, canInteractWithTownNpc, townNpcDistance } from "./town-npcs.js";

describe("Town NPC registry", () => {
  it("keeps Brom's identity, service and anchor together", () => {
    const brom = TOWN_NPCS["smith-brom"];
    expect(brom).toMatchObject({ name: "Brom", role: "smith", services: ["blacksmith"] });
    expect(townNpcDistance({ x: 79, y: 100, z: 137 }, brom)).toBe(1);
    expect(canInteractWithTownNpc({ x: 79, y: 8, z: 137 }, brom)).toBe(true);
  });

  it("applies horizontal and vertical limits independently", () => {
    const brom = TOWN_NPCS["smith-brom"];
    expect(canInteractWithTownNpc({ x: 82, y: 8, z: 136 }, brom)).toBe(false);
    expect(canInteractWithTownNpc({ x: 79, y: 10, z: 136 }, brom)).toBe(false);
  });

  it("gives Mara one identity with room-specific authoritative anchors", () => {
    const mara = TOWN_NPCS.mara;
    expect(mara.services).toEqual(["tavern", "healing"]);
    expect(canInteractWithTownNpc({ x: 5.1, y: 8, z: 22.8 }, mara, "town")).toBe(true);
    expect(canInteractWithTownNpc({ x: -5.5, y: 9.5, z: -1.5 }, mara, "tavern")).toBe(true);
    expect(canInteractWithTownNpc({ x: 5.1, y: 8, z: 22.8 }, mara, "tavern")).toBe(false);
  });

  it("connects Lyra's visual anchor to healing and Calling guidance", () => {
    const lyra = TOWN_NPCS["healer-lyra"];
    expect(lyra).toMatchObject({ name: "Lyra", role: "healer", services: ["healing", "calling"] });
    expect(canInteractWithTownNpc({ x: 51, y: 8, z: 110 }, lyra)).toBe(true);
  });

  it("places Elin at Founders' Hall with the guild service", () => {
    const elin = TOWN_NPCS["guild-steward-elin"];
    expect(elin).toMatchObject({ name: "Elin", title: "Guild Steward", services: ["guild"] });
    expect(canInteractWithTownNpc({ x: 56, y: 9.45, z: 73 }, elin)).toBe(true);
    expect(canInteractWithTownNpc({ x: 67, y: 8, z: 106 }, elin)).toBe(false);
  });
});

