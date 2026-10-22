import { describe, expect, it } from "vitest";
import { leaderCollectionProgress, parseLeaderCollectionDiscoveries } from "./leader-collection-journal.js";

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
});
