import { describe, expect, it } from "vitest";
import { advanceTrackedLeaderCollectionHunt, leaderCollectionProgress, leaderCollectionRematchTier, leaderCollectionTarget,
  parseLeaderCollectionDiscoveries, parseTrackedLeaderCollectionHunt } from "./leader-collection-journal.js";

describe("regional leader collection journal", () => {
  it("reads permanent discoveries and ignores invalid items", () => {
    const result = parseLeaderCollectionDiscoveries(JSON.stringify({ leaderCollections: { discovered: {
      greenwood: ["forged_bow", "not_an_item", "forged_bow"], ashen: ["emberheart_focus"], unknown: ["forged_sword"],
    } } }));
    expect(result).toEqual({ greenwood: ["forged_bow"], ashen: ["emberheart_focus"] });
  });

  it("treats all four regional pieces as a completed cosmetic crest", () => {
    const discoveries = parseLeaderCollectionDiscoveries(JSON.stringify({ leaderCollections: { discovered: {
      quarry: ["stone_core_hammer", "forged_sword", "quarry_hauberk", "bastion_plate"],
    } } }));
    expect(leaderCollectionProgress("quarry", discoveries)).toEqual({ discovered: 4, total: 4, complete: true });
  });

  it("fails safely for old or malformed player data", () => {
    expect(parseLeaderCollectionDiscoveries("bad json")).toEqual({});
    expect(parseLeaderCollectionDiscoveries(JSON.stringify({ loadouts: [] }))).toEqual({});
  });

  it("routes missing pieces to their authored leader arena and truthful rematch tier", () => {
    expect(leaderCollectionTarget("quarry", "bastion_plate")).toMatchObject({
      x: 8.5, z: 101.5, id: "leader-collection-quarry", name: "Redstone Quarrymaster · Empowered Rematch III",
    });
    expect(leaderCollectionRematchTier("northwatch", "northwatch_cloak")).toBe(2);
    expect(leaderCollectionRematchTier("greenwood", "forged_bow")).toBe(0);
  });

  it("restores only valid tracked regional items", () => {
    expect(parseTrackedLeaderCollectionHunt(JSON.stringify({ collectionId: "mistfen", itemId: "mirebreaker_mantle" })))
      .toEqual({ collectionId: "mistfen", itemId: "mirebreaker_mantle" });
    expect(parseTrackedLeaderCollectionHunt(JSON.stringify({ collectionId: "mistfen", itemId: "forged_bow" }))).toBeNull();
    expect(parseTrackedLeaderCollectionHunt("broken")).toBeNull();
  });

  it("advances a discovered target to the next hidden piece and ends on set completion", () => {
    const tracked = { collectionId: "greenwood", itemId: "forged_bow" } as const;
    expect(advanceTrackedLeaderCollectionHunt(tracked, { greenwood: ["forged_bow"] }))
      .toEqual({ collectionId: "greenwood", itemId: "fang_dagger" });
    expect(advanceTrackedLeaderCollectionHunt(tracked, { greenwood: ["forged_bow", "fang_dagger", "forager_wrap", "rootstalker_wrap"] }))
      .toBeNull();
    expect(advanceTrackedLeaderCollectionHunt(tracked, {})).toEqual(tracked);
  });
});
