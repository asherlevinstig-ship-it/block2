import { describe, expect, it } from "vitest";
import { TOWN_NPCS } from "@blockcraft/protocol";
import { selectInteractionCandidate, townNpcInteractionCandidate, type InteractionCandidate } from "./interaction-candidates.js";

describe("interaction candidate resolver", () => {
  it("uses priority first and distance as the deterministic tie breaker", () => {
    const candidates: InteractionCandidate[] = [
      { id: "far", kind: "test", priority: 10, distance: 4, label: "Far", prompt: "Far", hold: false, payload: "far" },
      { id: "near", kind: "test", priority: 10, distance: 1, label: "Near", prompt: "Near", hold: false, payload: "near" },
      { id: "urgent", kind: "test", priority: 20, distance: 5, label: "Urgent", prompt: "Urgent", hold: false, payload: "urgent" },
    ];
    expect(selectInteractionCandidate(candidates)?.id).toBe("urgent");
    expect(selectInteractionCandidate(candidates.slice(0, 2))?.id).toBe("near");
  });

  it("creates Brom's candidate only inside the shared interaction anchor", () => {
    const brom = TOWN_NPCS["smith-brom"];
    expect(townNpcInteractionCandidate({ x: 79, y: 8, z: 137 }, brom)).toMatchObject({
      id: "npc:smith-brom", label: "Trade", payload: "smith-brom",
    });
    expect(townNpcInteractionCandidate({ x: 75, y: 8, z: 136 }, brom)).toBeNull();
    expect(townNpcInteractionCandidate({ x: 79, y: 4, z: 136 }, brom)).toBeNull();
    expect(townNpcInteractionCandidate({ x: 79, y: 8, z: 136 }, brom, false)).toBeNull();
  });

  it("resolves Mara against the active room anchor", () => {
    const mara = TOWN_NPCS.mara;
    expect(townNpcInteractionCandidate({ x: -5.5, y: 9.5, z: -1.5 }, mara, true, "tavern"))
      .toMatchObject({ id: "npc:mara", label: "Talk", payload: "mara" });
    expect(townNpcInteractionCandidate({ x: -5.5, y: 9.5, z: -1.5 }, mara, true, "town")).toBeNull();
  });

  it("offers Elin as one shared guild interaction", () => {
    expect(townNpcInteractionCandidate({ x: 55, y: 9.45, z: 74 }, TOWN_NPCS["guild-steward-elin"]))
      .toMatchObject({ id: "npc:guild-steward-elin", payload: "guild-steward-elin" });
  });
});

